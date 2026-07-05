import { defineConfig } from '@playwright/test'

const PREVIEWNET = 'wss://previewnet.substrate.dev/people'
const HOST = '127.0.0.1'
const PORT = 3000
const webServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER
  ? undefined
  : {
      command: `NUXT_PUBLIC_STATEMENT_STORE_WS=${PREVIEWNET} npx nuxt dev --host ${HOST} --port ${PORT}`,
      url: `http://${HOST}:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
    }

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer,
})
