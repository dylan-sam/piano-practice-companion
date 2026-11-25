import { PULSE } from './meter'
import { toTicks, type NoteEvent } from './events'
import type { TrackSpec } from './midiWriter'
import type { Timeline } from './timeline'

// The metronome (adapted from OpenStand's click part): its own channel, a percussion part like
// the drums (midiWriter's GS rhythm-part message), so the mixer sets it apart from the drums
export const CLICK_CHANNEL = 4

// General MIDI percussion notes of the sound font: the metronome bell on the downbeat, the click on the other beats
const ACCENT_NOTE = 34
const BEAT_NOTE = 33

// Both metronome sounds, for the warm-up that loads them before playback
export const CLICK_NOTES = [ACCENT_NOTE, BEAT_NOTE]

/** The beats a metronome clicks in a bar: every beat, or every dotted quarter in 6/8, 9/8 and 12/8. */
export function clickBeats(bar: { beats: number; compound?: boolean }): number[] {
  const step = bar.compound ? PULSE : 1
  return Array.from({ length: Math.max(1, Math.round(bar.beats / step - 1e-6)) }, (_, index) => index * step)
    .filter((at) => at < bar.beats - 1e-6)
}

/** A click on every beat of the song's bars, accented on each downbeat (none in the band's ending). */
export function generateClicks(timeline: Timeline): NoteEvent[] {
  return timeline.bars.filter((bar) => bar.measure >= 0).flatMap((bar) => clickBeats(bar).map((at, index) => ({
    tick: toTicks(bar.start + at),
    channel: CLICK_CHANNEL,
    note: index === 0 ? ACCENT_NOTE : BEAT_NOTE,
    velocity: index === 0 ? 120 : 100,
    duration: toTicks(0.25),
  })))
}

/** The metronome track of a song's MIDI file, always written: the mixer's Click part is muted until you turn it on. */
export function clickTrack(timeline: Timeline): TrackSpec {
  return { name: 'Click', channel: CLICK_CHANNEL, program: 0, pan: 64, reverb: 0, drums: true, events: generateClicks(timeline) }
}
