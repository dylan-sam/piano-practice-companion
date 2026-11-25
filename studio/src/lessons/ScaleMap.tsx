// The scale ideas of a lesson song: the card before an improvising step (Lessons) and the
// section under the sheet of Free Improvisation, which follows the part being played.

import { useState } from 'react'
import { inKey, sectionAt, type ScaleMap, type ScaleSection } from './scaleMaps'
import { unitName } from './program'

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
        <p><strong>{unitName(map.unit)}'s new idea.</strong> {map.idea}</p>
        {map.sections.map((section) => <SectionIdeas key={section.label} section={section} keyPc={keyPc} />)}
      </>}
    </div>
  )
}

/**
 * Under the sheet of Free Improvisation, for a lesson song: the ideas of the part being played
 * (or all of them, with Show all). It stays after the sheet; the scale of any chord is in the
 * chord helper (tap a chord).
 */
export function SongScaleIdeas({ map, mapKey, bar }: {
  map: ScaleMap
  mapKey: number // the key the map's notes are named in (its tonic, transposed)
  bar: number | null // the written bar sounding
}) {
  const [all, setAll] = useState(false)
  const section = bar !== null ? sectionAt(map, bar) : undefined
  const shown = all ? map.sections : section ? [section] : []
  return (
    <section className="scale-panel" aria-label="Scale ideas for this song">
      <div className="scale-panel-head">
        <strong>Scale ideas for this song</strong>
        <button className="chip" aria-pressed={all} onClick={() => setAll(!all)}>{all ? 'Show the part playing' : 'Show all'}</button>
      </div>
      {all && <p className="scale-idea">{unitName(map.unit)}'s new idea: {map.idea}</p>}
      {shown.map((part) => <SectionIdeas key={part.label} section={part} keyPc={mapKey} current={part === section} />)}
      {!shown.length && <p className="sight-hint">Press play: the ideas of the part being played show here.</p>}
    </section>
  )
}
