import { describe, expect, it } from 'vitest'
import { catalogPatternForStyle, defaultPatternForStyle, generatePianoPattern, patternsForStyle, PIANO_PATTERNS, usesWalkingBass } from '../src/engine/pianoPatterns'
import { buildTimeline, type Timeline } from '../src/engine/timeline'
import { chartFromMeasures } from '../src/music/chart'
import { parseChord } from '../src/music/chords'
import { bassEventsForStyle } from '../src/engine/arrange'
import { getStyle } from '../src/styles'

describe('project piano patterns in Studio', () => {
  it('exposes the curated patterns and their style defaults', () => {
    for (const style of ['swing', 'blues', 'bossa-nova', 'latin', 'straight pop/rock', 'ballad']) {
      const choices = patternsForStyle(style)
      expect(choices.length).toBeGreaterThan(0)
      expect(choices.length).toBeLessThanOrEqual(10)
      expect(choices.some((pattern) => pattern.id === catalogPatternForStyle(style))).toBe(true)
    }
    expect(defaultPatternForStyle('swing')).toBeNull()
    expect(defaultPatternForStyle('bossa-nova')).toBeNull()
    expect(defaultPatternForStyle('blues')).toBe(catalogPatternForStyle('blues'))
    expect(patternsForStyle('swing').map((pattern) => pattern.id)).toEqual(['stride', 'walking_bass', 'two_feel', 'charleston',
      'bass_shells', 'light_stride', 'shells_charleston', 'two_note_shells', 'quartal_pad'])
    expect(patternsForStyle('straight pop/rock').map((pattern) => pattern.id)).toEqual(['broken_chords', 'pop_rock'])
    expect(patternsForStyle('ballad').map((pattern) => pattern.id)).toEqual(['broken_chords', 'arpeggio_ascending', 'rolled_chords',
      'broken_tenths', 'quartal_pad'])
    expect(PIANO_PATTERNS.find((pattern) => pattern.id === 'bossa_chord_comp')?.name).toBe('Bossa chord comp 2')
  })

  it('keeps removed choices out of every style menu', () => {
    for (const style of ['swing', 'blues', 'bossa-nova', 'latin', 'straight pop/rock', 'ballad']) {
      expect(patternsForStyle(style).some((pattern) => pattern.id === 'syncopated')).toBe(false)
    }
    expect(PIANO_PATTERNS.some((pattern) => pattern.id === 'walking_bass_shells')).toBe(false)
    expect(PIANO_PATTERNS.some((pattern) => pattern.id === 'jazz_shell_comp')).toBe(false)
  })

  it('keeps pattern phase when the chord changes mid-bar', () => {
    const c = parseChord('C')!
    const f = parseChord('F')!
    const timeline: Timeline = {
      slots: [
        { chord: c, start: 0, beats: 2, measure: 0, chorus: 0 },
        { chord: f, start: 2, beats: 2, measure: 0, chorus: 0 },
      ],
      bars: [{ start: 0, beats: 4, measure: 0, isFirst: true, isLast: true }],
      totalBeats: 4, countIn: 0, clicks: [],
    }
    const pattern = PIANO_PATTERNS.find((item) => item.id === 'broken_chords')!
    const notes = generatePianoPattern(timeline, pattern, 0.5)
    expect(notes.map((note) => note.tick)).toEqual([0, 480, 960, 1440])
    expect(notes[0].note % 12).toBe(c.bass)
    expect(notes[2].note % 12).toBe(0) // Fifth of F is C.
  })

  it('puts walking notes only on bass and leaves shells on piano', () => {
    const chord = parseChord('C7')!
    const timeline: Timeline = {
      slots: [{ chord, start: 0, beats: 8, measure: 0, chorus: 0 }],
      bars: [
        { start: 0, beats: 4, measure: 0, isFirst: true, isLast: false },
        { start: 4, beats: 4, measure: 1, isFirst: false, isLast: true },
      ],
      totalBeats: 8, countIn: 0, clicks: [],
    }
    for (const id of ['walking_bass', 'boogie_walking', 'boogie_walking_shells']) {
      const pattern = PIANO_PATTERNS.find((item) => item.id === id)!
      expect(usesWalkingBass(pattern)).toBe(true)
      const events = generatePianoPattern(timeline, pattern, 0.66)
      expect(events.filter((event) => event.channel === 0).length, id).toBeGreaterThan(0)
      expect(events.filter((event) => event.channel === 1).length > 0, id).toBe(id.endsWith('_shells'))
    }
  })

  it('uses the source walking line for swing comping and suppresses extra blues and rock bass', () => {
    const chord = parseChord('C7')!
    const timeline: Timeline = {
      slots: [{ chord, start: 0, beats: 4, measure: 0, chorus: 0 }],
      bars: [{ start: 0, beats: 4, measure: 0, isFirst: true, isLast: true }],
      totalBeats: 4, countIn: 0, clicks: [],
    }
    const swing = getStyle('swing')
    const walking = PIANO_PATTERNS.find((pattern) => pattern.id === 'walking_bass')!
    const expected = generatePianoPattern(timeline, walking, swing.swing).filter((event) => event.channel === 0)
    expect(bassEventsForStyle(timeline, swing, swing, undefined, null)).toEqual(expected)
    for (const [styleId, patternId] of [['blues', 'boogie_simple'], ['straight pop/rock', 'pop_rock']]) {
      const style = getStyle(styleId)
      const pattern = PIANO_PATTERNS.find((item) => item.id === patternId)!
      expect(bassEventsForStyle(timeline, style, style, pattern,
        generatePianoPattern(timeline, pattern, style.swing))).toEqual([])
    }
    const blues = getStyle('blues')
    const boogieWalk = PIANO_PATTERNS.find((pattern) => pattern.id === 'boogie_walking')!
    expect(bassEventsForStyle(timeline, blues, blues, boogieWalk,
      generatePianoPattern(timeline, boogieWalk, blues.swing)).length).toBeGreaterThan(0)
  })

  it('plays the Lessons tab patterns: two-note shells and a quartal pad', () => {
    const timeline = buildTimeline(chartFromMeasures({ title: 'P', style: 'swing', key: 0, bpm: 120 }, [['Dm7'], ['C']]), 0, 1,
      { countIn: false, ending: false })
    const notesAt = (id: string, beat: number) => generatePianoPattern(timeline, PIANO_PATTERNS.find((p) => p.id === id)!, 0.5)
      .filter((event) => event.tick === beat * 480).map((event) => event.note % 12).sort((a, b) => a - b)
    expect(notesAt('two_note_shells', 0)).toEqual([0, 2]) // D and C: root and 7th
    expect(notesAt('quartal_pad', 0)).toEqual([0, 2, 7]) // D G C over Dm7
    expect(notesAt('quartal_pad', 4)).toEqual([2, 4, 9]) // E A D over C
    for (const pattern of PIANO_PATTERNS) expect(() => generatePianoPattern(timeline, pattern, 0.66)).not.toThrow()
  })
})
