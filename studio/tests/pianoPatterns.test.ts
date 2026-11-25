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
      expect(choices.some((pattern) => pattern.id === catalogPatternForStyle(style))).toBe(true)
    }
    expect(defaultPatternForStyle('swing')).toBeNull()
    expect(defaultPatternForStyle('bossa-nova')).toBeNull()
    expect(defaultPatternForStyle('blues')).toBe(catalogPatternForStyle('blues'))
    // Menus in one order: bass lines, chords, shells, the Charleston patterns together, voicings
    expect(patternsForStyle('swing').map((pattern) => pattern.id)).toEqual(['walking_bass', 'stride', 'light_stride', 'ragtime_bass',
      'open_fifths', 'type_a_shells', 'charleston', 'shells_charleston', 'type_a_charleston', 'rootless_charleston', 'fourths_from_ninth'])
    expect(patternsForStyle('blues').map((pattern) => pattern.id)).toEqual(['boogie_simple', 'boogie_walking', 'boogie_walking_shells',
      'left_hand_shuffle', 'new_orleans_bass', 'ragtime_bass', 'type_a_shells', 'rootless_charleston'])
    expect(patternsForStyle('straight pop/rock').map((pattern) => pattern.id)).toEqual(['pop_rock', 'open_fifths', 'broken_chords'])
    expect(patternsForStyle('ballad').map((pattern) => pattern.id)).toEqual(['open_fifths', 'broken_chords', 'broken_tenths',
      'arpeggio_ascending', 'rolled_chords', 'type_a_shells', 'rootless_held', 'quartal_pad', 'fourths_from_ninth'])
    expect(PIANO_PATTERNS.find((pattern) => pattern.id === 'bossa_chord_comp')?.name).toBe('Bossa chord comp 2')
  })

  it('keeps removed choices out of every style menu', () => {
    for (const style of ['swing', 'blues', 'bossa-nova', 'latin', 'straight pop/rock', 'ballad']) {
      expect(patternsForStyle(style).some((pattern) => pattern.id === 'syncopated')).toBe(false)
    }
    expect(PIANO_PATTERNS.some((pattern) => pattern.id === 'walking_bass_shells')).toBe(false)
    expect(PIANO_PATTERNS.some((pattern) => pattern.id === 'jazz_shell_comp')).toBe(false)
    for (const id of ['two_feel', 'bass_shells', 'two_note_shells']) {
      expect(PIANO_PATTERNS.some((pattern) => pattern.id === id), id).toBe(false)
    }
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

  it('plays the Lessons tab patterns: open 5ths, Type A shells, rootless voicings and 4ths', () => {
    const timeline = buildTimeline(chartFromMeasures({ title: 'P', style: 'swing', key: 0, bpm: 120 }, [['Dm7'], ['C']]), 0, 1,
      { countIn: false, ending: false })
    const at = (id: string, beat: number) => generatePianoPattern(timeline, PIANO_PATTERNS.find((p) => p.id === id)!, 0.5)
      .filter((event) => event.tick === beat * 480).map((event) => event.note).sort((a, b) => a - b)
    const pcs = (id: string, beat: number) => at(id, beat).map((note) => note % 12).sort((a, b) => a - b)
    expect(pcs('open_fifths', 0)).toEqual([2, 9]) // D and A
    expect(at('type_a_shells', 0)).toEqual([38, 53, 60]) // D2, then F3 under C4
    expect(pcs('quartal_pad', 0)).toEqual([0, 2, 7]) // D G C over Dm7
    expect(pcs('fourths_from_ninth', 0)).toEqual([2, 4, 9]) // E A D over Dm7
    for (const pattern of PIANO_PATTERNS) expect(() => generatePianoPattern(timeline, pattern, 0.66)).not.toThrow()
  })

  it("leads Levine's rootless voicings from one chord to the next (A, B, A in a ii-V-I)", () => {
    const timeline = buildTimeline(chartFromMeasures({ title: 'ii-V-I', style: 'swing', key: 0, bpm: 120 },
      [['D-7'], ['G7'], ['C^7']]), 0, 1, { countIn: false, ending: false })
    const events = generatePianoPattern(timeline, PIANO_PATTERNS.find((p) => p.id === 'rootless_held')!, 0)
    const bar = (n: number) => events.filter((event) => event.tick === n * 4 * 480).map((event) => event.note).sort((a, b) => a - b)
    expect(bar(0)).toEqual([53, 57, 60, 64]) // F A C E: 3rd at the bottom
    expect(bar(1)).toEqual([53, 57, 59, 64]) // F A B E: 7th at the bottom
    expect(bar(2)).toEqual([52, 55, 59, 62]) // E G B D: 3rd at the bottom
  })

  it('keeps a 4/4 pattern on the beat in 3/4 and 6/8 bars', () => {
    const onsets = (time: [number, number], id: string) => {
      const chart = chartFromMeasures({ title: 'M', style: 'swing', key: 0, bpm: 120, time }, [['C'], ['F']])
      const timeline = buildTimeline(chart, 0, 1, { countIn: false, ending: false })
      const events = generatePianoPattern(timeline, PIANO_PATTERNS.find((p) => p.id === id)!, 0.5) // straight eighths
      return [...new Set(events.filter((event) => event.tick < 3 * 480).map((event) => event.tick / 480))].sort((a, b) => a - b)
    }
    // 3/4 plays beats 1, 2 and 4 of the 4/4 bar: oom-pah-pah, three quarter notes
    expect(onsets([3, 4], 'stride')).toEqual([0, 1, 2])
    expect(onsets([3, 4], 'walking_bass')).toEqual([0, 1, 2])
    expect(onsets([3, 4], 'charleston')).toEqual([0, 1.5])
    // 6/8: each half of the 4/4 bar on a dotted quarter, on the eighths
    expect(onsets([6, 8], 'stride')).toEqual([0, 1, 1.5, 2.5])
  })
})

