import { test as base, type Page } from '@playwright/test';
import { _android, type AndroidDevice, type AndroidWebView } from 'playwright';
import path from 'path';

// ─── Configuration ─────────────────────────────────────────────
const APK_PATH = path.resolve(
  __dirname,
  '../android/app/build/outputs/apk/debug/app-debug.apk'
);
const APP_PACKAGE = 'com.mahjongscorer.app';
const APP_ACTIVITY = `${APP_PACKAGE}.MainActivity`;

// ─── Custom Fixtures ───────────────────────────────────────────

type AndroidFixtures = {
  /** The connected Android device (emulator or physical) */
  device: AndroidDevice;
  /** A Playwright Page attached to the app's WebView */
  webview: Page;
};

/**
 * Extended Playwright test with Android-specific fixtures.
 *
 * The `device` fixture connects to the first available Android device
 * via ADB, installs the debug APK, and launches the app.
 *
 * The `webview` fixture waits for the Capacitor WebView to appear
 * and returns a standard Playwright Page object, so you can use
 * familiar selectors like `page.locator(...)`, `page.click(...)`, etc.
 */
export const test = base.extend<AndroidFixtures>({
  // eslint-disable-next-line no-empty-pattern
  device: async ({}, use) => {
    // Connect to the first ADB-reachable device
    const devices = await _android.devices();
    if (devices.length === 0) {
      throw new Error(
        'No Android devices found. Start an emulator or connect a device via ADB.'
      );
    }
    const device = devices[0];
    console.log(`[e2e] Connected to device: ${device.serial()}`);

    // Install APK (skips if same version is already installed)
    await device.installApk(APK_PATH);

    await use(device);

    // Teardown: close device connection
    await device.close();
  },

  webview: async ({ device }, use) => {
    // Force-stop the app in case it's already running
    await device.shell(`am force-stop ${APP_PACKAGE}`);
    // Small delay to ensure clean state
    await new Promise((r) => setTimeout(r, 500));

    // Launch the app
    await device.shell(
      `am start -n ${APP_ACTIVITY} -a android.intent.action.MAIN -c android.intent.category.LAUNCHER`
    );

    // Wait for the WebView context to appear.
    // Capacitor creates a WebView with the app's package name.
    let webView: AndroidWebView | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      const views = device.webViews();
      webView = views.find((v) => v.pkg() === APP_PACKAGE);
      if (webView) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!webView) {
      throw new Error(
        `WebView for ${APP_PACKAGE} not found after 30s. ` +
          `Make sure the APK is a debug build with WebView debugging enabled.`
      );
    }

    const page = await webView.page();

    // Wait for the app to fully render (SplashScreen hides after 300ms + load)
    await page.waitForLoadState('networkidle');
    // Extra safety: wait for the main container to be visible
    await page.waitForTimeout(2000);

    await use(page);
  },
});

export { expect } from '@playwright/test';
