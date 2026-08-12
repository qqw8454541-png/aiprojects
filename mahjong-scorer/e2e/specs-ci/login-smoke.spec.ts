import { test, expect } from '@playwright/test';

/**
 * CI Smoke Test: Production Login & Auth Verification
 *
 * Runs against the live production site (https://mahjong-scorer.eastree.co.jp).
 * Performs the full phone OTP login flow and verifies the user is authenticated.
 *
 * Prerequisites:
 *   - Supabase project configured with test phone: 08012345678 / OTP: 666666
 */

const TEST_PHONE = '08012345678';
const TEST_OTP = '666666';

test.describe('Production Login Smoke Test', () => {
  test('should login via phone OTP and verify authenticated state', async ({ page }) => {
    // ──── 1. Navigate to production landing page ──────────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const appIcon = page.locator('img[alt="App Icon"]');
    await expect(appIcon).toBeVisible({ timeout: 20_000 });

    // ──── 2. Tap Personal Mode (🀄) ───────────────────────────────
    const personalBtn = page.locator('button', { hasText: '🀄' });
    await expect(personalBtn).toBeVisible({ timeout: 10_000 });
    await personalBtn.click();

    // ──── 3. Open Auth Modal via Login button (🔐) ────────────────
    const loginBtn = page.locator('button', { hasText: '🔐' });
    await expect(loginBtn).toBeVisible({ timeout: 10_000 });
    await loginBtn.click();

    // ──── 4. Select Phone login mode (📱) ─────────────────────────
    const phoneBtn = page.locator('button', { hasText: '📱' });
    await expect(phoneBtn).toBeVisible({ timeout: 5_000 });
    await phoneBtn.click();

    // ──── 5. Enter phone number ───────────────────────────────────
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible({ timeout: 5_000 });
    await phoneInput.fill(TEST_PHONE);

    // ──── 6. Send verification code ───────────────────────────────
    const sendCodeBtn = page
      .locator('button.bg-emerald-500, button[class*="bg-emerald"]')
      .first();
    await expect(sendCodeBtn).toBeEnabled({ timeout: 3_000 });
    await sendCodeBtn.click();

    // ──── 6.5. Agree to Terms Consent ─────────────────────────────
    const agreeBtn = page.locator('button', {
      hasText: /同意して送信|同意并发送|Agree & Send/
    });
    await expect(agreeBtn).toBeVisible({ timeout: 5_000 });
    await agreeBtn.click();

    // ──── 7. Wait for OTP input and enter code ────────────────────
    const otpInput = page.locator('input[inputmode="numeric"][maxlength="6"]');
    await expect(otpInput).toBeVisible({ timeout: 15_000 });
    await otpInput.fill(TEST_OTP);

    // ──── 8. Verify and login ─────────────────────────────────────
    const verifyBtn = page
      .locator('button.bg-zinc-900, button[class*="bg-zinc-900"]')
      .first();
    await expect(verifyBtn).toBeEnabled({ timeout: 3_000 });
    await verifyBtn.click();

    // ──── 9. Verify login success ─────────────────────────────────
    // After login, user info button should appear instead of login button
    const userInfoSection = page.locator('button', {
      hasText: /Phone User|Testuser/,
    });
    await expect(userInfoSection).toBeVisible({ timeout: 20_000 });

    // Login button should no longer be visible
    await expect(loginBtn).not.toBeVisible({ timeout: 5_000 });

    // ──── 10. Verify Sign Out button is present (confirms auth) ───
    const signOutBtn = page.locator('button', {
      hasText: /Sign Out|ログアウト|登出/,
    });
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });

    console.log('✅ Production login smoke test passed!');
  });
});
