import { env } from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pwa.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!env.CI,
  retries: env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175/learn-the-clock/',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'bun run preview --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/learn-the-clock/',
    reuseExistingServer: false,
  },
})
