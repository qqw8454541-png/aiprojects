import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for CI smoke tests against the production site.
 *
 * Usage:
 *   npx playwright test --config e2e/playwright-ci.config.ts
 *
 * No local dev server is started — tests hit the live production URL directly.
 */
export default defineConfig({
  testDir: './specs-ci',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../e2e-ci-report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://mahjong-scorer.eastree.co.jp',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    // Mobile viewport to match the app's mobile-first design
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
      },
    },
  ],
  // No webServer — testing against production
});
