import { defineConfig } from '@playwright/test';

/**
 * Playwright config for Android WebView E2E tests.
 *
 * These tests connect to an Android emulator/device via ADB,
 * install the APK, and drive the app's WebView using standard
 * Playwright Page APIs.
 *
 * Usage:
 *   npx playwright test --config e2e/playwright.config.ts
 */
export default defineConfig({
  testDir: './specs',
  timeout: 120_000, // 2 minutes per test (emulator can be slow)
  retries: 0,
  workers: 1, // Serial execution — only one device at a time
  reporter: [
    ['list'],
    ['html', { outputFolder: '../e2e-report', open: 'never' }],
  ],
  use: {
    trace: 'on-first-retry',
  },
});
