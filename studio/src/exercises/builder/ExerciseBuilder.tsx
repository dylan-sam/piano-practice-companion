// The exercise builder's panel, in the list of Exercises Sightreading: the family of the exercise
// and its settings (each change writes the exercise again on the stand), and its presets: save
// the settings under a name, rename or change one's own preset, delete a preset. An exercise
// opened from a lesson step keeps the step's settings (`locked`).

import { useState, type ReactNode } from 'react'
import { prettyChordText } from '../../music/chordText'
import {
  APPROACH_CHORD_NAMES, APPROACHES, CHORDS, DIRECTIONS, exerciseTitle, FAMILIES, FAMILY_DEFAULTS, FIGURES, fit, INTERVALS, LINES,
  MOVES, NOTE_SETS, ORDERS, PROGRESSIONS, RHYTHMS, SCALE_PATTERNS, specText, type ExercisePreset, type ExerciseSpec, type Family,
} from './exerciseBuilder'
import { SCALES } from './exerciseMusic'
import { addPreset, deletePreset, isExample, updatePreset } from './exercisePresets'

const KEY_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const KEY_COUNTS = [2, 3, 4, 6, 12]

/** One setting: a label and a menu of choices. */
function Choice<T extends string | number>({ label, value, options, onChange, disabled }: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <label className="builder-field">
      <span className="label">{label}</span>
      <select className="select" aria-label={label} value={String(value)} disabled={disabled}
        onChange={(e) => onChange((typeof value === 'number' ? Number(e.target.value) : e.target.value) as T)}>
        {options.map(([id, text]) => <option key={String(id)} value={String(id)}>{text}</option>)}
      </select>
    </label>
  )
}

/** The settings of each family. */
function FamilySettings({ spec, set, disabled }: { spec: ExerciseSpec; set: (change: Partial<ExerciseSpec>) => void; disabled: boolean }) {
  const rhythm = <Choice label="Rhythm" value={spec.rhythm} disabled={disabled} onChange={(value) => set({ rhythm: value })}
    options={Object.entries(RHYTHMS).map(([id, item]) => [id as ExerciseSpec['rhythm'], item.label])} />
  const direction = <Choice label="Direction" value={spec.direction} disabled={disabled} onChange={(value) => set({ direction: value })}
    options={Object.entries(DIRECTIONS).filter(([id]) => spec.family === 'arpeggio' || id !== 'alternate')
      .map(([id, text]) => [id as ExerciseSpec['direction'], text])} />
  const fields: Record<Family, ReactNode> = {
    arpeggio: <>
      <Choice label="Chord" value={spec.chord} disabled={disabled} onChange={(value) => set({ chord: value })}
        options={Object.entries(CHORDS).map(([id, item]) => [id, `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} ${item.kind === 'triad' ? 'triad' : 'chord'}`])} />
      <Choice label="Notes" value={spec.notes} disabled={disabled} onChange={(value) => set({ notes: value })}
        options={Object.entries(NOTE_SETS).filter(([, set]) => set.kind === CHORDS[spec.chord].kind).map(([id]) => [id, id])} />
      <Choice label="Starting on" value={spec.start} disabled={disabled} onChange={(value) => set({ start: value })}
        options={NOTE_SETS[spec.notes].degrees.map((degree, i) => [i, `The ${degree === 1 ? 'root' : `${degree}${degree === 3 ? 'rd' : 'th'}`}`])} />
      {direction}
      {rhythm}
    </>,
    scale: <>
      <Choice label="Scale" value={spec.scale} disabled={disabled} onChange={(value) => set({ scale: value })}
        options={SCALES.map((scale) => [scale.name, prettyChordText(`${scale.name} (${scale.chord})`)])} />
      <Choice label="Pattern" value={spec.pattern} disabled={disabled} onChange={(value) => set({ pattern: value })}
        options={Object.entries(SCALE_PATTERNS).map(([id, item]) => [id, item.label])} />
      {direction}
      {rhythm}
      <Choice label="Range" value={spec.octaves} disabled={disabled} onChange={(value) => set({ octaves: value })} options={[[1, 'One octave'], [2, 'Two octaves']]} />
    </>,
    line: <>
      <Choice label="Progression" value={spec.progression} disabled={disabled} onChange={(value) => set({ progression: value })}
        options={Object.entries(PROGRESSIONS).map(([id, item]) => [id, prettyChordText(item.name)])} />
      <Choice label="Line" value={spec.line} disabled={disabled} onChange={(value) => set({ line: value })}
        options={Object.entries(LINES).map(([id, item]) => [id, `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)}`])} />
    </>,
    approach: <>
      <Choice label="Chord" value={spec.chord} disabled={disabled} onChange={(value) => set({ chord: value })}
        options={Object.entries(APPROACH_CHORD_NAMES)} />
      <Choice label="Approach" value={spec.approach} disabled={disabled} onChange={(value) => set({ approach: value })}
        options={Object.entries(APPROACHES).map(([id, item]) => [id, `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)}`])} />
    </>,
    interval: <>
      <Choice label="Interval" value={spec.interval} disabled={disabled} onChange={(value) => set({ interval: value })}
        options={Object.entries(INTERVALS).map(([id, text]) => [Number(id), `${text.charAt(0).toUpperCase()}${text.slice(1)}`])} />
      <Choice label="Order" value={spec.order} disabled={disabled} onChange={(value) => set({ order: value })}
        options={Object.entries(ORDERS).map(([id, text]) => [id, `${text.charAt(0).toUpperCase()}${text.slice(1)}`])} />
      {rhythm}
    </>,
    rhythm: <Choice label="Rhythm figure" value={spec.figure} disabled={disabled} onChange={(value) => set({ figure: value })}
      options={Object.entries(FIGURES).map(([id, item]) => [id, `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)}`])} />,
  }
  return fields[spec.family]
}

/** The panel. */
export function ExerciseBuilder({ spec, preset, locked, onChange, onSaved, onDeleted, onClose }: {
  spec: ExerciseSpec // the exercise on the stand (or the builder's starting one)
  preset: ExercisePreset | null // the preset it was opened from, if any
  locked: boolean // set by a lesson step
  onChange: (spec: ExerciseSpec) => void // write the exercise again
  onSaved: (preset: ExercisePreset) => void // a preset saved: show it in the list
  onDeleted: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(preset?.name ?? '')
  const [deleting, setDeleting] = useState(false)
  const own = !!preset && !isExample(preset.id)
  const changed = !!preset && specText(spec) !== preset.spec
  /** Change some settings, made to fit together. */
  const set = (change: Partial<ExerciseSpec>) => onChange(fit({ ...spec, ...change }))
  const title = exerciseTitle(spec)

  return (
    <section className="builder" aria-label="Exercise builder">
      <div className="playlist-panel-head">
        <strong>Build an exercise</strong>
        <button className="library-import" onClick={onClose}>Close</button>
      </div>
      {locked && <p className="library-more">This exercise is set by the lesson step: its settings cannot be changed here.</p>}
      <div className="builder-fields">
        <Choice label="Kind" value={spec.family} disabled={locked}
          onChange={(family) => onChange({ ...FAMILY_DEFAULTS[family], key: spec.key })}
          options={Object.entries(FAMILIES).map(([id, text]) => [id as Family, text])} />
        <FamilySettings spec={spec} set={set} disabled={locked} />
        <Choice label="Key" value={spec.key} disabled={locked} onChange={(value) => set({ key: value })}
          options={KEY_NAMES.map((text, pc) => [pc, text])} />
        <Choice label="Then" value={spec.move} disabled={locked}
          onChange={(value) => set({ move: value, keys: value === 'none' ? 1 : value === 'diatonic' ? 1 : spec.keys > 1 ? spec.keys : 12 })}
          options={Object.entries(MOVES).filter(([id]) => id !== 'diatonic' || spec.family === 'arpeggio').map(([id, item]) => [id as ExerciseSpec['move'], item.label])} />
        {spec.move !== 'none' && spec.move !== 'diatonic' && <Choice label="Keys" value={spec.keys} disabled={locked}
          onChange={(value) => set({ keys: value })} options={KEY_COUNTS.map((count) => [count, count === 12 ? 'All 12 keys' : `${count} keys`])} />}
      </div>
      {!locked && <div className="builder-save">
        <input className="library-search" value={name} placeholder={title} aria-label="Preset name"
          onChange={(e) => setName(e.target.value)} />
        <div className="builder-buttons">
          {own && <button className="button button-primary" disabled={!changed && name.trim() === preset.name}
            onClick={() => { updatePreset(preset.id, { name: name.trim() || preset.name, spec: specText(spec) }); onSaved({ ...preset, name: name.trim() || preset.name, spec: specText(spec) }) }}>
            Save changes
          </button>}
          <button className={own ? 'button' : 'button button-primary'}
            onClick={() => onSaved(addPreset(own && name.trim() === preset.name ? `${name.trim()} (copy)` : name.trim() || title, specText(spec)))}>
            Save as a new preset
          </button>
          {preset && (deleting
            ? <button className="library-remove library-remove-confirm" onClick={() => { deletePreset(preset.id); setDeleting(false); onDeleted() }}
              onBlur={() => setDeleting(false)}>Delete {preset.name}?</button>
            : <button className="library-remove" onClick={() => setDeleting(true)}>Delete preset</button>)}
        </div>
      </div>}
    </section>
  )
}
