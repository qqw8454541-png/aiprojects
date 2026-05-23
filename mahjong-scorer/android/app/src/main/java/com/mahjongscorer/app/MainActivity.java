package com.mahjongscorer.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            // Force hardware-accelerated rendering layer for backdrop-filter / blur CSS
            getBridge().getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);

            // Disable WebView algorithmic darkening — we handle dark mode via CSS (Tailwind dark:)
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
