// The Jazz Waltz: a swing feel in three. The drums and the bass come from OpenStand's
// jazz-waltz.ts (ride on 1, 2 and the "and" of 2, hi-hat pedal on 2 and 3, a feathered kick on
// 1, a light snare comment now and then; the bass mixes a held root, root and 5th, and three
// walking quarters with a half-step approach). The piano's chord comping is varied bar to bar
// from the figures Wynton Kelly plays behind Miles Davis on "Someday My Prince Will Come"
// (1961), after a published transcription: the dotted-quarter cell (1 and the "and" of 2), the
// two off-beats, beat 2 held, beats 1 and 3, a chord held on 1, a chord laid in on the "and" of 1.
// The style's other pattern, "bass on 1, chords on 2 and 3", is a piano pattern
// (data/left_hand_patterns.json) played over WALTZ_DOWNBEAT_BASS.

import type { BassPart, DrumHit, StyleDefinition } from './types'

/** One bar of the waltz's time, starting at beat `at`. */
function time(at: number): DrumHit[] {
  return [
    [at, 'ride', 80], [at + 1, 'ride', 86], [at + 1.5, 'ride', 60], [at + 2, 'ride', 74],
    [at + 1, 'hhPedal', 62], [at + 2, 'hhPedal', 70],
    [at, 'kick', 36], // feathered: felt more than heard
  ]
}

// The bass under the chord comping: a held root, root and 5th, or three walking quarters
const WALTZ_BASS: BassPart = {
  mode: 'pattern', program: 32, range: [28, 55], patterns: {
    '3': [
      [{ at: 0, dur: 2.8, tone: 'R' }],
      [{ at: 0, dur: 1.8, tone: 'R' }, { at: 2, dur: 0.9, tone: '5' }],
      [{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: '3' }, { at: 2, dur: 0.9, tone: 'app' }],
      [{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: '5' }, { at: 2, dur: 0.9, tone: 'app' }],
    ],
    '4': [[{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: '3' }, { at: 2, dur: 0.9, tone: '5' }, { at: 3, dur: 0.9, tone: 'app' }]],
    '2': [[{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: 'app' }]],
    '1': [[{ at: 0, dur: 0.9, tone: 'R' }]],
  },
}

/** The bass under "bass on 1, chords on 2 and 3": the root of each chord, held (arrange.ts). */
export const WALTZ_DOWNBEAT_BASS: BassPart = {
  mode: 'pattern', program: 32, range: [28, 55], patterns: {
    '4': [[{ at: 0, dur: 3.8, tone: 'R' }]],
    '3': [[{ at: 0, dur: 2.8, tone: 'R' }]],
    '2': [[{ at: 0, dur: 1.8, tone: 'R' }]],
    '1': [[{ at: 0, dur: 0.9, tone: 'R' }]],
  },
}

export const JAZZ_WALTZ: StyleDefinition = {
  id: 'jazz-waltz',
  name: 'Jazz Waltz',
  family: 'jazz',
  swing: 0.64,
  tempo: { default: 150, min: 40, max: 300 },
  bass: WALTZ_BASS,
  comp: {
    program: 0,
    voicing: 'rootless',
    velocity: [56, 72],
    rhythms: {
      // Kelly's figures, one picked each bar ([beat, length])
      '3': [
        [[0, 0.8], [1.5, 0.4]], // the dotted-quarter cell
        [[0.5, 0.4], [1.5, 0.4]], // the two off-beats
        [[1, 1.6]], // beat 2, held
        [[0, 0.5], [2, 0.5]], // beats 1 and 3
        [[0, 2]], // laid in on 1 and held
        [[0.5, 1.2]], // laid in on the "and" of 1
      ],
      // A 4/4 bar (a song in 4/4 played as a waltz, or a bar of 4 in a waltz): Swing's figures
      '4': [[[0, 1.4], [1.5, 0.5]], [[1.5, 0.5], [3, 0.8]], [[0, 0.7], [2.5, 0.9]]],
      '2': [[[0, 0.8]], [[0.5, 0.5]]],
      '1': [[[0, 0.6]]],
    },
  },
  drums: {
    kit: 32,
    countIn: [[0, 'sidestick', 95], [1, 'sidestick', 80], [2, 'sidestick', 80]],
    grooves: {
      middle: [
        { bars: 2, beats: 3, hits: [...time(0), ...time(3), [5.5, 'snare', 46, 0.3]] },
        { bars: 2, beats: 3, hits: [...time(0), ...time(3), [2.5, 'snare', 44, 0.3], [4, 'kick', 40, 0.4]] },
      ],
      first: [{ bars: 1, beats: 3, hits: [...time(0), [0, 'crash', 88, 0.6, 2], [0, 'kick', 78, 0.6]] }],
      last: [{ bars: 1, beats: 3, hits: [...time(0), [1.5, 'snare', 62, 0.8], [2, 'snare', 72], [2.5, 'snare', 80]] }],
    },
    ending: [[0, 'crash', 100, 1, 3], [0, 'kick', 90]],
  },
}
