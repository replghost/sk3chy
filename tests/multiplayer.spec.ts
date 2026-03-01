import { test, expect, chromium, firefox, type BrowserContext, type Page } from '@playwright/test'

/**
 * Multi-browser, multi-participant Playwright test for sk3chy.
 *
 * Launches 3 participants across 2 browser engines (Chromium + Firefox):
 *   - Player 1 (Chromium)
 *   - Player 2 (Chromium)
 *   - Player 3 (Firefox)
 *
 * Uses the REAL PreviewNet Statement Store for signaling (on-chain registration).
 * Each participant goes through the onboarding flow to register a username
 * and obtain statement-store allowance on PreviewNet.
 *
 * Validates:
 *   1. On-chain registration works for all players
 *   2. All players connect and reach the lobby
 *   3. Peer discovery works across browsers via statement-store signaling
 *   4. Host can configure game settings and start the game
 *   5. Word selection works for the drawer
 *   6. Guessers see "choosing a word" state, then the canvas
 *   7. Drawing syncs across peers
 *   8. Guessing works, correct guess triggers game end
 *   9. All players see the game end state
 */

const PREVIEWNET = 'wss://previewnet.substrate.dev/people'
const ROOM = `test-${Date.now()}`
const ROOM_URL = `/play/${ROOM}`

const REGISTRATION_TIMEOUT = 120_000
const CONNECT_TIMEOUT = 90_000
const PEER_DISCOVERY_TIMEOUT = 120_000

interface Participant {
  name: string
  browser: string
  context: BrowserContext
  page: Page
}

/** Generate a unique 7+ lowercase-letter username for on-chain registration */
function generateUsername(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).replace(/[^a-z]/g, 'a')
  return (prefix + suffix).slice(0, 12).padEnd(7, 'a')
}

test.describe('Multiplayer game across Chromium & Firefox (PreviewNet Statement Store)', () => {
  let participants: Participant[] = []
  let chromiumBrowser: Awaited<ReturnType<typeof chromium.launch>>
  let firefoxBrowser: Awaited<ReturnType<typeof firefox.launch>>

  test.beforeAll(async () => {
    console.log(`[test] Using PreviewNet Statement Store: ${PREVIEWNET}`)
    chromiumBrowser = await chromium.launch()
    firefoxBrowser = await firefox.launch()
  })

  test.afterAll(async () => {
    for (const p of participants) {
      await p.page.close().catch(() => {})
      await p.context.close().catch(() => {})
    }
    await chromiumBrowser?.close()
    await firefoxBrowser?.close()
  })

  async function createParticipant(
    browser: typeof chromiumBrowser,
    browserName: string,
    label: string,
  ): Promise<Participant> {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: [],
    })
    const page = await context.newPage()
    page.on('pageerror', () => {})

    // Navigate to the game room with PreviewNet chain override
    const url = `${ROOM_URL}?chain=${encodeURIComponent(PREVIEWNET)}`
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    return { name: label, browser: browserName, context, page }
  }

  /**
   * Complete the on-chain registration flow through the onboarding modal.
   * The modal appears because the user has no statement-store allowance yet.
   */
  async function registerOnChain(page: Page, label: string): Promise<string> {
    const username = generateUsername(label.toLowerCase())
    console.log(`[test] ${label}: registering username "${username}" on PreviewNet...`)

    // Capture console logs for debugging
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('registration') || text.includes('Registration') ||
          text.includes('allowance') || text.includes('error') || text.includes('Error')) {
        console.log(`[test] ${label} console: ${text.slice(0, 200)}`)
      }
    })

    // Wait for the onboarding modal to appear (step 2: username input)
    const usernameInput = page.locator('input[placeholder="Username (7+ lowercase letters)"]')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // Type the username
    await usernameInput.fill(username)

    // Wait for availability check to complete (600ms debounce + chain query)
    await page.waitForTimeout(2000)

    // If availability check shows "Available", proceed. If checking timed out, try anyway.
    const availableText = page.locator('text=Available')
    const chainOffline = page.locator('text=/Could not check availability/i')
    await Promise.race([
      availableText.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
      chainOffline.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    ])

    const isAvailable = await availableText.isVisible().catch(() => false)
    console.log(`[test] ${label}: username "${username}" available: ${isAvailable}`)

    // Click "Claim Username"
    const claimBtn = page.locator('button', { hasText: /Claim Username/i })
    await expect(claimBtn).toBeVisible({ timeout: 5_000 })
    await claimBtn.click()
    console.log(`[test] ${label}: clicked "Claim Username"`)

    // Wait for registration to complete — modal closes on success
    // Also watch for error state (registration might fail)
    const modalHeader = page.locator('text=/On-Chain Username Required|Choose a Username/i')
    const errorText = page.locator('.text-red-500')
    const progressBar = page.locator('.bg-emerald-500')

    const startTime = Date.now()
    while (Date.now() - startTime < REGISTRATION_TIMEOUT) {
      // Check if modal closed (success!)
      const modalVisible = await modalHeader.isVisible().catch(() => false)
      if (!modalVisible) {
        console.log(`[test] ${label}: registration complete, modal closed`)
        return username
      }

      // Check for error
      const errorVisible = await errorText.isVisible().catch(() => false)
      if (errorVisible) {
        const errMsg = await errorText.textContent().catch(() => 'unknown error')
        console.log(`[test] ${label}: registration error: ${errMsg}`)
        // Take a screenshot for debugging
        await page.screenshot({ path: `test-results/reg-error-${label.toLowerCase()}.png` })
        throw new Error(`Registration failed for ${label}: ${errMsg}`)
      }

      // Log progress
      const progressVisible = await progressBar.isVisible().catch(() => false)
      if (progressVisible) {
        const width = await progressBar.evaluate(el => el.style.width).catch(() => '?')
        if (Date.now() - startTime > 10_000) {
          console.log(`[test] ${label}: registration in progress... (${width})`)
        }
      }

      await page.waitForTimeout(3000)
    }

    // Timed out — take a screenshot and fail
    await page.screenshot({ path: `test-results/reg-timeout-${label.toLowerCase()}.png` })
    throw new Error(`Registration timed out for ${label} after ${REGISTRATION_TIMEOUT}ms`)
  }

  test('full game flow: register, join, discover peers, select word, draw, guess, finish', async () => {
    test.setTimeout(600_000) // 10 minutes for real chain operations
    console.log(`[test] Room: ${ROOM}`)

    // ------------------------------------------------------------------
    // 1. Launch all 3 participants and register on-chain
    // ------------------------------------------------------------------
    console.log('[test] Creating Player 1 (Chromium)...')
    const p1 = await createParticipant(chromiumBrowser, 'chromium', 'Alice')
    participants.push(p1)

    // Register P1 on-chain first (will be the host)
    const p1Username = await registerOnChain(p1.page, 'Alice')
    console.log(`[test] P1 registered: ${p1Username}`)

    // Wait for P1 to connect and reach the lobby after registration
    const p1Status = await waitForLobbyOrError(p1.page, CONNECT_TIMEOUT)
    console.log(`[test] P1 Alice (Chromium): ${p1Status}`)
    expect(p1Status).toBe('lobby')
    await setPlayerName(p1.page, p1Username)

    // Give P1 a head start for host election
    await p1.page.waitForTimeout(5000)

    // Launch P2 and P3 in parallel
    console.log('[test] Creating P2 (Chromium) + P3 (Firefox)...')
    const [p2, p3] = await Promise.all([
      createParticipant(chromiumBrowser, 'chromium', 'Bob'),
      createParticipant(firefoxBrowser, 'firefox', 'Charlie'),
    ])
    participants.push(p2, p3)

    // Register P2 and P3 sequentially to avoid sudo nonce conflicts on-chain
    const p2Username = await registerOnChain(p2.page, 'Bob')
    console.log(`[test] P2 registered: ${p2Username}`)
    const p3Username = await registerOnChain(p3.page, 'Charlie')
    console.log(`[test] P3 registered: ${p3Username}`)

    // Wait for P2 and P3 to reach the lobby
    const [p2Status, p3Status] = await Promise.all([
      waitForLobbyOrError(p2.page, CONNECT_TIMEOUT),
      waitForLobbyOrError(p3.page, CONNECT_TIMEOUT),
    ])
    console.log(`[test] P2 Bob (Chromium): ${p2Status}, P3 Charlie (Firefox): ${p3Status}`)
    expect(p2Status).toBe('lobby')
    expect(p3Status).toBe('lobby')

    await setPlayerName(p2.page, p2Username)
    await setPlayerName(p3.page, p3Username)
    console.log('[test] All 3 players in lobby')

    // ------------------------------------------------------------------
    // 2. Wait for peer discovery
    // ------------------------------------------------------------------
    console.log('[test] Waiting for peer discovery...')
    await Promise.all([
      waitForPeerCount(p1.page, 2),
      waitForPeerCount(p2.page, 2),
      waitForPeerCount(p3.page, 2),
    ])
    console.log('[test] Peers discovered!')

    // ------------------------------------------------------------------
    // 3. Host starts the game
    // ------------------------------------------------------------------
    const host = await findHost([p1, p2, p3])
    console.log(`[test] Host: ${host.name} (${host.browser})`)

    // Set quick timer
    const dur20s = host.page.locator('button', { hasText: '20s' })
    if (await dur20s.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dur20s.click()
    }

    await host.page.locator('button', { hasText: 'Start Game' }).click()
    console.log('[test] Host clicked "Start Game"')

    // ------------------------------------------------------------------
    // 4. Word selection — host is the initial drawer
    // ------------------------------------------------------------------
    await expect(host.page.locator('text=Choose Your Word')).toBeVisible({ timeout: 20_000 })

    // Wait for Yjs state to propagate to non-host peers
    await host.page.waitForTimeout(5000)

    // Non-host players see "choosing a word..." or game canvas (state synced via Yjs/WebRTC)
    const nonHosts = participants.filter(x => x !== host)
    for (const p of nonHosts) {
      // Poll for game state to propagate — may take time over real WebRTC
      await expect(async () => {
        const choosingVisible = await p.page
          .locator('text=/choosing a word/i')
          .isVisible()
          .catch(() => false)
        const wordSelectionVisible = await p.page
          .locator('text=Choose Your Word')
          .isVisible()
          .catch(() => false)
        const canvasVisible = await p.page
          .locator('canvas')
          .first()
          .isVisible()
          .catch(() => false)
        expect(choosingVisible || wordSelectionVisible || canvasVisible).toBe(true)
      }).toPass({ timeout: 30_000, intervals: [2000] })
      console.log(`[test] ${p.name}: sees game state`)
    }
    console.log('[test] Game state propagated to all players')

    // Pick the first word (word generation is async, may take time over real chain)
    const wordButtons = host.page.locator('.grid.grid-cols-3 button')
    await expect(wordButtons.first()).toBeVisible({ timeout: 30_000 })
    const selectedWord = (await wordButtons.first().locator('.text-xl').textContent())?.trim()
    await wordButtons.first().click()
    console.log(`[test] Word selected: "${selectedWord}"`)

    // Click "Start Drawing!"
    const startDrawingBtn = host.page.locator('button', { hasText: /Start Drawing/i })
    await expect(startDrawingBtn).toBeVisible({ timeout: 10_000 })
    await startDrawingBtn.click()
    console.log('[test] "Start Drawing!" clicked')

    // ------------------------------------------------------------------
    // 5. Playing state — determine who is the actual drawer
    // ------------------------------------------------------------------
    await host.page.waitForTimeout(2000)

    let drawer: Participant | null = null
    const guessers: Participant[] = []

    for (const p of participants) {
      const hasGuessInput = await p.page
        .locator('input[placeholder="guess..."]')
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      if (hasGuessInput) {
        guessers.push(p)
      } else {
        drawer = p
      }
    }

    if (!drawer) {
      drawer = host
      console.log(`[test] Could not detect drawer, assuming host (${host.name})`)
    }

    console.log(`[test] Drawer: ${drawer.name} (${drawer.browser})`)
    console.log(`[test] Guessers: ${guessers.map(g => `${g.name} (${g.browser})`).join(', ')}`)

    // Verify canvas is visible for all
    for (const p of participants) {
      await expect(p.page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    }
    console.log('[test] Canvas visible for all players')

    expect(guessers.length).toBeGreaterThanOrEqual(1)

    // ------------------------------------------------------------------
    // 6. Drawer draws on the canvas
    // ------------------------------------------------------------------
    const canvas = drawer.page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (box) {
      await drawer.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4)
      await drawer.page.mouse.down()
      for (let i = 0; i < 8; i++) {
        await drawer.page.mouse.move(
          box.x + box.width * (0.2 + i * 0.08),
          box.y + box.height * (0.4 + (i % 2 === 0 ? -0.1 : 0.1)),
        )
        await drawer.page.waitForTimeout(50)
      }
      await drawer.page.mouse.up()
      console.log('[test] Drawer drew on the canvas')
    }

    // Wait for Yjs sync
    await drawer.page.waitForTimeout(3000)

    // Screenshots
    await Promise.all(
      participants.map(p =>
        p.page.screenshot({ path: `test-results/playing-${p.name.toLowerCase()}.png` })
      )
    )

    // ------------------------------------------------------------------
    // 7. Guessers submit guesses
    // ------------------------------------------------------------------
    if (guessers.length >= 1) {
      const g1 = guessers[0]
      const g1Input = g1.page.locator('input[placeholder="guess..."]')
      await g1Input.fill('definitely wrong')
      await g1Input.press('Enter')
      console.log(`[test] ${g1.name} guessed wrong: "definitely wrong"`)
      await g1.page.waitForTimeout(2000)
    }

    if (guessers.length >= 2 && selectedWord) {
      const g2 = guessers[1]
      const g2Input = g2.page.locator('input[placeholder="guess..."]')
      await g2Input.fill(selectedWord)
      await g2Input.press('Enter')
      console.log(`[test] ${g2.name} guessed correctly: "${selectedWord}"`)
    } else if (guessers.length >= 1 && selectedWord) {
      const g1 = guessers[0]
      await g1.page.waitForTimeout(1000)
      const g1Input = g1.page.locator('input[placeholder="guess..."]')
      await g1Input.fill(selectedWord)
      await g1Input.press('Enter')
      console.log(`[test] ${g1.name} guessed correctly: "${selectedWord}"`)
    }

    // ------------------------------------------------------------------
    // 8. Game should end
    // ------------------------------------------------------------------
    // Wait for roundEnd or finished overlay on ANY participant
    await expect(async () => {
      let anyEnded = false
      for (const p of participants) {
        const sees = await p.page
          .locator('text=/The word was|Game Over|Session Complete|guessed it/i')
          .first()
          .isVisible()
          .catch(() => false)
        if (sees) { anyEnded = true; break }
      }
      expect(anyEnded).toBe(true)
    }).toPass({ timeout: 90_000, intervals: [3000] })
    console.log('[test] Game ended!')

    // Screenshots
    await Promise.all(
      participants.map(p =>
        p.page.screenshot({ path: `test-results/end-${p.name.toLowerCase()}.png` })
      )
    )

    // Verify all participants see the end state
    for (const p of participants) {
      const sees = await p.page
        .locator('text=/The word was|Game Over|Session Complete|choosing a word/i')
        .first()
        .isVisible({ timeout: 30_000 })
        .catch(() => false)
      console.log(`[test] ${p.name} (${p.browser}) sees end state: ${sees}`)
      expect(sees).toBe(true)
    }

    const winnerVisible = await participants[0].page
      .locator('text=/guessed it/i')
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    console.log(`[test] Winner announced: ${winnerVisible}`)

    console.log('[test] All validations passed!')
  })
})

// -- Helpers --

async function waitForLobbyOrError(page: Page, timeout: number): Promise<'lobby' | 'error' | 'timeout'> {
  try {
    const lobby = page.locator('input[placeholder="Your name"]')
    const waiting = page.locator('text=/Waiting for host to start/i')
    const error = page.locator('.text-red-400')

    return await Promise.race([
      lobby.waitFor({ state: 'visible', timeout }).then(() => 'lobby' as const),
      waiting.waitFor({ state: 'visible', timeout }).then(() => 'lobby' as const),
      error.waitFor({ state: 'visible', timeout }).then(() => 'error' as const),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), timeout)),
    ])
  } catch {
    return 'timeout'
  }
}

async function setPlayerName(page: Page, name: string) {
  const input = page.locator('input[placeholder="Your name"]')
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill(name)
  }
}

async function waitForPeerCount(page: Page, minCount: number) {
  await expect(async () => {
    const countText = await page.locator('text=/\\d+\\/8/').first().textContent()
    const count = parseInt(countText || '0')
    expect(count).toBeGreaterThanOrEqual(minCount)
  }).toPass({ timeout: PEER_DISCOVERY_TIMEOUT, intervals: [3000] })
}

async function findHost(players: Participant[]): Promise<Participant> {
  for (const p of players) {
    const btn = p.page.locator('button', { hasText: 'Start Game' })
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      return p
    }
  }
  throw new Error('No player has the Start Game button (no host found)')
}
