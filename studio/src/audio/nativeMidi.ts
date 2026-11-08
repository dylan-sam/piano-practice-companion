// MIDI input in the native app: mobile web views have no Web MIDI, so the app's Midi plugin
// (android/.../MidiPlugin.java with android.media.midi, ios/App/App/MidiPlugin.swift with
// CoreMIDI) connects every MIDI source and forwards its note messages.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface MidiPlugin {
  /** Connect every MIDI source (and those plugged in later); returns the connected device names. */
  start(): Promise<{ devices: string[] }>
  /** Disconnect every MIDI source. */
  stop(): Promise<void>
  /** A note message from a device: status, note and velocity bytes. */
  addListener(event: 'message', listener: (message: { data: number[] }) => void): Promise<PluginListenerHandle>
  /** The connected device names changed. */
  addListener(event: 'devices', listener: (state: { devices: string[] }) => void): Promise<PluginListenerHandle>
}

export const Midi = registerPlugin<MidiPlugin>('Midi')

/** Whether MIDI comes from the native plugin rather than the browser's Web MIDI. */
export const usesNativeMidi = () => Capacitor.isNativePlatform()
