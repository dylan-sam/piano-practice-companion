package com.eartraining.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MIDI keyboard input for Chord Sightreading (Android web views have no Web MIDI).
 * Opens the output ports of every MIDI device (USB, Bluetooth, virtual), splits what
 * they send into note-on and note-off messages and sends each to the web app as a
 * "message" event; "devices" reports the connected device names (studio/src/audio/nativeMidi.ts).
 */
@CapacitorPlugin(name = "Midi")
public class MidiPlugin extends Plugin {
    private MidiManager manager;
    private final Map<Integer, MidiDevice> devices = new HashMap<>();
    private final Map<Integer, String> names = new HashMap<>();
    private final List<MidiOutputPort> ports = new ArrayList<>();
    private final Handler main = new Handler(Looper.getMainLooper());

    /** Follow devices being plugged in and out while the plugin is started. */
    private final MidiManager.DeviceCallback callback = new MidiManager.DeviceCallback() {
        @Override
        public void onDeviceAdded(MidiDeviceInfo info) {
            open(info);
        }

        @Override
        public void onDeviceRemoved(MidiDeviceInfo info) {
            close(info.getId());
            notifyDevices();
        }
    };

    /** Connect every MIDI device and resolve with their names. */
    @PluginMethod
    public void start(PluginCall call) {
        Context context = getContext();
        if (!context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)) {
            call.reject("This device does not support MIDI");
            return;
        }
        manager = (MidiManager) context.getSystemService(Context.MIDI_SERVICE);
        manager.registerDeviceCallback(callback, main);
        for (MidiDeviceInfo info : manager.getDevices()) open(info);
        JSObject result = new JSObject();
        result.put("devices", deviceNames());
        call.resolve(result);
    }

    /** Disconnect every device. */
    @PluginMethod
    public void stop(PluginCall call) {
        if (manager != null) manager.unregisterDeviceCallback(callback);
        for (Integer id : new ArrayList<>(devices.keySet())) close(id);
        call.resolve();
    }

    /** Close the ports when the app goes away. */
    @Override
    protected void handleOnDestroy() {
        for (Integer id : new ArrayList<>(devices.keySet())) close(id);
    }

    /** Open one device and connect a note receiver to each of its output ports. */
    private void open(MidiDeviceInfo info) {
        if (devices.containsKey(info.getId()) || info.getOutputPortCount() == 0) return;
        manager.openDevice(info, device -> {
            if (device == null) return;
            devices.put(info.getId(), device);
            names.put(info.getId(), deviceName(info));
            for (int port = 0; port < info.getOutputPortCount(); port++) {
                MidiOutputPort output = device.openOutputPort(port);
                if (output == null) continue;
                output.connect(new NoteReceiver());
                ports.add(output);
            }
            notifyDevices();
        }, main);
    }

    /** Close one device. */
    private void close(int id) {
        MidiDevice device = devices.remove(id);
        names.remove(id);
        if (device == null) return;
        try {
            device.close();
        } catch (IOException ignored) {
            // The device is gone already
        }
    }

    /** The name to show for a device. */
    private static String deviceName(MidiDeviceInfo info) {
        Bundle properties = info.getProperties();
        String name = properties.getString(MidiDeviceInfo.PROPERTY_NAME);
        return name == null || name.isEmpty() ? "MIDI keyboard" : name;
    }

    /** The names of the connected devices, as a JS array. */
    private JSArray deviceNames() {
        JSArray list = new JSArray();
        for (String name : names.values()) list.put(name);
        return list;
    }

    /** Tell the web app which devices are connected. */
    private void notifyDevices() {
        JSObject state = new JSObject();
        state.put("devices", deviceNames());
        notifyListeners("devices", state);
    }

    /** Split incoming MIDI bytes into note messages, following running status. */
    private class NoteReceiver extends MidiReceiver {
        private int status = 0;
        private final int[] data = new int[2];
        private int count = 0;

        @Override
        public void onSend(byte[] message, int offset, int length, long timestamp) {
            for (int i = offset; i < offset + length; i++) {
                int value = message[i] & 0xff;
                if (value >= 0xf8) continue; // real-time messages (clock) may come in between
                if (value >= 0x80) {
                    status = value < 0xf0 ? value : 0;
                    count = 0;
                    continue;
                }
                int type = status & 0xf0;
                if (type != 0x80 && type != 0x90) continue;
                data[count++] = value;
                if (count == 2) {
                    count = 0;
                    JSArray bytes = new JSArray();
                    bytes.put(status);
                    bytes.put(data[0]);
                    bytes.put(data[1]);
                    JSObject event = new JSObject();
                    event.put("data", bytes);
                    main.post(() -> notifyListeners("message", event));
                }
            }
        }
    }
}
