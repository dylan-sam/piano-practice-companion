// React hooks shared by every screen that plays the band: the sound bank player and its clock.

import { useEffect, useRef, useState, type RefObject } from 'react'
import { BASE_BPM } from '../engine/arrange'
import { reportError } from '../errorReports'
import type { Readiness } from '../ui/Transport'
import { Player } from './player'

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
    const player = new Player()
    playerRef.current = player
    player.onEnded = () => callbacks.current.onEnded()
    player
      .init((progress) => active && setReadiness({ kind: 'loading', progress }))
      .then(() => {
        if (!active) return
        setReadiness({ kind: 'ready' })
        void player.warmUp(callbacks.current.warmUpSongs())
      })
      .catch((err: unknown) => {
        if (!active) return
        setReadiness({ kind: 'error', message: String(err) })
        reportError(err, 'sound bank')
      })
    return () => {
      active = false
      void player.dispose()
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
