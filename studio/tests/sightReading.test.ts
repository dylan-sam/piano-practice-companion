import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import bankJson from '../public/exercises/name-progression.json'
import { midiNoteChange } from '../src/audio/midiInput'
import { arrange } from '../src/engine/arrange'
import { BASS_PATTERNS, defaultBassPatternForStyle, generateBassPattern } from '../src/engine/bassPatterns'
import { buildTimeline } from '../src/engine/timeline'
import { ChordJudge, coversChord, isMistakes, matchesVoicing, matchesPlayedChord, mistakeKey, nextInfiniteSteps, infiniteLine, lineKeys, progressionChords, requiredPitchClasses } from '../src/exercises/sightReading'
import { ChordSightreading } from '../src/exercises/ChordSightreading'
import type { Progression } from '../src/exercises/nameProgression'
import { parseChord } from '../src/music/chords'
import { chartFromMeasures } from '../src/music/chart'
import { getStyle, STYLES } from '../src/styles'
import { Transport } from '../src/ui/Transport'

/** Make a short catalog pattern for deterministic transition tests. */
function pattern(id: string, chords: string[]): Progression {
  return { id, label: id, chords, unique_song_count: 1, questions: [] }
}

const patterns = [
  pattern('tonic', ['I:maj', 'II:min', 'V:maj']),
  pattern('dominant', ['V:maj', 'I:maj', 'IV:maj']),
  pattern('minor', ['II:min', 'V:maj', 'I:maj']),
]

it('renders the three sight-reading choices without a connected keyboard', () => {
  const html = renderToStaticMarkup(createElement(ChordSightreading))
  expect(html).toContain('Pick a song')
  expect(html).toContain('Random song')
  expect(html).toContain('Infinite progressions')
  expect(html).toContain('Connect MIDI keyboard')
})

describe('sight-reading bass patterns', () => {
  it('selects a named default for every style', () => {
    expect(STYLES.map((style) => [style.id, defaultBassPatternForStyle(style.id)])).toEqual([
      ['swing', 'walking_bass'],
      ['jazz-waltz', 'walking_bass'],
      ['blues', 'boogie_walking'],
      ['bossa-nova', 'latin_bassline'],
      ['latin', 'latin_bassline'],
      ['straight pop/rock', 'root_fifth_bassline'],
      ['ballad', 'ballad_bassline'],
    ])
  })

  it('plays every bass choice with any style and leaves the piano track empty', () => {
    const chart = chartFromMeasures({ title: 'Bass choices', style: 'swing', key: 0, bpm: 120 },
      [['C'], ['F']])
    const timeline = buildTimeline(chart, 0, 1, { countIn: false, ending: false })
    for (const style of STYLES) {
      for (const pattern of BASS_PATTERNS) {
        const bass = generateBassPattern(timeline, style, pattern.id)
        expect(bass.events.length).toBeGreaterThan(0)
        expect(bass.events.every((event) => event.channel === 0)).toBe(true)
        const { midi } = arrange(chart, style, 0, 1, { countIn: false, ending: false },
          null, { comp: false, bassPatternId: pattern.id })
        const tracks = midiTracks(midi)
        expect(tracks[1]).toContain(0x90)
        expect(tracks[2]).not.toContain(0x91)
      }
    }
  })

  it('shows only named bass patterns alongside the style control', () => {
    const html = renderToStaticMarkup(createElement(Transport, {
      readiness: { kind: 'ready' }, playing: false, onToggle: () => {}, position: 'Bar 1',
      styleId: 'blues', onStyle: () => {}, pianoPatternId: 'boogie_walking',
      pianoPatterns: BASS_PATTERNS, onPianoPattern: () => {},
      patternLabel: 'Bass pattern', showDefaultPattern: false,
      keyPc: 0, onKey: () => {}, bpm: 120, bpmRange: [40, 300], onBpm: () => {},
      choruses: 1, maxChoruses: 24, onChoruses: () => {},
    }))
    expect(html).toContain('Boogie Walking Bass')
    expect(html).toContain('Latin Bassline')
    expect(html).toContain('Ballad Bassline')
    expect(html).toContain('Root-Fifth Bassline')
    expect(html).not.toContain('Style bassline')
    expect(html).not.toContain('Drum groove')
  })
})

/** Extract Standard MIDI File tracks to inspect the emitted instrument channels. */
function midiTracks(midi: Uint8Array): Uint8Array[] {
  const tracks: Uint8Array[] = []
  let offset = 14
  while (offset + 8 <= midi.length) {
    const size = ((midi[offset + 4] << 24) >>> 0) + (midi[offset + 5] << 16) +
      (midi[offset + 6] << 8) + midi[offset + 7]
    tracks.push(midi.slice(offset + 8, offset + 8 + size))
    offset += 8 + size
  }
  return tracks
}

describe('MIDI chord recognition', () => {
  it('validates stored mistake counts', () => {
    expect(isMistakes({ '0:maj': 2 })).toBe(true)
    expect(isMistakes({ '0:maj': -1 })).toBe(false)
    expect(isMistakes([])).toBe(false)
  })

  it('carries missed colored chords into the matching triad family', () => {
    expect(mistakeKey(parseChord('C7b9')!)).toBe(mistakeKey(parseChord('C')!))
    expect(mistakeKey(parseChord('C-7')!)).not.toBe(mistakeKey(parseChord('C')!))
  })

  it('reads note-on, note-off, and zero-velocity note-off on any MIDI channel', () => {
    expect(midiNoteChange([0x93, 60, 95])).toEqual({ note: 60, pressed: true, velocity: 95 })
    expect(midiNoteChange([0x93, 60, 0])).toEqual({ note: 60, pressed: false, velocity: 0 })
    expect(midiNoteChange([0x82, 60, 64])).toEqual({ note: 60, pressed: false, velocity: 64 })
    expect(midiNoteChange([0xb0, 64, 127])).toBeNull()
  })

  it('accepts octave doublings and inversions but requires the chord tones', () => {
    const major = parseChord('C')!
    expect(matchesPlayedChord(new Set([60, 64, 67]), major)).toBe(true)
    expect(matchesPlayedChord(new Set([64, 67, 72, 84]), major)).toBe(true)
    expect(matchesPlayedChord(new Set([60, 64]), major)).toBe(false)
    expect(matchesPlayedChord(new Set([60, 62, 64, 67]), major)).toBe(false)
    expect([...requiredPitchClasses(parseChord('C7')!)].sort((a, b) => a - b)).toEqual([0, 4, 10]) // the fifth is optional
    expect(matchesPlayedChord(new Set([60, 64, 67]), parseChord('C7')!)).toBe(false)
    expect(matchesPlayedChord(new Set([60, 64, 67, 70]), parseChord('C7')!)).toBe(true)
    expect(matchesPlayedChord(new Set([60, 64, 67, 70, 73]), parseChord('C7b9')!)).toBe(true)
    expect(matchesPlayedChord(new Set([60, 64, 67, 70, 74]), parseChord('C7b9')!)).toBe(false)
    expect(matchesPlayedChord(new Set([60, 64, 68]), parseChord('C+')!)).toBe(true)
    expect(matchesPlayedChord(new Set([60, 63, 66]), parseChord('Co')!)).toBe(true)
  })

  it('checks the lowest played pitch for slash chords', () => {
    const slash = parseChord('C/E')!
    expect(matchesPlayedChord(new Set([52, 55, 60]), slash)).toBe(true)
    expect(matchesPlayedChord(new Set([48, 52, 55]), slash)).toBe(false)
  })

  it('credits a chord played in time and reports a missed following chord', () => {
    const chart = chartFromMeasures({ title: 'Timing', style: 'swing', key: 0, bpm: 120 }, [['C', 'G']])
    const judge = new ChordJudge(buildTimeline(chart, 0, 1, { countIn: false, ending: false }))
    expect(judge.accept(0.5, new Set([60, 64]))).toBeNull()
    expect(judge.accept(1.5, new Set([60, 64, 67]))?.chordIndex).toBe(0)
    expect(judge.expire(2)).toEqual([])
    expect(judge.accept(2.5, new Set([60, 64, 67]))).toBeNull()
    expect(judge.expire(4).map((slot) => slot.chordIndex)).toEqual([1])
    expect(judge.accept(4, new Set([55, 59, 62]))).toBeNull()
  })
})

describe('infinite progression transitions', () => {
  it('shares the last chord without replaying it', () => {
    const next = nextInfiniteSteps('C', patterns, {}, false, () => 0)
    expect(next.transition).toBe('shared chord')
    expect(next.steps[0].symbol).not.toBe('C')
    expect(next.steps.length).toBeGreaterThan(0)
  })

  it('reinterprets the last chord as tonic and starts on another chord', () => {
    const next = nextInfiniteSteps('C', patterns, {}, false, () => 0.5)
    expect(next.transition).toBe('new tonic')
    expect(next.key).toBe(0)
    expect(next.steps[0].symbol).not.toBe('C')
  })

  it('resolves a major chord as V before starting another pattern', () => {
    const next = nextInfiniteSteps('C', patterns, {}, false, () => 0.99)
    expect(next.transition).toBe('dominant resolution')
    expect(next.key).toBe(5)
    expect(next.steps[0].symbol).toBe('F')
    expect(next.steps[1].symbol).not.toBe('F')
  })

  it('uses minor progressions when a minor chord becomes the new tonic', () => {
    const withMinor = [...patterns, pattern('minor-key', ['VIIb:maj', 'VIb:maj', 'I:min'])]
    const next = nextInfiniteSteps('C-', withMinor, {}, false, () => 0.6)
    expect(next.transition).toBe('new tonic')
    expect(next.key).toBe(0)
    expect(next.steps.at(-1)?.symbol).toBe('C-')
  })

  it('generates a playable chunk and can omit the second count-in', () => {
    const line = infiniteLine(patterns, {}, false, () => 0.2, undefined, 6)
    expect(line.steps.length).toBeGreaterThan(6)
    const timeline = buildTimeline(line.chart, 0, 1, { countIn: false, ending: false })
    expect(timeline.countIn).toBe(0)
    expect(timeline.clicks).toHaveLength(0)
    const { midi } = arrange(line.chart, getStyle('swing'), 0, 1, { countIn: false }, null, { comp: false })
    const tracks = midiTracks(midi)
    expect(tracks).toHaveLength(5)
    expect(tracks[1]).toContain(0x90) // bass note-on
    expect(tracks[2]).not.toContain(0x91) // no piano note-on
    expect(tracks[3]).toContain(0x99) // drum note-on
    expect(tracks[4]).toContain(0x94) // metronome click note-on (muted by default in the mixer)
  })

  it('connects progressions from the generated ChoCo exercise bank', () => {
    const bank = bankJson as { progressions: Progression[] }
    let seed = 17
    const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
    const line = infiniteLine(bank.progressions, {}, false, random, undefined, 80)
    expect(line.steps.length).toBeGreaterThan(100)
    expect(() => arrange(line.chart, getStyle('swing'), 0, 1, { ending: false }, null, { comp: false })).not.toThrow()
    const continued = infiniteLine(bank.progressions, {}, true, random, line.steps.at(-1), 6)
    expect(continued.steps.length).toBeGreaterThan(6)
  })

  it('adds chord substitutions at random, whole chords only, two chords still to a bar', () => {
    const bank = bankJson as { progressions: Progression[] }
    let seed = 5
    const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
    const lines = Array.from({ length: 6 }, () => infiniteLine(bank.progressions, {}, false, random, undefined, 40, 1))
    const substituted = lines.flatMap((line) => line.steps.filter((step) => step.written))
    expect(substituted.length).toBeGreaterThan(0)
    for (const line of lines) {
      const chords = line.chart.bars.flatMap((bar) => bar.chords)
      expect(chords.map((c) => c.symbol)).toEqual(line.steps.map((step) => step.symbol))
      expect(chords.map((c) => c.written)).toEqual(line.steps.map((step) => step.written))
      expect(line.chart.bars.every((bar, i) => bar.chords.length === 2 || i === line.chart.bars.length - 1)).toBe(true)
      // The sheet's ends as written: the next sheet goes on from its last chord
      expect(line.steps.at(-1)!.written).toBeUndefined()
    }
  })

  it('gives each bar the key of the progression at its downbeat', () => {
    const minor = { id: 'm', label: 'i iv', chords: ['I:min', 'IV:min'], unique_song_count: 1, questions: [] }
    const line = infiniteLine([minor], {}, false, () => 0.3, undefined, 3)
    const keys = lineKeys(line, [minor])
    expect(keys).toHaveLength(line.chart.bars.length)
    keys.forEach((key, bar) => expect(key).toEqual({ tonic: line.steps[bar * 2].key, minor: true }))
  })
})

describe('7th-chord versions and optional fifths', () => {
  const iiVI = { id: 'p', label: 'ii V I', chords: ['II:min', 'V:maj', 'I:maj'], unique_song_count: 1, questions: [] }

  it('plays the seventh version with the slider probability', () => {
    expect(progressionChords(iiVI, 1, () => 0.5)).toEqual(['II:min7', 'V:7', 'I:maj7'])
    expect(progressionChords(iiVI, 0, () => 0)).toEqual(iiVI.chords)
    expect(progressionChords(iiVI, 0.3, () => 0.5)).toEqual(iiVI.chords)
    const line = infiniteLine([iiVI], {}, false, () => 0.1, undefined, 4, 1)
    const symbols = line.steps.map((step) => step.symbol)
    expect(symbols.some((symbol) => /^[A-G][b#]?7$/.test(symbol))).toBe(true)
    expect(symbols.some((symbol) => symbol.endsWith('-7'))).toBe(true)
    expect(symbols.some((symbol) => symbol.endsWith('^7'))).toBe(true)
  })

  it('accepts four-note chords without their perfect fifth', () => {
    const parse = (symbol: string) => parseChord(symbol)!
    expect(matchesPlayedChord(new Set([55, 59, 65]), parse('G7'))).toBe(true)
    expect(matchesPlayedChord(new Set([60, 64, 71]), parse('C^7'))).toBe(true)
    expect(matchesPlayedChord(new Set([60, 63, 70]), parse('Ch7'))).toBe(false)
    expect(matchesPlayedChord(new Set([60, 64, 67]), parse('C'))).toBe(true)
    expect(matchesPlayedChord(new Set([60, 64]), parse('C'))).toBe(false)
  })
})

describe('chords checked in any rhythm', () => {
  it('covers a chord from its notes, leaving other notes and the 5th out', () => {
    const c7 = parseChord('C7')!
    expect(coversChord([48, 64, 70], c7)).toBe(true) // root, 3rd, 7th: the 5th may be left out
    expect(coversChord([48, 62, 64, 70, 61], c7)).toBe(true) // melody and passing notes ignored
    expect(coversChord([48, 67, 70], c7)).toBe(false) // no 3rd
  })

  it('wants the bass lowest for a slash chord', () => {
    const slash = parseChord('C/E')!
    expect(coversChord([52, 55, 60], slash)).toBe(true)
    expect(coversChord([48, 52, 55], slash)).toBe(false)
  })

  it('gathers a broken chord over its slot and forgets it when the slot ends', () => {
    const chart = chartFromMeasures({ title: 'Broken', style: 'swing', key: 0, bpm: 120 }, [['C', 'G']])
    const judge = new ChordJudge(buildTimeline(chart, 0, 1, { countIn: false, ending: false }), { broken: true })
    expect(judge.accept(0, new Set([48]), 48)).toBeNull()
    expect(judge.accept(0.5, new Set(), 52)).toBeNull()
    expect(judge.accept(1, new Set(), 55)?.chordIndex).toBe(0)
    expect(judge.accept(1.5, new Set(), 60)).toBeNull() // already played
    expect(judge.accept(2, new Set(), 55)).toBeNull() // G alone: not yet the whole chord
    expect(judge.expire(4).map((slot) => slot.chordIndex)).toEqual([1])
  })
})


describe('left-hand stages', () => {
  // C7 for two beats, then F for two beats
  const chart = chartFromMeasures({ title: 'Stages', style: 'swing', key: 0, bpm: 120 }, [['C7', 'F']])
  const timeline = buildTimeline(chart, 0, 1, { countIn: false, ending: false })

  it('bass only: the chord\'s bass is enough', () => {
    const judge = new ChordJudge(timeline, { broken: true, stage: 'bass' })
    expect(judge.accept(0.1, new Set([36]), 36)?.chordIndex).toBe(0)
    expect(judge.accept(2.1, new Set([45]), 45)).toBeNull() // A is not the bass of F
  })

  it('each beat: the whole chord and a key near every beat', () => {
    const judge = new ChordJudge(timeline, { broken: true, stage: 'beats' })
    expect(judge.accept(0, new Set(), 48)).toBeNull()
    expect(judge.accept(0.05, new Set(), 52)).toBeNull()
    expect(judge.accept(0.1, new Set(), 58)).toBeNull() // the whole chord, but beat 1 still to come
    expect(judge.accept(1.1, new Set(), 58)?.chordIndex).toBe(0)
    expect(judge.accept(2.1, new Set([53, 57, 60]), 60)).toBeNull() // F once: beat 3 waits
    expect(judge.expire(4).map((slot) => slot.chordIndex)).toEqual([1])
  })

  it('a key struck just before a chord counts for it', () => {
    const judge = new ChordJudge(timeline, { broken: true, stage: 'bass' })
    expect(judge.accept(1.9, new Set([41]), 41)?.chordIndex).toBe(1)
  })

  it("the pattern: the band piano's attacks, with the bass among the notes", () => {
    const judge = new ChordJudge(timeline, { broken: true, stage: 'pattern', onsets: [0, 1.5, 2, 3.5] })
    expect(judge.accept(0, new Set(), 36)).toBeNull()
    expect(judge.accept(1.45, new Set(), 64)?.chordIndex).toBe(0)
    expect(judge.accept(2, new Set(), 41)).toBeNull()
    expect(judge.expire(4).map((slot) => slot.chordIndex)).toEqual([1]) // no key near 3.5
  })
})

describe('voicing drills', () => {
  const c7 = parseChord('C7')!
  const held = (...notes: number[]) => new Set(notes)

  it('shells: root at the bottom, 3rd and 7th, nothing else', () => {
    expect(matchesVoicing(held(48, 52, 58), c7, 'shell')).toBe(true)
    expect(matchesVoicing(held(48, 58, 64), c7, 'shell')).toBe(true)
    expect(matchesVoicing(held(48, 52, 55, 58), c7, 'shell')).toBe(false) // the 5th
    expect(matchesVoicing(held(52, 58, 60), c7, 'shell')).toBe(false) // root not at the bottom
  })

  it('two hands: a shell under the 9th and 5th', () => {
    expect(matchesVoicing(held(36, 46, 52, 62, 67), c7, 'twoHand')).toBe(true)
    expect(matchesVoicing(held(36, 46, 52), c7, 'twoHand')).toBe(false)
  })

  it('rootless: 3rd, 7th and 9th without the root, the 13th allowed', () => {
    expect(matchesVoicing(held(52, 57, 58, 62), c7, 'rootless')).toBe(true) // E A Bb D
    expect(matchesVoicing(held(58, 62, 64, 69), c7, 'rootless')).toBe(true) // Bb D E A
    expect(matchesVoicing(held(48, 52, 58, 62), c7, 'rootless')).toBe(false) // a root
    expect(matchesVoicing(held(62, 65, 69, 72), parseChord('D-7')!, 'rootless')).toBe(false) // the root D
  })

  it('quartal: perfect 4ths from the chord scale', () => {
    const dm7 = parseChord('D-7')!
    const dorian = [0, 2, 3, 5, 7, 9, 10]
    expect(matchesVoicing(held(52, 57, 62, 67), dm7, 'quartal', dorian)).toBe(true) // E A D G
    expect(matchesVoicing(held(52, 57, 61), dm7, 'quartal', dorian)).toBe(false) // a major 3rd on top
    expect(matchesVoicing(held(51, 56, 61), dm7, 'quartal', dorian)).toBe(false) // Eb Ab Db: not Dorian
  })
})

