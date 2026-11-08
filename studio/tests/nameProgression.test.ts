import { describe, expect, it } from 'vitest'
import bankJson from '../public/exercises/name-progression.json'
import { arrange } from '../src/engine/arrange'
import { buildTimeline } from '../src/engine/timeline'
import {
  cadenceMidi, keyReferences, mistakeWeight, mostConfused, progressionSteps, recordAnswer, romanSymbol, transposeFor, withProgression,
  cellWidths, CUSTOM_LEVEL, LEVELS, levelName, levelProgressions, MIN_QUESTIONS, nextLevel, pickQuestion, playable, questionChart,
  questionId, tonicMidi, type Progression, type Question, type QuestionBank,
} from '../src/exercises/nameProgression'
import { ROW_CELLS } from '../src/music/chart'
import { getStyle } from '../src/styles'

const bank = bankJson as QuestionBank

/** A four-bar test question in C: C | D-7 G7 | C^7 | A7, with the middle bars hidden. */
const question = (id: string): Question => ({
  track_id: id, title: id, artist: '', corpus: 'Test', style: 'swing', key: 0, minor: false, relaxed: false, time: [4, 4],
  bars: [
    { chords: [{ symbol: 'C', beats: 4 }] },
    { chords: [{ symbol: 'D-7', beats: 2, hidden: true }, { symbol: 'G7', beats: 2, hidden: true }] },
    { chords: [{ symbol: 'C^7', beats: 4, hidden: true }] },
    { chords: [{ symbol: 'A7', beats: 4 }] },
  ],
})
/** A test progression with `count` copies of the test question. */
const progression = (id: string, count: number): Progression => ({
  id, label: id, chords: [], unique_song_count: count,
  questions: Array.from({ length: count }, (_, i) => question(`${id}-${i}`)),
})
const sample: QuestionBank = {
  version: 1, source: 'test',
  progressions: [progression('a', 9), progression('b', 8), progression('c', 7), progression('rare', MIN_QUESTIONS - 1)],
}

describe('name the progression levels', () => {
  /** The answer labels of a level of the real bank. */
  const ids = (level: string, custom: string[] = []) => levelProgressions(bank, level, custom).map((p) => p.label)
  /** Check level membership independently of catalog popularity order. */
  const expectChoices = (level: string, labels: string[]) => expect(ids(level).slice().sort()).toEqual(labels.slice().sort())

  it('follows the curriculum', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([
      '1.1', '1.2', '1.3', '1.4', '2', '3', '4', '5', '6.1', '6.2', '6.3', '7', '8', '9', '10', '11', '12', '13', '14', '15',
    ])
    expectChoices('1.1', ['ii – V – I', 'II – V – I'])
    expectChoices('1.2', ['IV – V – I', 'I – IV – V'])
    expectChoices('1.3', ['ii – V – I', 'IV – V – I'])
    expectChoices('1.4', ['II – V – I', 'IV – V – I'])
    expect(ids('2')).toHaveLength(4)
    expect(ids('3')).toContain('vi – ii – V – I')
    expect(ids('4')).toContain('IV – V – I – vi')
    expect(ids('5')).toContain('iv – V – i')
    expect(ids('5')).toHaveLength(7)
    expectChoices('6.1', ['I – vi – IV – V', 'vi – IV – I – V'])
    expectChoices('6.2', ['I – vi – IV – V', 'I – V – vi – IV'])
    expect(ids('6.3')).toHaveLength(3)
    expect(ids('7')).toHaveLength(10)
    expectChoices('8', ['ii – ♭II7 – I', 'ii – ♭VII7 – I'])
    expect(ids('9')).toHaveLength(12)
    expectChoices('10', ['I – ♭VII – IV – I', '♭VI – ♭VII – I'])
    expectChoices('12', ['V – iv – I', 'I – III – IV – iv'])
    expectChoices('14', ['i – ♭VII – ♭VI – V', 'i – ♭VII – ♭VI – ♭VII'])
    expect(ids('15')).toHaveLength(18)
    expect(nextLevel('1.4')?.id).toBe('2')
    expect(nextLevel('15')).toBeUndefined()
    expect(levelName(bank, LEVELS[0])).toBe(ids('1.1').map((label) => label.replaceAll(' – ', '–')).join(', '))
  })

  it('offers only playable progressions, each in some level', () => {
    for (const level of LEVELS) {
      const choices = levelProgressions(bank, level.id)
      expect(choices.length, level.id).toBe(level.progressions.length)
      expect(choices.map((choice) => choice.unique_song_count), level.id)
        .toEqual(choices.map((choice) => choice.unique_song_count).sort((a, b) => b - a))
    }
    const used = new Set(LEVELS.flatMap((l) => l.progressions))
    expect(playable(bank).every((p) => used.has(p.id))).toBe(true)
  })

  it('uses the selected progressions in the custom level', () => {
    expect(ids(CUSTOM_LEVEL, ['progression-03', 'progression-06'])).toEqual(['I – V – vi – IV', 'ii – ♭II7 – I'])
    expect(ids(CUSTOM_LEVEL)).toEqual([])
  })

  it('picks one of the choices and avoids songs already asked', () => {
    const recent = new Set(sample.progressions[0].questions.slice(1).map((q) => questionId(sample.progressions[0], q)))
    const asked = pickQuestion(sample.progressions.slice(0, 2), recent, () => 0)
    expect(asked.progression.id).toBe('a')
    expect(asked.question.track_id).toBe('a-0')
  })
})

describe('question line', () => {
  it('keeps the line on one row', () => {
    for (const counts of [[1, 1, 1], [1, 2, 1, 1], [1, 3, 2, 1, 2], [2, 1, 1, 1, 1, 3]]) {
      const cells = cellWidths(counts)
      expect(cells.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(ROW_CELLS)
      expect(Math.min(...cells)).toBeGreaterThanOrEqual(2)
    }
  })

  it('splits a long line into two rows on phones', () => {
    const long = { ...question('long'), bars: [...question('long').bars, { chords: [{ symbol: 'D7', beats: 4 }] }, { chords: [{ symbol: 'G7', beats: 4 }] }] }
    expect(questionChart(long, 'swing').bars.filter((b) => b.rowStart)).toHaveLength(1)
    const phone = questionChart(long, 'swing', 4)
    expect(phone.bars.map((b) => !!b.rowStart)).toEqual([true, false, false, true, false, false])
    expect(phone.bars.every((b) => b.cells === 4)).toBe(true)
  })

  it('plays the hidden chords and stops after the last bar', () => {
    const chart = questionChart(question('x'), 'swing')
    expect(chart.bars[0].rowStart).toBe(true)
    const timeline = buildTimeline(chart, 0, 1, { ending: false })
    expect(timeline.slots.map((s) => s.measure)).toEqual([0, 1, 1, 2, 3])
    expect(timeline.bars.some((b) => b.measure === -1)).toBe(false)
    expect(buildTimeline(chart, 0, 1).bars.some((b) => b.measure === -1)).toBe(true)
  })

  it('writes a tonic chord', () => {
    expect(tonicMidi(9, true, 120).length).toBeGreaterThan(50)
  })
})

describe('generated question bank', () => {
  it('is ordered by distinct songs', () => {
    const counts = bank.progressions.map((p) => p.unique_song_count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(playable(bank).every((p) => p.questions.length >= MIN_QUESTIONS)).toBe(true)
    // Unknown modes come only from relaxed lines, which hold at most six bars
    const questions = bank.progressions.flatMap((p) => p.questions)
    expect(questions.every((q) => q.minor !== null || q.relaxed)).toBe(true)
    expect(questions.filter((q) => q.relaxed).every((q) => q.bars.length <= 6)).toBe(true)
  })

  it('arranges every question with a hidden gap, visible context on both sides in strict lines', () => {
    for (const p of playable(bank)) {
      for (const q of p.questions) {
        const firstVisible = q.bars[0].chords.some((c) => !c.hidden)
        const lastVisible = q.bars.at(-1)!.chords.some((c) => !c.hidden)
        // Relaxed lines may open or close a song, without a visible bar on that side
        if (!q.relaxed) {
          expect(firstVisible && lastVisible, q.track_id).toBe(true)
        }
        expect(q.bars.some((b) => b.chords.some((c) => c.hidden)), q.track_id).toBe(true)
        expect(() => arrange(questionChart(q, q.style), getStyle(q.style), 0, 1, { ending: false }), `${p.id} ${q.track_id}`).not.toThrow()
      }
    }
  })
})

describe('key choice', () => {
  it('keeps the song key, moves to a fixed tonic, or draws a random one', () => {
    const q = { ...question('k'), key: 3 } // E-flat
    expect(transposeFor('song', q)).toBe(0)
    expect((3 + transposeFor(7, q) + 12) % 12).toBe(7)
    expect((3 + transposeFor('random', q, () => 0.99) + 12) % 12).toBe(11)
    for (let pc = 0; pc < 12; pc++) expect(Math.abs(transposeFor(pc, q))).toBeLessThanOrEqual(6)
  })

  it('writes a four-chord cadence', () => {
    expect(cadenceMidi(2, false, 120).length).toBeGreaterThan(tonicMidi(2, false, 120).length)
  })

  it('offers the cadence of the mode, or both when the mode is unknown', () => {
    expect(keyReferences(false)).toEqual(['tonic', 'major cadence'])
    expect(keyReferences(true)).toEqual(['tonic', 'minor cadence'])
    expect(keyReferences(null)).toEqual(['tonic', 'major cadence', 'minor cadence'])
    // Without a mode the tonic is played without its third
    expect(tonicMidi(0, null, 120).length).toBeLessThan(tonicMidi(0, false, 120).length)
  })
})

describe('another answer in the gap', () => {
  /** The hidden chords of a question as [symbol, beats]. */
  const steps = (q: Question) => q.bars.flatMap((b) => b.chords.filter((c) => c.hidden).map((c) => [c.symbol, c.beats]))
  const stepped: Question = {
    ...question('s'),
    bars: [
      { chords: [{ symbol: 'C', beats: 4 }] },
      { chords: [{ symbol: 'D-7', beats: 2, hidden: true, step: 0 }, { symbol: 'G7', beats: 2, hidden: true, step: 1 }] },
      { chords: [{ symbol: 'C^7', beats: 4, hidden: true, step: 2 }] },
      { chords: [{ symbol: 'A7', beats: 4 }] },
    ],
  }

  it('spells catalog chords in the key', () => {
    expect(romanSymbol('II:min', 0, true)).toBe('D-7')
    expect(romanSymbol('V:maj', 0, true)).toBe('G7')
    expect(romanSymbol('V:maj', 0, false)).toBe('G')
    expect(romanSymbol('II:maj', 0, true)).toBe('D7')
    expect(romanSymbol('IV:maj', 0, true)).toBe('F^7')
    expect(romanSymbol('IIb:7', 0, true)).toBe('Db7')
    expect(romanSymbol('VIIb:maj', 2, false)).toBe('C')
    expect(progressionSteps(['I:maj', 'IV:maj', 'IV:maj', 'V:maj'])).toEqual(['I:maj', 'IV:maj', 'V:maj'])
  })

  it('keeps the rhythm for a progression with as many steps', () => {
    const p: Progression = { ...progression('ii-bII-I', 0), chords: ['II:min', 'IIb:7', 'I:maj'] }
    expect(steps(withProgression(stepped, p, true))).toEqual([['D-7', 2], ['Db7', 2], ['C^7', 4]])
  })

  it('shares the gap evenly on whole beats otherwise', () => {
    const p: Progression = { ...progression('vi-ii-V-I', 0), chords: ['VI:min', 'II:min', 'V:maj', 'I:maj'] }
    const filled = withProgression(stepped, p, false)
    expect(steps(filled)).toEqual([['A-', 2], ['D-', 2], ['G', 2], ['C', 2]])
    expect(filled.bars[0].chords).toEqual(stepped.bars[0].chords)
    expect(() => buildTimeline(questionChart(filled, 'swing'), 0, 1)).not.toThrow()
  })

  it('fits every catalog progression into every question of the bank', () => {
    const all = playable(bank)
    for (const p of all.slice(0, 6)) {
      for (const q of p.questions.slice(0, 40)) {
        for (const other of all) {
          const filled = withProgression(q, other, true)
          // Length of a line in beats
          const total = (x: Question) => x.bars.reduce((sum, b) => sum + b.chords.reduce((s, c) => s + c.beats, 0), 0)
          expect(Math.abs(total(filled) - total(q))).toBeLessThan(1e-4)
          expect(() => buildTimeline(questionChart(filled, q.style), 0, 1)).not.toThrow()
        }
      }
    }
  })
})

describe('results', () => {
  it('counts answers and the most common confusion', () => {
    let results = recordAnswer({}, 'a', 'a')
    results = recordAnswer(results, 'a', 'b')
    results = recordAnswer(results, 'a', 'b')
    results = recordAnswer(results, 'a', 'c')
    expect(results.a).toMatchObject({ asked: 4, correct: 1 })
    expect(mostConfused(results.a)).toEqual(['b', 2])
    expect(mistakeWeight(results.a)).toBeGreaterThan(mistakeWeight(undefined))
    expect(mistakeWeight({ asked: 20, correct: 20, confusedWith: {} })).toBeLessThan(mistakeWeight(undefined))
  })

  it('asks weak progressions more often when focusing on mistakes', () => {
    const counts = { a: 0, b: 0 }
    let seed = 1
    // A seeded random generator, so the test is repeatable
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 2000; i++) {
      const asked = pickQuestion(sample.progressions.slice(0, 2), new Set(), random, (p) => (p.id === 'b' ? 3 : 1))
      counts[asked.progression.id as 'a' | 'b']++
    }
    expect(counts.b / counts.a).toBeGreaterThan(2.4)
  })
})
