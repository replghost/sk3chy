import { defineConfig } from '@playwright/test'

const PREVIEWNET = 'wss://previewnet.substrate.dev/people'

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `NUXT_PUBLIC_STATEMENT_STORE_WS=${PREVIEWNET} npx nuxt dev`,
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
