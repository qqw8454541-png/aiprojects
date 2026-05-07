package com.mahjongscorer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Disable WebView algorithmic darkening — we handle dark mode via CSS (Tailwind dark:)
        getBridge().getWebView().post(() -> {
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                    WebSettingsCompat.setAlgorithmicDarkeningAllowed(
                        getBridge().getWebView().getSettings(), false
                    );
                }
            } catch (Exception e) {
                // Fallback: ignore if feature is not available
            }
        });
    }
}
