import { expect, test, type Page } from '@playwright/test'

const liveEndpoint = process.env.LIVE_STATEMENT_STORE_WS || ''
const liveMnemonic = process.env.LIVE_STATEMENT_STORE_MNEMONIC || ''

test.skip(!liveEndpoint, 'Set LIVE_STATEMENT_STORE_WS to run this test against a real Statement Store.')
test.skip(!liveMnemonic, 'Set LIVE_STATEMENT_STORE_MNEMONIC to a test account with Statement Store allowance.')

async function openLiveSmokePage(page: Page, room: string) {
  await page.addInitScript((mnemonic) => {
    localStorage.setItem('sk3tchy-username', 'Playwright Live Smoke')
    localStorage.setItem('sk3tchy-mnemonic', mnemonic)
  }, liveMnemonic)

  const url = `/test-crdt-fallback?room=${encodeURIComponent(room)}&endpoint=${encodeURIComponent(liveEndpoint)}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('status')).toHaveText('connected')
}

test('Statement Store CRDT fallback syncs Yjs state over a real Statement Store', async ({ page, context }) => {
  const room = `crdt-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const pageA = page
  const pageB = await context.newPage()

  await Promise.all([
    openLiveSmokePage(pageA, room),
    openLiveSmokePage(pageB, room),
  ])

  await expect(pageA.getByTestId('peer-count')).toHaveText('1')
  await expect(pageB.getByTestId('peer-count')).toHaveText('1')

  const first = `live-a-${Date.now()}`
  await pageA.getByTestId('shared-input').fill(first)
  await pageA.getByTestId('publish').click()
  await expect(pageB.getByTestId('shared-value')).toHaveText(first)

  const second = `live-b-${Date.now()}`
  await pageB.getByTestId('shared-input').fill(second)
  await pageB.getByTestId('publish').click()
  await expect(pageA.getByTestId('shared-value')).toHaveText(second)
})
