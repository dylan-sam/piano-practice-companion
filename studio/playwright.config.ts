import { defineConfig, devices } from '@playwright/test'

// Browser tests (e2e/): the built app in a clean Chromium, as deployed for the web demo (with the
// song catalog bundled, so no server is needed). Run with `pnpm run test:e2e`; unit tests stay in
// tests/ and run with `pnpm test`. To test a running server instead (`python server.py`), set
// E2E_BASE_URL, e.g. E2E_BASE_URL=http://127.0.0.1:8765 pnpm run test:e2e.
const external = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: external ?? 'http://localhost:4173',
    // The service worker would serve a cached build between runs
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    // The band may start without a tap, as after a first touch on a phone
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1760, height: 860 } } }],
  webServer: external ? undefined : {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    env: { VITE_BUNDLED_CATALOG: '1' },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
