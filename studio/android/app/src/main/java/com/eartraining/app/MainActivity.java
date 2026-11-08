package com.eartraining.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** The app's single activity: the Capacitor web view, with the app's own Midi plugin registered. */
public class MainActivity extends BridgeActivity {
    /** Register the app's plugins before the bridge starts. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MidiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
