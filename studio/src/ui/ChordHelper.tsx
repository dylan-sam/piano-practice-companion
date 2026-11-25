// The chord helper: tap a chord on the sheet to see it on a keyboard with the scales to
// improvise with over it, best first (exercises/scaleSuggestions.ts): the chord's scale where it
// is, its pentatonic, the key's scales, then other good choices. Idea and keyboard drawing from
// OpenStand's chord helper (keyboard only, no guitar); the choice of scales is the app's own.

import { useEffect, useState, type ReactNode } from 'react'
import { scaleSuggestions, type ScaleSuggestion, type SuggestionKind } from '../exercises/scaleSuggestions'
import { chordTones, type Chord } from '../music/chords'
import type { KeyCentre } from '../music/roman'
import { prettyNote, scaleRootName, spellChordTones, spellScale } from '../music/scales'
import { ChordSymbol } from './ChordSymbol'
import { useDisplay } from './display'
import type { HelperPlace, useChordHelper } from './useChordHelper'

/** A chord of the tapped bar, as the band plays it, with the chord after it. */
export interface HelperChord { chord: Chord; next: Chord | null; chordIndex: number; written?: Chord /* a substitute's written chord */ }

// The groups of the scale list, in order
const GROUPS: { kind: SuggestionKind; title: string }[] = [
  { kind: 'chord', title: 'For this chord' },
  { kind: 'key', title: 'From the key' },
  { kind: 'more', title: 'Also good' },
]

// The keyboard: two octaves from C; white keys 20 units wide (OpenStand's drawing)
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_PCS = [{ pc: 1, after: 0 }, { pc: 3, after: 1 }, { pc: 6, after: 3 }, { pc: 8, after: 4 }, { pc: 10, after: 5 }]
const OCTAVES = 2

/** The chord's tones as keys of the drawing: the root in the first octave, the others above it. */
function chordKeys(chord: Chord): Set<number> {
  return new Set(chordTones(chord).map((interval) => chord.root + interval).filter((key) => key < OCTAVES * 12))
}

/** Two octaves of keys: the chord's tones marked, the scale's notes dotted. */
function Keyboard({ chord, scale, label }: { chord: Chord; scale: ScaleSuggestion; label: string }) {
  const tones = chordKeys(chord)
  const inScale = new Set(scale.steps.map((step) => (scale.root + step) % 12))
  const whites = Array.from({ length: OCTAVES }, (_, octave) => WHITE_PCS.map((pc, i) => ({ key: octave * 12 + pc, x: (octave * 7 + i) * 20 }))).flat()
  const blacks = Array.from({ length: OCTAVES }, (_, octave) => BLACK_PCS.map(({ pc, after }) => ({ key: octave * 12 + pc, x: (octave * 7 + after + 1) * 20 - 6 }))).flat()
  return (
    <svg className="helper-keyboard" viewBox={`0 0 ${OCTAVES * 140} 74`} role="img" aria-label={label}>
      {whites.map(({ key, x }) => (
        <g key={key}>
          <rect x={x} y={0} width={20} height={74} className={tones.has(key) ? 'key-white key-chord' : 'key-white'} />
          {tones.has(key) && <circle cx={x + 10} cy={58} r={5} className="key-tone" />}
          {inScale.has(key % 12) && <circle cx={x + 10} cy={58} r={2.2} className="key-scale" />}
        </g>
      ))}
      {blacks.map(({ key, x }) => (
        <g key={key}>
          <rect x={x} y={0} width={12} height={45} rx={1.5} className={tones.has(key) ? 'key-black key-chord' : 'key-black'} />
          {tones.has(key) && <circle cx={x + 6} cy={33} r={4.4} className="key-tone key-tone-black" />}
          {inScale.has(key % 12) && <circle cx={x + 6} cy={33} r={2} className="key-scale key-scale-black" />}
        </g>
      ))}
    </svg>
  )
}

/** The notes of a scale, spelled in the key (G A♭ B C D E♭ F). */
function scaleNoteNames(scale: ScaleSuggestion, keyPc: number): string[] {
  return spellScale(scaleRootName(scale.root, keyPc), scale.steps).map(prettyNote)
}

/** A scale's name with its root (G Mixolydian). */
const scaleTitle = (scale: ScaleSuggestion, keyPc: number) => `${prettyNote(scaleRootName(scale.root, keyPc))} ${scale.name}`

/** What the screen's helper state (useChordHelper) gives the panel: following the chord playing, and more scales. */
export interface HelperToggles {
  follow: boolean
  setFollow: (on: boolean) => void
  more: boolean
  setMore: (on: boolean) => void
}

/**
 * The helper's panel for a bar: one tab per chord of the bar, the chord on a keyboard, and its
 * scales (those for this chord; Show more scales adds the key's and other good ones); `onHear`
 * plays notes on the piano (absent before the sound is ready); `actions` are the screen's own
 * buttons (Start from here). Draw it again with a new key for each chord, so the scale picked
 * goes back to the first choice.
 */
export function ChordHelper({ chords, selected, onSelect, keyCentre, toggles, onClose, onHear, actions }: {
  chords: HelperChord[]
  selected: number // the chordIndex shown
  onSelect: (chordIndex: number) => void
  keyCentre: KeyCentre | null // the key in force in the bar, as played
  toggles: HelperToggles
  onClose: () => void
  onHear?: (notes: number[], together: boolean) => void
  actions?: (chordIndex: number) => ReactNode
}) {
  const display = useDisplay()
  const [scaleAt, setScaleAt] = useState(0)
  useEffect(() => {
    // Escape closes the helper, as it closes the menus
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const current = chords.find((c) => c.chordIndex === selected) ?? chords[0]
  if (!current) return null
  const keyPc = keyCentre?.tonic ?? current.chord.root
  const scales = scaleSuggestions(current.chord, current.next, keyCentre)
    .filter((suggestion) => toggles.more || suggestion.kind === 'chord')
  const scale = scales[Math.min(scaleAt, scales.length - 1)]
  const notation = { minor: display.minor, romanKey: null }
  const toneNames = spellChordTones(current.chord, keyPc).map(prettyNote)
  // The chord voiced from middle C's octave, and the scale up an octave and back to its root
  const chordNotes = chordTones(current.chord).map((interval) => 60 + current.chord.root + interval)
  const scaleNotes = [...scale.steps, 12].map((step) => 60 + scale.root + step)

  return (
    <aside className="chord-helper" aria-label="Chord helper">
      <div className="helper-head">
        {chords.length > 1 ? (
          <div className="helper-tabs" role="tablist" aria-label="Chords of the bar">
            {chords.map((c) => (
              <button key={c.chordIndex} role="tab" aria-selected={c === current} className="helper-tab"
                onClick={() => onSelect(c.chordIndex)}>
                <ChordSymbol chord={c.chord} keyPc={keyPc} className="helper-chord" notation={notation} />
              </button>
            ))}
          </div>
        ) : <ChordSymbol chord={current.chord} keyPc={keyPc} className="helper-chord helper-chord-title" notation={notation} />}
        <button className="helper-close" aria-label="Close the chord helper" onClick={onClose}>×</button>
      </div>
      {current.written && (
        <p className="helper-instead">
          Played instead of <ChordSymbol chord={current.written} keyPc={keyPc} className="helper-chord-written" notation={notation} /> (Substitutions)
        </p>
      )}
      <label className="check helper-follow">
        <input type="checkbox" checked={toggles.follow} onChange={(e) => toggles.setFollow(e.target.checked)} />
        Follow the chord playing
      </label>
      <div className="helper-tones">
        <span>{toneNames.join(' ')}</span>
        {onHear && <button className="chip" onClick={() => onHear(chordNotes, true)}>▶ Hear the chord</button>}
      </div>
      <Keyboard chord={current.chord} scale={scale} label={`${toneNames.join(' ')} on the keyboard, with ${scaleTitle(scale, keyPc)}`} />
      <div className="helper-scale-notes">
        <span><strong>{scaleTitle(scale, keyPc)}</strong>: {scaleNoteNames(scale, keyPc).join(' ')}</span>
        {onHear && <button className="chip" onClick={() => onHear(scaleNotes, false)}>▶ Hear</button>}
      </div>
      <div className="helper-scales">
        {GROUPS.map(({ kind, title }) => {
          const group = scales.map((s, index) => ({ s, index })).filter(({ s }) => s.kind === kind)
          if (!group.length) return null
          return (
            <div key={kind} className="helper-group">
              <span className="helper-group-title">{title}</span>
              {group.map(({ s, index }) => (
                <button key={index} className="helper-scale" aria-pressed={index === scales.indexOf(scale)} onClick={() => setScaleAt(index)}>
                  <span className="helper-scale-name">{scaleTitle(s, keyPc)}{index === 0 && <span className="helper-badge">First choice</span>}</span>
                  <span className="helper-scale-why">{s.why}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <button className="chip helper-more" aria-expanded={toggles.more} onClick={() => toggles.setMore(!toggles.more)}>
        {toggles.more ? 'Show fewer scales' : 'Show more scales'}
      </button>
      {actions && <div className="helper-actions">{actions(current.chordIndex)}</div>}
    </aside>
  )
}

/** The screen's helper (useChordHelper) drawn as a panel when it is open. */
export function ChordHelperPanel({ helper, onHear, actions }: {
  helper: ReturnType<typeof useChordHelper>
  onHear?: (notes: number[], together: boolean) => void
  actions?: (place: HelperPlace) => ReactNode
}) {
  const { shown } = helper
  if (!shown) return null
  const { measure } = shown.place
  return (
    <ChordHelper key={`${measure}:${shown.place.chordIndex}`} chords={shown.chords} selected={shown.place.chordIndex}
      onSelect={(chordIndex) => helper.open(measure, chordIndex)} keyCentre={shown.keyCentre} toggles={helper}
      onClose={helper.close} onHear={onHear} actions={actions && ((chordIndex) => actions({ measure, chordIndex }))} />
  )
}

/**
 * The bottom bar's Chords button, beside Practice: opens the chord helper on the chord playing, or
 * closes it. In the Settings sheet of a compact bar it also closes the sheet, so the helper shows.
 */
export function ChordHelperButton({ helper }: { helper: ReturnType<typeof useChordHelper> }) {
  return (
    // In the same wrapper as Practice and Mixer (Popover), so the three line up in every layout
    <div className="popover chords-toggle">
      <button className={helper.visible ? 'band-toggle band-toggle-active' : 'band-toggle'} aria-pressed={helper.visible}
        data-closes-settings onClick={helper.toggle}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
          <path d="M5.5 3.5v5M10.5 3.5v5M8 3.5v9" />
        </svg>
        Chords
      </button>
    </div>
  )
}
