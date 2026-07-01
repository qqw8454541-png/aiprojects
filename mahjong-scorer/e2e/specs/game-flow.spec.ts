import { test, expect } from '../fixtures';

/**
 * Core game flow E2E test.
 *
 * Tests the happy-path of the mahjong scoring app:
 *   Landing → Personal Menu → Create Room → Add 4 Players →
 *   Start Match → Input Scores → View Result → Back to Room
 *
 * This runs against the actual APK on an Android emulator.
 * Selectors target DOM elements inside the Capacitor WebView.
 *
 * NOTE: The app defaults to Japanese locale based on device language.
 *       Tests use visible text matching for locale-independent assertions
 *       where possible (e.g. numbers, player names we input ourselves).
 */
test.describe('Core Game Flow', () => {
  test('should complete a full scoring round', async ({ webview }) => {
    const page = webview;

    // ──── 1. Landing Page ────────────────────────────────────────
    // Verify the app loaded — the landing page should show two mode buttons.
    // We look for the personal mode button by its emoji prefix since
    // the text varies by locale.
    const personalModeButton = page.locator('button', { hasText: '🀄' });
    await expect(personalModeButton).toBeVisible({ timeout: 15000 });

    // Tap "Personal Mode"
    await personalModeButton.click();

    // ──── 2. Personal Menu Page ──────────────────────────────────
    // Should see the "Start New Game" button.
    // Look for the button that navigates to 'create' page — it has
    // the dice SVG icon. We match by the second main button.
    const newGameButton = page.locator('button').filter({
      has: page.locator('svg'), // The MahjongNewIcon SVG
    });
    // In case of a resume button appearing first, pick the one with the dice icon
    const createButton = newGameButton.last();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // ──── 3. Create Room (Rule Presets) ──────────────────────────
    // The default preset is "mLeague" which should be pre-selected.
    // Just tap the confirm button to proceed with defaults.
    // The confirm button has the emerald gradient class.
    const confirmRulesBtn = page.locator(
      'button.bg-gradient-to-r.from-emerald-500'
    );
    // Fallback: find by looking for the button after the presets section
    const createBtn = confirmRulesBtn.or(
      page.locator('button', { hasText: /プレイヤー|Player|下一步/ })
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
    await createBtn.first().click();

    // ──── 4. Room Page — Add 4 Players ───────────────────────────
    // The nickname input should be visible
    const nicknameInput = page.locator('input[maxlength="10"]');
    await expect(nicknameInput).toBeVisible({ timeout: 10000 });

    const playerNames = ['Alice', 'Bob', 'Carol', 'Dave'];
    const addButton = page.locator('button:has-text("+")');

    for (const name of playerNames) {
      await nicknameInput.fill(name);
      await addButton.click();
      // Small delay to let the animation complete
      await page.waitForTimeout(300);
    }

    // Verify all 4 players are seated (their names should appear in seat cards)
    for (const name of playerNames) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible();
    }

    // ──── 5. Start Match ─────────────────────────────────────────
    // The "Start Match" button should now be enabled (all seats filled)
    // It's the large emerald gradient button
    const startMatchBtn = page.locator(
      'button.bg-gradient-to-r.from-emerald-500'
    ).or(
      page.locator('button.bg-gradient-to-r.from-emerald-600')
    );
    await expect(startMatchBtn.first()).toBeEnabled({ timeout: 5000 });
    await startMatchBtn.first().click();

    // ──── 6. Score Input Page ────────────────────────────────────
    // Should see score input fields. The app uses inputMode="decimal"
    // inputs for score entry.
    const scoreInputs = page.locator('input[inputmode="decimal"], input[inputmode="numeric"]');
    await expect(scoreInputs.first()).toBeVisible({ timeout: 10000 });

    // Input scores that sum to the expected total:
    // For M-League rules: 4 × 25000 = 100000 total
    // Input in hundreds: e.g. 350 = 35000, 250 = 25000, 200 = 20000, 200 = 20000
    // These sum to 100000
    const scores = ['350', '250', '200', '200'];
    const inputCount = await scoreInputs.count();

    for (let i = 0; i < Math.min(scores.length, inputCount); i++) {
      await scoreInputs.nth(i).fill(scores[i]);
      await page.waitForTimeout(200);
    }

    // Tap the "Calculate PT" button
    const calcButton = page.locator('button', {
      hasText: /PT|計算|计算/,
    });
    await expect(calcButton.first()).toBeVisible({ timeout: 5000 });
    await calcButton.first().click();

    // ──── 7. Result Page ─────────────────────────────────────────
    // Should navigate to result page showing player rankings
    // Verify at least one player name appears in the results
    await expect(
      page.locator('text=Alice').first()
    ).toBeVisible({ timeout: 10000 });

    // Verify PT values are displayed (look for signed numbers like +15.0)
    const ptValues = page.locator('text=/[+-]\\d+/');
    await expect(ptValues.first()).toBeVisible({ timeout: 5000 });

    // ──── 8. Back to Room ────────────────────────────────────────
    // Tap the "Back to Room" / "ルームに戻る" button
    const backToRoomBtn = page.locator('button', {
      hasText: /ルームに戻る|返回房间|Back to Room/,
    });
    await expect(backToRoomBtn.first()).toBeVisible({ timeout: 5000 });
    await backToRoomBtn.first().click();

    // Verify we're back on the room page — player names should still be visible
    await expect(page.locator('text=Alice').first()).toBeVisible({
      timeout: 10000,
    });

    // Verify round history shows "Hanchan #1" as completed
    const completedBadge = page.locator('text=/対局完了|对局完成|Completed/');
    await expect(completedBadge.first()).toBeVisible({ timeout: 5000 });
  });
});
