// Play a chord or a scale on the live piano (the MIDI keyboard's channel), for the chord helper's
// Hear buttons. A new request stops the one before.

import { useCallback, type RefObject } from 'react'
import type { Player } from './player'

const CHORD_MS = 1400 // how long a chord rings
const STEP_MS = 230 // the gap between the notes of a scale
const NOTE_MS = 260 // how long each scale note rings

let pending: number[] = []
let sounding: { player: Player; notes: number[] } | null = null

/** Release the notes still sounding and cancel the ones still to come. */
function silence(): void {
  for (const timer of pending) window.clearTimeout(timer)
  pending = []
  if (sounding) for (const note of sounding.notes) sounding.player.liveNoteOff(note)
  sounding = null
}

/** Play the notes together (a chord) or one after another (a scale). */
export function hearNotes(player: Player, notes: number[], together: boolean): void {
  silence()
  sounding = { player, notes }
  const at = (ms: number, act: () => void) => pending.push(window.setTimeout(act, ms))
  notes.forEach((note, i) => {
    const start = together ? 0 : i * STEP_MS
    at(start, () => player.liveNoteOn(note, together ? 70 : 80))
    at(start + (together ? CHORD_MS : NOTE_MS), () => player.liveNoteOff(note))
  })
  at((together ? CHORD_MS : notes.length * STEP_MS + NOTE_MS) + 10, () => { sounding = null })
}

/** The chord helper's Hear: playing on the screen's player, or nothing until its sound is ready. */
export function useHear(playerRef: RefObject<Player | null>, ready: boolean): ((notes: number[], together: boolean) => void) | undefined {
  const hear = useCallback((notes: number[], together: boolean) => {
    if (playerRef.current) hearNotes(playerRef.current, notes, together)
  }, [playerRef])
  return ready ? hear : undefined
}
