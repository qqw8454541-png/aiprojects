import { test, expect } from '../fixtures';

/**
 * Smoke test: App Launch
 *
 * Verifies the app starts up correctly and renders the landing page.
 * This is the fastest test to catch build regressions.
 */
test.describe('App Launch', () => {
  test('should display the landing page with app title', async ({ webview }) => {
    const page = webview;

    // The landing page should render the app icon
    const appIcon = page.locator('img[alt="App Icon"]');
    await expect(appIcon).toBeVisible({ timeout: 15000 });

    // The personal mode button (🀄) should be visible
    const personalBtn = page.locator('button', { hasText: '🀄' });
    await expect(personalBtn).toBeVisible();

    // The venue mode button (🏮) should be visible
    const venueBtn = page.locator('button', { hasText: '🏮' });
    await expect(venueBtn).toBeVisible();
  });

  test('should navigate to personal menu and back', async ({ webview }) => {
    const page = webview;

    // Tap personal mode
    const personalBtn = page.locator('button', { hasText: '🀄' });
    await expect(personalBtn).toBeVisible({ timeout: 15000 });
    await personalBtn.click();

    // Should see the personal menu (new game button with SVG icon)
    const newGameArea = page.locator('button').filter({
      has: page.locator('svg'),
    });
    await expect(newGameArea.first()).toBeVisible({ timeout: 10000 });

    // Navigate back using the TopBar back button
    const backButton = page.locator('button', {
      hasText: /戻る|返回|Back/,
    });
    if (await backButton.first().isVisible().catch(() => false)) {
      await backButton.first().click();
      // Should be back on landing
      await expect(personalBtn).toBeVisible({ timeout: 10000 });
    }
  });
});
