// React hooks shared by every screen that plays the band: the sound bank player and its clock.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { BASE_BPM } from '../engine/arrange'
import { reportError } from '../errorReports'
import type { Readiness } from '../ui/Transport'
import type { Player } from './player'
import { markActivity } from '../library/practiceLog'

/**
 * Create the player for a screen: load the sound bank with progress, decode the band's
 * sounds in the background, and close the audio when the screen goes away.
 * The screen owns `playerRef` (a useRef) and uses it to play; this hook fills it.
 * `onEnded` and `warmUpSongs` are read when needed, so they may change between renders.
 */
export function usePlayer(
  playerRef: RefObject<Player | null>,
  onEnded: () => void,
  warmUpSongs: () => Uint8Array[],
): Readiness {
  const [readiness, setReadiness] = useState<Readiness>({ kind: 'loading', progress: 0 })
  const callbacks = useRef({ onEnded, warmUpSongs })
  useEffect(() => {
    // Keep the latest callbacks without restarting the player
    callbacks.current = { onEnded, warmUpSongs }
  })

  useEffect(() => {
    // The effect may run twice (StrictMode); a discarded player must not update the UI
    let active = true
    let player: Player | null = null
    let practiceTimer = 0
    // The audio engine (SpessaSynth) is loaded after the screen is drawn, so the screen shows first
    void (async () => {
      try {
        const { Player } = await import('./player')
        if (!active) return
        player = new Player()
        playerRef.current = player
        player.onEnded = () => callbacks.current.onEnded()
        await player.init((progress) => active && setReadiness({ kind: 'loading', progress }))
        if (!active) return
        setReadiness({ kind: 'ready' })
        void player.warmUp(callbacks.current.warmUpSongs())
        // The band playing counts as practice (home screen statistics)
        practiceTimer = window.setInterval(() => { if (player?.isPlaying) markActivity() }, 5000)
      } catch (err: unknown) {
        if (!active) return
        setReadiness({ kind: 'error', message: String(err) })
        reportError(err, 'sound bank')
      }
    })()
    return () => {
      active = false
      window.clearInterval(practiceTimer)
      if (player && playerRef.current === player) playerRef.current = null
      void player?.dispose()
    }
  }, [playerRef])

  return readiness
}

/**
 * While `active`, call `onBeat` on every animation frame with the beat being heard
 * (the output plays a little behind the synthesizer), counted at the base tempo.
 */
export function useHeardBeat(active: boolean, playerRef: RefObject<Player | null>, onBeat: (beat: number) => void): void {
  const callback = useRef(onBeat)
  useEffect(() => {
    // Keep the latest callback without restarting the animation loop
    callback.current = onBeat
  })

  useEffect(() => {
    if (!active) return
    let frame = 0
    // Report the heard beat, then wait for the next frame
    const tick = () => {
      const player = playerRef.current
      if (player) callback.current((player.heardPosition * BASE_BPM) / 60)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, playerRef])
}

/**
 * Pause, as in a music player: where the band was paused (seconds of MIDI time), so that Play
 * goes on from there; null when the next Play starts from the beginning. `hold` keeps the
 * band's position (call it before stopping the player), `forget` makes the next Play start over
 * (a new song, a new sheet, the end of the song, the start-again button). `holdAt` sets a start
 * point chosen on the sheet, with a mark naming it (the chord to draw as the start).
 */
export function usePausedAt(playerRef: RefObject<Player | null>) {
  const [paused, setPaused] = useState<{ at: number; mark: string | null } | null>(null)
  const hold = useCallback(() => {
    const at = playerRef.current?.position
    setPaused(at ? { at, mark: null } : null)
  }, [playerRef])
  // A start point chosen on the sheet (a chord), with a mark naming it
  const holdAt = useCallback((at: number, mark: string) => setPaused({ at, mark }), [])
  const forget = useCallback(() => setPaused(null), [])
  return { pausedAt: paused?.at ?? null, mark: paused?.mark ?? null, hold, holdAt, forget }
}
