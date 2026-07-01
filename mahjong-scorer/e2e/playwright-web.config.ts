import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Web E2E tests against local dev server.
 *
 * Usage:
 *   ./node_modules/.bin/playwright test --config e2e/playwright-web.config.ts
 */
export default defineConfig({
  testDir: './specs-web',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../e2e-web-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
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
        colorScheme: 'dark',  // 匹配 dark mode
      },
    },
  ],
  // Start the dev server automatically
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
