// The scale ideas of a song: the card before an improvising step (Lessons) and the panel under
// the sheet of Free Improvisation, which follows the music: the scale of the chord sounding (any
// song), and for a lesson song the ideas of the part being played, or all of them.

import { useState } from 'react'
import type { Chord } from '../music/chords'
import { chordScale } from '../exercises/toneColors'
import { useDisplay } from '../ui/display'
import { describeScale, inKey, sectionAt, type ScaleMap, type ScaleSection } from './scaleMaps'

/** The ideas of one part of a song, in the key played. */
function SectionIdeas({ section, keyPc, current }: { section: ScaleSection; keyPc: number; current?: boolean }) {
  return (
    <div className={`scale-section${current ? ' scale-section-current' : ''}`}>
      <strong>{section.label}</strong>
      <ul>
        {section.ideas.map((idea) => (
          <li key={idea.scale + idea.over}>
            <span className="scale-name">{inKey(idea.scale, keyPc)}</span> over {inKey(idea.over, keyPc)}.{' '}
            <span className="scale-why">{inKey(idea.why, keyPc)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Before an improvising step: a button that opens the unit's new idea, then the song's map, part by part (in the key the step plays). */
export function ScaleMapCard({ map, keyPc }: { map: ScaleMap; keyPc: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="scale-card">
      <button className="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Scale ideas for this song
      </button>
      {open && <>
        <p><strong>{map.unit}'s new idea.</strong> {map.idea}</p>
        {map.sections.map((section) => <SectionIdeas key={section.label} section={section} keyPc={keyPc} />)}
      </>}
    </div>
  )
}

/**
 * Under the sheet: the scale of the chord sounding, then the lesson song's ideas for the part
 * being played (or all of them, with Show all). It stays in view at the bottom while the sheet
 * scrolls, unless the Display menu leaves it under the sheet; with no lesson map it shows only
 * while a chord sounds.
 */
export function ScalePanel({ map, mapKey, songKey, bar, chord, next }: {
  map?: ScaleMap
  mapKey: number // the key the map's notes are named in (its tonic, transposed)
  songKey: number // the key of the bar sounding, for the spelling of the chord's scale
  bar: number | null // the written bar sounding
  chord: Chord | null // the chord sounding, and the one after it
  next: Chord | null
}) {
  const [all, setAll] = useState(false)
  const section = map && bar !== null ? sectionAt(map, bar) : undefined
  const shown = !map ? [] : all ? map.sections : section ? [section] : []
  const place = useDisplay().scalePanel
  if (!map && !chord) return null
  return (
    <section className={`scale-panel${place === 'fixed' ? ' scale-panel-fixed' : ''}`} aria-label="Scales">
      {chord && <p className="scale-now"><strong>Now:</strong> {describeScale(chord, chordScale(chord, next), songKey)}</p>}
      {map && <>
        <div className="scale-panel-head">
          <strong>Scale ideas for this song</strong>
          <button className="chip" aria-pressed={all} onClick={() => setAll(!all)}>{all ? 'Show the part playing' : 'Show all'}</button>
        </div>
        {all && <p className="scale-idea">{map.unit}'s new idea: {map.idea}</p>}
        {shown.map((part) => <SectionIdeas key={part.label} section={part} keyPc={mapKey} current={part === section} />)}
        {!shown.length && <p className="sight-hint">Press play: the ideas of the part being played show here.</p>}
      </>}
    </section>
  )
}
