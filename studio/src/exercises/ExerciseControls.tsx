// Controls shared by the exercise screens (ear training and sightreading): the key menu of the
// bottom bar, the key references, the screen's status messages, the MIDI notes held, the
// buttons choosing where the music comes from, and the random song picker.

import { useState } from 'react'
import type { useMidiKeyboard } from '../audio/useMidiKeyboard'
import type { CatalogProgression } from '../library/scoreSearch'
import { prettyNoteName, spellRoot } from '../music/chords'
import type { Readiness } from '../ui/Transport'
import { keyReferences, type KeyChoice, type KeyReference } from './nameProgression'

/**
 * The Key menu of the bottom bar: the source's key, a random key, or one of the twelve keys. The
 * chosen key is shown beside the first two. With `fixed`, a text replaces the menu (the key
 * cannot be chosen: hidden, or set by an endless line of progressions).
 */
export function KeyChoiceControl({ choice, onChoose, sourceKey, currentKey, sourceLabel = 'Song key', fixed }: {
  choice: KeyChoice
  onChoose: (choice: KeyChoice) => void
  sourceKey: number | null // the key of the song (or excerpt) on the stand, when there is one
  currentKey: number // the key it is played in
  sourceLabel?: string
  fixed?: string
}) {
  if (fixed) {
    return <div className="control"><span className="label">Key</span><span className="sight-key">{fixed}</span></div>
  }
  return (
    <label className="control"><span className="label">Key</span>
      <select className="select" value={String(choice)} onChange={(event) => {
        const value = event.target.value
        onChoose(value === 'song' || value === 'random' ? value : Number(value))
      }}>
        <option value="song">{sourceLabel}{sourceKey !== null && choice === 'song' ? ` (${prettyNoteName(sourceKey)})` : ''}</option>
        <option value="random">Random key{sourceKey !== null && choice === 'random' ? ` (${prettyNoteName(currentKey)})` : ''}</option>
        {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{prettyNoteName(pc)}</option>)}
      </select>
    </label>
  )
}

// Button text of each key reference: in full when both cadences are offered (the mode is not
// known), short otherwise
const REFERENCE_LABELS: Record<KeyReference, { text: string; short: string }> = {
  tonic: { text: 'Tonic', short: 'Tonic' },
  'major cadence': { text: 'Major cadence (I–IV–V–I)', short: 'Cadence' },
  'minor cadence': { text: 'Minor cadence (i–iv–V–i)', short: 'Cadence' },
}

/**
 * "Hear the key": the tonic and the cadence of the mode (both cadences when the mode is not known),
 * with their keyboard shortcuts (`shortcuts`, in button order) in the tooltips.
 */
export function KeyReferenceButtons({ minor, shortcuts, playing, disabled, onPlay }: {
  minor: boolean | null
  shortcuts: string[]
  playing: string | null // what plays now: its button is pressed
  disabled: boolean
  onPlay: (reference: KeyReference) => void
}) {
  return (
    <div className="answers-reference" role="group" aria-label="Hear the key">
      <span className="label">Hear the key</span>
      {keyReferences(minor).map((reference, i) => {
        const label = REFERENCE_LABELS[reference]
        return (
          <button key={reference} className="band-toggle" onClick={() => onPlay(reference)}
            disabled={disabled} aria-pressed={playing === reference} title={`${label.text} (${shortcuts[i]})`}>
            {minor === null ? label.text : label.short}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The messages above an exercise: an error, the sounds loading, and what the MIDI keyboard needs
 * (a browser without Web MIDI is mentioned only where the keyboard is needed, `midiNeeded`).
 */
export function ExerciseStatus({ error, readiness, keyboard, midiNeeded = true }: {
  error: string
  readiness: Readiness
  keyboard?: ReturnType<typeof useMidiKeyboard>
  midiNeeded?: boolean
}) {
  return (
    <>
      {error && <p className="exercise-error" role="alert">{error}</p>}
      {readiness.kind === 'loading' && <p className="sight-hint">Loading sounds {Math.round(readiness.progress * 100)}%...</p>}
      {readiness.kind === 'error' && <p className="exercise-error" role="alert">{readiness.message}</p>}
      {keyboard?.error && <p className="exercise-error" role="alert">{keyboard.error}</p>}
      {keyboard && midiNeeded && !keyboard.supported && (
        <p className="sight-hint">This browser does not expose Web MIDI. A compatible browser or native MIDI input is needed to score notes.</p>
      )}
    </>
  )
}

/** The MIDI keys held now, spelled in the key on the stand (F-sharp rather than G-flat in E). */
export function HeldNotes({ held, keyPc }: { held: Set<number>; keyPc: number }) {
  const names = [...held].sort((a, b) => a - b).map((note) =>
    `${spellRoot(note % 12, keyPc).replace('b', '♭').replace('#', '♯')}${Math.floor(note / 12) - 1}`)
  return <p className="sight-midi-status" role="status">MIDI notes held: {names.length ? names.join(' · ') : 'none'}</p>
}

/** The buttons choosing where the music comes from (Pick a song, Random song...): `shown` is pressed. */
export function SourceButtons<M extends string>({ modes, shown, onChoose, label }: {
  modes: { id: M; text: string }[]
  shown: M
  onChoose: (mode: M) => void
  label: string
}) {
  return (
    <div className="sight-mode" role="group" aria-label={label}>
      {modes.map(({ id, text }) => (
        <button key={id} className="chip" aria-pressed={shown === id} onClick={() => onChoose(id)}>{text}</button>
      ))}
    </div>
  )
}

/** A random song of the catalog, if you like one containing a chosen progression. */
export function RandomSongPicker({ catalog, onChoose }: {
  catalog: CatalogProgression[]
  onChoose: (progressionId: string) => void
}) {
  const [progressionId, setProgressionId] = useState('')
  return (
    <div className="sight-picker">
      <label className="control"><span className="label">Train a progression (optional)</span>
        <select className="select" value={progressionId} onChange={(event) => setProgressionId(event.target.value)}>
          <option value="">Any progression</option>
          {catalog.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.unique_song_count} songs)</option>)}
        </select>
      </label>
      <button className="button button-primary" onClick={() => onChoose(progressionId)}>Choose random song</button>
    </div>
  )
}
