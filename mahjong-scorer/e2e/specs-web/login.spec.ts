import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Web E2E Test: Phone Login Flow
 *
 * Tests the full login flow via phone OTP on the local dev server.
 *
 * Prerequisites:
 *   - Supabase project configured with test phone: 08012345678 / code: 666666
 *   - Dev server running at localhost:3000
 *
 * Flow:
 *   Landing → Personal Menu → Click Login → Phone Mode →
 *   Enter Phone → Send Code → Enter OTP → Verify → Logged In
 */

const TEST_PHONE = '08012345678';
const TEST_OTP = '666666';
const STORAGE_STATE_PATH = path.join(__dirname, '..', '.auth-state.json');

// Run tests serially so test 2 can use state saved by test 1
test.describe.configure({ mode: 'serial' });

test.describe('Phone Login Flow', () => {
  test('should login via phone OTP and see user info', async ({ page }) => {
    // ──── 1. Navigate to landing page ────────────────────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The app icon should be visible on the landing page
    const appIcon = page.locator('img[alt="App Icon"]');
    await expect(appIcon).toBeVisible({ timeout: 15000 });

    // ──── 2. Tap Personal Mode (🀄) ─────────────────────────────
    const personalBtn = page.locator('button', { hasText: '🀄' });
    await expect(personalBtn).toBeVisible({ timeout: 10000 });
    await personalBtn.click();

    // ──── 3. Wait for Personal Menu page ────────────────────────
    // The login button (🔐) should be visible for non-logged-in users
    const loginBtn = page.locator('button', { hasText: '🔐' });
    await expect(loginBtn).toBeVisible({ timeout: 10000 });

    // ──── 4. Open Auth Modal ────────────────────────────────────
    await loginBtn.click();

    // The auth modal should appear with the phone button (📱)
    const phoneBtn = page.locator('button', { hasText: '📱' });
    await expect(phoneBtn).toBeVisible({ timeout: 5000 });

    // ──── 5. Enter Phone Mode ───────────────────────────────────
    await phoneBtn.click();

    // Phone input should appear (it has type="tel")
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible({ timeout: 5000 });

    // ──── 6. Enter phone number ─────────────────────────────────
    await phoneInput.fill(TEST_PHONE);

    // ──── 7. Send verification code ─────────────────────────────
    const sendCodeBtn = page.locator('button.bg-emerald-500, button[class*="bg-emerald"]').first();
    await expect(sendCodeBtn).toBeEnabled({ timeout: 3000 });
    await sendCodeBtn.click();

    // ──── 8. Wait for OTP input to appear ───────────────────────
    const otpInput = page.locator('input[inputmode="numeric"][maxlength="6"]');
    await expect(otpInput).toBeVisible({ timeout: 10000 });

    // ──── 9. Enter OTP code ─────────────────────────────────────
    await otpInput.fill(TEST_OTP);

    // ──── 10. Verify and login ──────────────────────────────────
    const verifyBtn = page.locator('button.bg-zinc-900, button[class*="bg-zinc-900"]').first();
    await expect(verifyBtn).toBeEnabled({ timeout: 3000 });
    await verifyBtn.click();

    // ──── 11. Verify login success ──────────────────────────────
    // After login, user info button should appear instead of login button
    const userInfoSection = page.locator('button', { hasText: /Phone User|Testuser/ });
    await expect(userInfoSection).toBeVisible({ timeout: 15000 });

    // The login button (🔐) should no longer be visible
    await expect(loginBtn).not.toBeVisible({ timeout: 3000 });

    // ──── 12. Save storage state for next test ──────────────────
    await page.context().storageState({ path: STORAGE_STATE_PATH });

    console.log('✅ Phone login flow completed successfully!');
  });

  test('should persist login state on page reload', async ({ browser }) => {
    // ──── 1. Create context with saved auth state ───────────────
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    // ──── 2. Navigate to the app ────────────────────────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Extra wait for Zustand hydration + Supabase session restore
    await page.waitForTimeout(3000);

    // ──── 3. The app may land on Landing or Personal Menu ───────
    // (storageState restores localStorage including Zustand's persisted
    //  currentPage, so it might skip Landing entirely)
    const landingBtn = page.locator('button', { hasText: '🀄' });
    const isOnLanding = await landingBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (isOnLanding) {
      await landingBtn.click();
      await page.waitForTimeout(1000);
    }

    // ──── 4. Verify still logged in on Personal Menu ────────────
    // User info should be visible (not the login button)
    const userInfo = page.locator('button', { hasText: /Phone User|Testuser/ });
    await expect(userInfo).toBeVisible({ timeout: 15000 });

    // Login button should NOT be visible
    const loginBtn = page.locator('button', { hasText: '🔐' });
    await expect(loginBtn).not.toBeVisible({ timeout: 5000 });

    // Verify "Sign Out" is visible (confirms we're in logged-in state)
    const signOutBtn = page.locator('button', { hasText: /Sign Out|ログアウト|登出/ });
    await expect(signOutBtn).toBeVisible({ timeout: 5000 });

    await context.close();
    console.log('✅ Login state persisted after reload!');
  });
});
