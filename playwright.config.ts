import { defineConfig, devices } from '@playwright/test'

/**
 * Smart POS admin smoke test config.
 *
 * Runs against a real dev server + backend. Set these env vars to override:
 *   PW_BASE_URL   — frontend URL (default http://localhost:5181)
 *   PW_EMAIL      — login email  (default admin@gmail.com)
 *   PW_PASSWORD   — login password (default 123)
 *
 * Usage:
 *   1. Make sure the Django backend is running on :8000.
 *   2. `yarn dev` in another terminal (or rely on `webServer` below).
 *   3. `yarn smoke`
 */
export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5181',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Spawn `yarn dev` if no server is up yet. Reuses an existing one if found.
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
      command: 'yarn dev',
      url: 'http://localhost:5181',
      reuseExistingServer: true,
      timeout: 120_000,
    },
})
