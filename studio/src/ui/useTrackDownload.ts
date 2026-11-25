// The state of the band track downloads (ui/TrackDownload.tsx): MIDI at once, WAV and MP3
// rendered with progress and a way to cancel. The screen keeps it, so closing the menu does not lose it.

import { useCallback, useRef, useState } from 'react'
import type { AudioFormat, AudioMix } from '../audio/exportAudio'

/** Save a file from the page: the browser's download of a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The song to download, made when a download starts so it has the settings of that moment. */
export interface TrackSource {
  midi: () => Uint8Array // the band at the song's real tempo (exportTrack.ts)
  mix: () => AudioMix // the mixer's channel volumes and master
  filename: (extension: string) => string
}

type RenderState = { format: AudioFormat; progress: number } | { error: string } | null

/** The state of an audio download (kept by the screen, so closing the menu does not lose it) and its actions. */
export function useTrackDownload() {
  const [state, setState] = useState<RenderState>(null)
  const controller = useRef<AbortController | null>(null)

  /** Download the MIDI file at once. */
  const midi = useCallback((source: TrackSource) => {
    downloadBlob(new Blob([source.midi() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' }), source.filename('mid'))
  }, [])

  /** Render the band to WAV or MP3, then download it; another render is cancelled first. */
  const audio = useCallback(async (source: TrackSource, format: AudioFormat) => {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setState({ format, progress: 0 })
    try {
      const { renderAudio } = await import('../audio/exportAudio')
      const blob = await renderAudio(source.midi(), source.mix(), format,
        (progress) => { if (!abort.signal.aborted) setState({ format, progress }) }, abort.signal)
      downloadBlob(blob, source.filename(format))
      setState(null)
    } catch (error) {
      if (abort.signal.aborted) return
      setState({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (controller.current === abort) controller.current = null
    }
  }, [])

  /** Stop the render in progress. */
  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState(null)
  }, [])

  return { state, midi, audio, cancel }
}
