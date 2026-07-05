import { expect, test, type Page } from '@playwright/test'
import { createMockStatementStore } from './mock-statement-store'

let mockStore: Awaited<ReturnType<typeof createMockStatementStore>>

test.beforeAll(async () => {
  mockStore = await createMockStatementStore(0)
})

test.afterAll(async () => {
  mockStore?.close()
})

async function openSmokePage(page: Page, room: string) {
  await page.addInitScript(() => {
    localStorage.setItem('sk3tchy-username', 'Playwright Smoke')
  })

  const url = `/test-crdt-fallback?room=${encodeURIComponent(room)}&endpoint=${encodeURIComponent(mockStore.url)}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('status')).toHaveText('connected')
}

test('Statement Store CRDT fallback syncs Yjs state across two product instances', async ({ page, context }) => {
  const room = `crdt-fallback-${Date.now()}`
  const pageA = page
  const pageB = await context.newPage()

  await Promise.all([
    openSmokePage(pageA, room),
    openSmokePage(pageB, room),
  ])

  await expect(pageA.getByTestId('peer-count')).toHaveText('1')
  await expect(pageB.getByTestId('peer-count')).toHaveText('1')

  const first = `from-a-${Date.now()}`
  await pageA.getByTestId('shared-input').fill(first)
  await pageA.getByTestId('publish').click()
  await expect(pageB.getByTestId('shared-value')).toHaveText(first)

  const second = `from-b-${Date.now()}`
  await pageB.getByTestId('shared-input').fill(second)
  await pageB.getByTestId('publish').click()
  await expect(pageA.getByTestId('shared-value')).toHaveText(second)
})
