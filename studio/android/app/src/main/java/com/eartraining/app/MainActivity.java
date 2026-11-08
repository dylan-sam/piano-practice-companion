package com.eartraining.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/** The app's single activity: the Capacitor web view, with the app's own Midi plugin registered. */
public class MainActivity extends BridgeActivity {
    /** Register the app's plugins before the bridge starts, then take over the back button. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MidiPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            /** Let the page handle the press (ui/backButton.ts); leave the app when it has nothing left to do. */
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    finish();
                    return;
                }
                bridge.getWebView().evaluateJavascript(
                    "window.earTrainingBack ? window.earTrainingBack() : false",
                    handled -> {
                        // The page closed a menu or went back to the main menu: stay in the app
                        if (!"true".equals(handled)) finish();
                    });
            }
        });
    }
}
