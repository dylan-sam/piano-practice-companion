// The Export menu's band track downloads: MIDI at once, WAV and MP3 rendered with a progress
// line and a Cancel button (useTrackDownload.ts). The render keeps going while the menu is closed.

import type { TrackSource, useTrackDownload } from './useTrackDownload'

/** The Export menu's three track downloads, with the render's progress. */
export function TrackDownloads({ download, source }: { download: ReturnType<typeof useTrackDownload>; source: TrackSource }) {
  const { state } = download
  const rendering = state && 'format' in state ? state : null
  return (
    <div className="track-downloads" aria-label="Download the band">
      <span className="share-group">This song, as the band plays it now</span>
      <button className="share-option" onClick={() => download.midi(source)}>
        <span className="share-name">MIDI file</span>
        <span className="share-desc">The band's parts at the song's tempo, to open in a music program. Muted parts are left out.</span>
      </button>
      {(['wav', 'mp3'] as const).map((format) => (
        <button key={format} className="share-option" disabled={!!rendering} onClick={() => void download.audio(source, format)}>
          <span className="share-name">
            {rendering?.format === format ? `Making the ${format.toUpperCase()}… ${Math.round(rendering.progress * 100)}%` : `${format.toUpperCase()} audio`}
          </span>
          <span className="share-desc">
            {format === 'wav' ? 'Full quality, a large file (about 10 MB a minute).' : 'A smaller file (about 1.5 MB a minute), for phones and music players.'}
            {' '}With the mixer's levels.
          </span>
        </button>
      ))}
      {rendering && (
        <div className="track-progress">
          <progress max={1} value={rendering.progress} aria-label={`Making the ${rendering.format.toUpperCase()}`} />
          <button className="button" onClick={download.cancel}>Cancel</button>
        </div>
      )}
      {state && 'error' in state && <p className="track-error" role="alert">Could not make the file: {state.error}</p>}
      <span className="share-desc track-note">Style, piano pattern, choruses, loop, keys and speed-up as set now.</span>
    </div>
  )
}
