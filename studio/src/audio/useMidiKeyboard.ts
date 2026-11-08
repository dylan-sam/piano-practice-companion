import type { PluginListenerHandle } from '@capacitor/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { midiNoteChange } from './midiInput'
import { Midi, usesNativeMidi } from './nativeMidi'

interface MidiKeyboardState {
  supported: boolean
  connected: boolean
  devices: string[]
  held: Set<number>
  error: string
  connect: () => Promise<void>
}

/** Read note-on and note-off messages from connected MIDI keyboards (Web MIDI, or the app's Midi plugin). */
export function useMidiKeyboard(
  onNoteOn: (note: number, held: Set<number>, velocity: number) => void,
  onNoteOff: (note: number) => void,
): MidiKeyboardState {
  const [connected, setConnected] = useState(false)
  const [devices, setDevices] = useState<string[]>([])
  const [held, setHeld] = useState(new Set<number>())
  const [error, setError] = useState('')
  const accessRef = useRef<MIDIAccess | null>(null)
  const heldRef = useRef(new Set<number>())
  const callbackRef = useRef({ onNoteOn, onNoteOff })
  const nativeHandlesRef = useRef<PluginListenerHandle[]>([])

  useEffect(() => { callbackRef.current = { onNoteOn, onNoteOff } }, [onNoteOn, onNoteOff])

  /** Track held notes from one MIDI message and report note-on and note-off changes. */
  const handleMessage = useCallback((data: Uint8Array | readonly number[]) => {
    const change = midiNoteChange(data)
    if (!change) return
    const next = new Set(heldRef.current)
    if (change.pressed) next.add(change.note)
    else next.delete(change.note)
    heldRef.current = next
    setHeld(next)
    if (change.pressed) callbackRef.current.onNoteOn(change.note, next, change.velocity)
    else callbackRef.current.onNoteOff(change.note)
  }, [])

  /** Release every held note when the last keyboard goes away. */
  const releaseAll = useCallback(() => {
    for (const note of heldRef.current) callbackRef.current.onNoteOff(note)
    heldRef.current = new Set()
    setHeld(new Set())
  }, [])

  /** Attach every active input and update names after a device changes state. */
  const refresh = useCallback(() => {
    const access = accessRef.current
    if (!access) return
    const inputs = [...access.inputs.values()].filter((input) => input.state === 'connected')
    setDevices(inputs.map((input) => input.name ?? 'MIDI keyboard'))
    if (!inputs.length) releaseAll()
    for (const input of inputs) {
      input.onmidimessage = (event) => { if (event.data) handleMessage(event.data) }
    }
  }, [handleMessage, releaseAll])

  /** Request MIDI permission only after the player presses Connect. */
  const connect = useCallback(async () => {
    if (usesNativeMidi()) {
      try {
        const handles = await Promise.all([
          Midi.addListener('message', ({ data }) => handleMessage(data)),
          Midi.addListener('devices', ({ devices: names }) => { setDevices(names); if (!names.length) releaseAll() }),
        ])
        nativeHandlesRef.current = handles
        const { devices: names } = await Midi.start()
        setDevices(names)
        setConnected(true)
        setError('')
      } catch (cause) {
        setError(`MIDI access failed: ${String(cause)}`)
      }
      return
    }
    if (!navigator.requestMIDIAccess) {
      setError('Web MIDI is unavailable in this browser. Use a browser with MIDI support or a native app.')
      return
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      accessRef.current = access
      access.onstatechange = refresh
      setConnected(true)
      setError('')
      refresh()
    } catch (cause) {
      setError(`MIDI access failed: ${String(cause)}`)
    }
  }, [refresh, handleMessage, releaseAll])

  useEffect(() => () => {
    for (const handle of nativeHandlesRef.current) void handle.remove()
    if (nativeHandlesRef.current.length) void Midi.stop()
    const access = accessRef.current
    if (!access) return
    access.onstatechange = null
    for (const input of access.inputs.values()) input.onmidimessage = null
  }, [])

  return {
    supported: usesNativeMidi() || (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'),
    connected, devices, held, error, connect,
  }
}
