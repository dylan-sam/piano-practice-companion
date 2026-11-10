// The hand-over of an endless line of progressions (Chord and Lick Sightreading): each chunk is
// prepared while the one before plays, loaded ahead on the player's second synthesizer, and
// started on the bar line, so the band never stops between two chunks.

import { useMemo, useRef, type RefObject } from 'react'
import type { Player } from '../audio/player'
import { BASE_BPM, type Arrangement } from '../engine/arrange'

// The next chunk starts this much MIDI time before the playing one ends: it follows the
// synthesizer's clock, which runs ahead of what is heard
const SWITCH_LEAD_SECONDS = 0.06

/** A chunk ready to play: its arrangement, and whatever else the screen keeps with it. */
interface Chunk { arrangement: Arrangement }

/**
 * The state of an endless line: whether it goes on, the chunk prepared next, when the playing
 * chunk ends, whether it began with a count-in, and whether it already handed over.
 */
export function useEndlessLine<C extends Chunk>(playerRef: RefObject<Player | null>) {
  const goesOn = useRef(false) // the line goes on with its next chunk
  const next = useRef<C | null>(null)
  const chunkEnd = useRef(Infinity) // the beat at which the playing chunk ends
  const countIn = useRef(true) // whether the playing chunk (or song) began with a count-in
  const handedOver = useRef(false) // the playing chunk already handed over to the next one

  // The same object on every render (it only holds refs), so screens can use it in callbacks
  return useMemo(() => ({
    goesOn,
    countIn,
    /** The chunk prepared next, if any. */
    get prepared() { return next.current },

    /** Keep the next chunk, and load it ahead on the second synthesizer (null forgets it). */
    prepare(chunk: C | null) {
      next.current = chunk
      if (chunk) void playerRef.current?.queue(chunk.arrangement.midi)
    },

    /** A chunk (or song) starts playing: it ends after `totalBeats`. */
    started(totalBeats: number, withCountIn: boolean) {
      chunkEnd.current = totalBeats
      countIn.current = withCountIn
      handedOver.current = false
    },

    /** Whether it is time to hand over to the next chunk (checked on every frame while playing). */
    due(): boolean {
      const player = playerRef.current
      return goesOn.current && !handedOver.current && !!player &&
        (player.position + SWITCH_LEAD_SECONDS) * BASE_BPM / 60 >= chunkEnd.current
    },

    /** The song ended without handing over (a missed switch): whether the line should go on now. */
    missed(): boolean {
      return goesOn.current && !handedOver.current
    },

    /** The hand-over starts: the prepared chunk is taken (the caller builds one if there is none). */
    take(): C | null {
      handedOver.current = true
      const chunk = next.current
      next.current = null
      return chunk
    },

    /** Start a chunk: the one waiting on the second synthesizer at once, any other once loaded. */
    async play(chunk: C): Promise<void> {
      const player = playerRef.current
      if (!player) return
      if (!player.startQueued(chunk.arrangement.midi)) await player.play(chunk.arrangement.midi)
    },

    /** The line stops: no chunk follows. */
    stop() {
      goesOn.current = false
      next.current = null
    },
  }), [playerRef])
}
