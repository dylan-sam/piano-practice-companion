import { describe, expect, test } from 'vitest'
import { chartFromMeasures, type Chart } from '../src/music/chart'
import { substituteChart, substitutionOrder, withOrder, withTicked, NO_SUBSTITUTIONS, type SubstitutionId, type SubstitutionSettings } from '../src/music/substitutions'
import { exportMidi } from '../src/engine/exportTrack'
import { buildTimeline, chordsOfBar } from '../src/engine/timeline'
import { NO_PRACTICE, practiceOptions } from '../src/music/practice'
import { getStyle } from '../src/styles'

const chart = (bars: string[][], key = 0) => chartFromMeasures({ title: 'T', style: 'swing', key, bpm: 120 }, bars)
const subs = (ids: SubstitutionId[], when: SubstitutionSettings['when'] = { kind: 'always' }): SubstitutionSettings => ({ ids, when, seed: 7 })
/** The chords of a chart, bar by bar ("*" marks a substitute). */
const played = (c: Chart) => c.bars.map((bar) => bar.chords.map((ch) => `${ch.symbol}${ch.written !== undefined ? '*' : ''}`).join(' '))

const iiVI = chart([['D-7', 'G7'], ['C^7'], ['C^7'], ['C^7']])

describe('chord substitutions', () => {
  test('tritone substitution, secondary dominant, and both', () => {
    expect(played(substituteChart(iiVI, subs(['tritone']), 0))[0]).toBe('D-7 Db7*')
    expect(played(substituteChart(iiVI, subs(['secondary']), 0))[0]).toBe('D7* G7')
    expect(played(substituteChart(iiVI, subs(['secondary', 'tritone']), 0))[0]).toBe('Ab7* Db7*')
  })

  test('applied one after another, in the order set: each on the chords the ones before it made', () => {
    const turn = chart([['C^7', 'A-7'], ['D-7', 'G7']])
    // The secondary dominant first: the turnaround then finds D7 after A-7, no longer a minor chord
    expect(played(substituteChart(turn, subs(['secondary', 'turnaround']), 0))).toEqual(['C^7 A-7', 'D7* G7'])
    // The backdoor first takes the ii-V (its iv-7 bVII7 does not go on down a 5th: no secondary
    // dominant); after the secondary dominant there is no ii left for it
    expect(played(substituteChart(iiVI, subs(['backdoor', 'secondary']), 0))[0]).toBe('F-7* Bb7*')
    expect(played(substituteChart(iiVI, subs(['secondary', 'backdoor']), 0))[0]).toBe('D7* G7')
    // A chord changed twice keeps the chord first written there
    const twice = substituteChart(iiVI, subs(['secondary', 'tritone']), 0).bars[0].chords[0]
    expect([twice.symbol, twice.written]).toEqual(['Ab7', 'D-7'])
  })

  test('the menu: its order, and ticking keeps the ticked ones in it', () => {
    expect(substitutionOrder(undefined)).toEqual(['addII', 'passingDim', 'backdoor', 'turnaround', 'secondary', 'tritone', 'altered'])
    const ticked = withTicked(withTicked(NO_SUBSTITUTIONS, 'tritone', true), 'secondary', true)
    expect(ticked.ids).toEqual(['secondary', 'tritone'])
    const moved = withOrder(ticked, ['tritone', 'secondary', 'addII', 'passingDim', 'backdoor', 'turnaround', 'altered'])
    expect(moved.ids).toEqual(['tritone', 'secondary'])
    expect(withTicked(moved, 'addII', true).ids).toEqual(['tritone', 'secondary', 'addII'])
    // Tritone first: G7 becomes Db7, then D-7 is no longer before a V a 5th below it
    expect(played(substituteChart(iiVI, moved, 0))[0]).toBe('D-7 Db7*')
  })

  test('the tritone substitution replaces any dominant going down a 5th, not the others', () => {
    // A blues: F7 to Bb7 (I7 to IV7) is replaced, Bb7 back to F7 is not
    const blues = chart([['F7'], ['Bb7'], ['F7'], ['F7']], 5)
    expect(played(substituteChart(blues, subs(['tritone']), 0))).toEqual(['B7*', 'Bb7', 'F7', 'F7'])
  })

  test('the altered dominant: b9 before a major chord, b9 b13 before a minor one, not twice', () => {
    expect(played(substituteChart(iiVI, subs(['altered']), 0))[0]).toBe('D-7 G7b9*')
    expect(played(substituteChart(chart([['Dh7', 'G7'], ['C-7'], ['C-7']]), subs(['altered']), 0))[0]).toBe('Dh7 G7b9b13*')
    expect(played(substituteChart(chart([['Dh7', 'G7#9'], ['C-7'], ['C-7']]), subs(['altered']), 0))[0]).toBe('Dh7 G7#9')
    // With the secondary dominant first, both dominants take it
    expect(played(substituteChart(iiVI, subs(['secondary', 'altered']), 0))[0]).toBe('D7b9* G7b9*')
  })

  test('backdoor ii-V to a major I', () => {
    expect(played(substituteChart(iiVI, subs(['backdoor']), 0))[0]).toBe('F-7* Bb7*')
  })

  test('the ii before a long V7, and with the tritone substitution', () => {
    const long = chart([['F^7'], ['C7'], ['F^7'], ['F^7']])
    expect(played(substituteChart(long, subs(['addII']), 0))[1]).toBe('G-7* C7')
    expect(played(substituteChart(long, subs(['addII', 'tritone']), 0))[1]).toBe('G-7* Gb7*')
    // Held over blank bars (Avalon's 4 bars of C7): the ii for 2 bars, the V written again for the other 2
    const held = chart([['F^7'], ['C7'], [], [], [], ['F^7']])
    expect(played(substituteChart(held, subs(['addII']), 0)).slice(1, 5)).toEqual(['G-7*', '', 'C7', ''])
    expect(played(substituteChart(held, subs(['addII', 'tritone']), 0)).slice(1, 5)).toEqual(['G-7*', '', 'Gb7*', ''])
    // Already after its ii: nothing to add
    expect(played(substituteChart(chart([['G-7'], ['C7'], ['F^7']]), subs(['addII']), 0))[1]).toBe('C7')
  })

  test('turnaround with dominants, and Lady Bird with the tritone substitution', () => {
    const turn = chart([['C^7', 'A-7'], ['D-7', 'G7']])
    expect(played(substituteChart(turn, subs(['turnaround', 'secondary']), 0))).toEqual(['C^7 A7*', 'D7* G7'])
    expect(played(substituteChart(turn, subs(['turnaround', 'secondary', 'tritone']), 0))).toEqual(['C^7 Eb7*', 'Ab7* Db7*'])
  })

  test('a passing diminished chord between a chord and the minor chord a whole step up', () => {
    // In place of a short chord repeating the one before it (Rhythm Changes: Bb Bb6 C-7 -> Bb Bo7 C-7)
    expect(played(substituteChart(chart([['Bb', 'Bb6'], ['C-7', 'F7'], ['Bb']], 10), subs(['passingDim']), 0))[0]).toBe('Bb Bo7*')
    expect(played(substituteChart(chart([['C^7'], ['D-7', 'G7'], ['C^7']]), subs(['passingDim']), 0))[0]).toBe('C^7 C#o7*')
    // In place of the vi of I vi ii V, and from any degree (ii to iii, V to vi)
    expect(played(substituteChart(chart([['C^7', 'A-7'], ['D-7', 'G7']]), subs(['passingDim']), 0))[0]).toBe('C^7 C#o7*')
    expect(played(substituteChart(chart([['D-7'], ['E-7'], ['C^7']]), subs(['passingDim']), 0))[0]).toBe('D-7 D#o7*')
    expect(played(substituteChart(chart([['G7'], ['A-7'], ['C^7']]), subs(['passingDim']), 0))[0]).toBe('G7 G#o7*')
    // Not to a major or dominant chord
    expect(played(substituteChart(chart([['C^7'], ['D7'], ['G7']]), subs(['passingDim']), 0))[0]).toBe('C^7')
  })

  test('a piece of a line: no chord split, and its ends do not lead to each other', () => {
    const piece = { piece: true }
    // The ii is not added (it would split the V); the passing diminished chord only replaces a chord whole
    const line = chart([['F^7', 'C7'], ['F^7', 'G-7'], ['C7', 'F^7'], ['G-7', 'C7']])
    const all = subs(['addII', 'passingDim', 'backdoor', 'turnaround', 'secondary', 'tritone'])
    const chords = (c: Chart) => c.bars.map((bar) => bar.chords.length)
    expect(chords(substituteChart(line, all, 0, piece))).toEqual([2, 2, 2, 2])
    // The last C7 does not go back to the first F^7: no tritone substitution there in a piece
    expect(played(substituteChart(line, subs(['tritone']), 0, piece))[3]).toBe('G-7 C7')
    expect(played(substituteChart(line, subs(['tritone']), 0))[3]).toBe('G-7 Gb7*')
  })

    test('when: from a chorus on, every other chorus, at random', () => {
    const from2 = subs(['tritone'], { kind: 'from', chorus: 2 })
    expect(substituteChart(iiVI, from2, 0)).toBe(iiVI)
    expect(played(substituteChart(iiVI, from2, 1))[0]).toBe('D-7 Db7*')
    const other = subs(['tritone'], { kind: 'alternate' })
    expect([0, 1, 2, 3].map((c) => played(substituteChart(iiVI, other, c))[0])).toEqual(['D-7 G7', 'D-7 Db7*', 'D-7 G7', 'D-7 Db7*'])
    const random = subs(['tritone'], { kind: 'random' })
    const results = Array.from({ length: 16 }, (_, c) => played(substituteChart(iiVI, random, c))[0])
    expect(new Set(results)).toEqual(new Set(['D-7 G7', 'D-7 Db7*']))
    expect(Array.from({ length: 16 }, (_, c) => played(substituteChart(iiVI, random, c))[0])).toEqual(results)
  })

  test('a lead sheet: no substitute under a long melody note that clashes with it', () => {
    const lead = chart([['D-7', 'G7'], ['C^7']])
    // F held over G7 (beats 3-4): over D7 (the secondary dominant of D-7) a long F clashes with its F#
    lead.melody = { notes: [{ bar: 0, at: 0, beats: 2, pitch: 65 }] }
    expect(played(substituteChart(lead, subs(['secondary']), 0))[0]).toBe('D-7 G7')
    // A G held over Db7 is its #11 (the old root): the tritone substitution stays; a D (its b9) would clash
    lead.melody = { notes: [{ bar: 0, at: 2, beats: 2, pitch: 67 }] }
    expect(played(substituteChart(lead, subs(['tritone']), 0))[0]).toBe('D-7 Db7*')
    lead.melody = { notes: [{ bar: 0, at: 2, beats: 2, pitch: 62 }] }
    expect(played(substituteChart(lead, subs(['tritone']), 0))[0]).toBe('D-7 G7')
    lead.melody = { notes: [{ bar: 0, at: 2, beats: 2, pitch: 67 }] }
    expect(played(substituteChart(lead, subs(['tritone']), 0))[0]).toBe('D-7 Db7*')
  })
})

describe('substitutions in the band and the downloads', () => {
  test('the timeline plays the substitutes from the chosen chorus, and the downloads use the same options', () => {
    const practice = { ...NO_PRACTICE, subs: subs(['tritone'], { kind: 'from', chorus: 2 }) }
    const timeline = buildTimeline(iiVI, 0, 2, practiceOptions(practice))
    const vRoots = timeline.slots.filter((s) => s.measure === 0 && s.chordIndex === 1).map((s) => s.chord.root)
    expect(vRoots).toEqual([7, 1]) // G7 in the first chorus, Db7 in the second
    // The chord helper knows the chord written there
    expect(chordsOfBar(timeline, 0, 1)[1].written?.root).toBe(7)
    expect(chordsOfBar(timeline, 0, 0)[1].written).toBeUndefined()
    const muted = { bass: false, comp: false, melody: false, click: true, drums: false }
    const request = { chart: iiVI, style: getStyle('swing'), patternId: null, transpose: 0, choruses: 2, bpm: 120, muted }
    expect(exportMidi({ ...request, practice })).not.toEqual(exportMidi({ ...request, practice: NO_PRACTICE }))
  })
})
