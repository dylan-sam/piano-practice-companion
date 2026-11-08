import type { BassNote, BassPart, CompHit, CompPart, DrumHit, DrumPart, StyleDefinition, StyleFamily } from './types'

// The band in 6/8 (and 9/8, 12/8): two dotted-quarter pulses to the bar, straight eighths.
// Positions are in quarter-note beats like everywhere else, so the eighths of a 6/8 bar sit at
// 0, 0.5, 1, 1.5, 2 and 2.5 and the pulses at 0 and 1.5. A style keeps its own sounds
// (instruments, kit, voicings, dynamics); only the patterns come from here, by style family.

type Feel = 'jazz' | 'latin' | 'pop'

// The drum feel used in compound meter for a style family
const feelOf = (family: StyleFamily): Feel => (family === 'jazz' ? 'jazz' : family === 'latin' ? 'latin' : 'pop')

const BASS: Record<string, BassNote[][]> = {
  '3': [
    [
      { at: 0, dur: 1.4, tone: 'R' },
      { at: 1.5, dur: 1.4, tone: '5' },
    ],
    [{ at: 0, dur: 2.8, tone: 'R' }],
    [
      { at: 0, dur: 0.9, tone: 'R' },
      { at: 1, dur: 0.4, tone: 'R', vel: 74 },
      { at: 1.5, dur: 0.9, tone: '5' },
      { at: 2.5, dur: 0.4, tone: 'app', vel: 80 },
    ],
  ],
  '1.5': [
    [{ at: 0, dur: 1.4, tone: 'R' }],
    [
      { at: 0, dur: 0.9, tone: 'R' },
      { at: 1, dur: 0.4, tone: '5', vel: 76 },
    ],
  ],
}

const COMP: Record<Feel, Record<string, CompHit[][]>> = {
  jazz: {
    '3': [
      [
        [0, 0.9],
        [1.5, 0.9],
      ],
      [
        [0, 0.4],
        [1, 0.4],
        [2.5, 0.4],
      ],
      [
        [1, 0.4],
        [1.5, 1.2],
      ],
      [[0, 2.6]],
    ],
    '1.5': [
      [[0, 0.9]],
      [
        [0.5, 0.4],
        [1, 0.4],
      ],
    ],
  },
  latin: {
    '3': [
      [
        [0, 0.4],
        [1, 0.4],
        [2, 0.4],
        [2.5, 0.4],
      ],
      [
        [0.5, 0.4],
        [1.5, 0.4],
        [2.5, 0.4],
      ],
      [
        [0, 1.2],
        [2, 0.9],
      ],
    ],
    '1.5': [
      [
        [0, 0.4],
        [1, 0.4],
      ],
      [[0.5, 0.9]],
    ],
  },
  pop: {
    '3': [
      [
        [0, 1.4],
        [1.5, 1.4],
      ],
      [
        [0, 0.9],
        [1, 0.4],
        [1.5, 1.4],
      ],
      [[0, 2.8]],
    ],
    '1.5': [
      [[0, 1.4]],
      [
        [0, 0.9],
        [1, 0.4],
      ],
    ],
  },
}

// Two-bar grooves span a pair of 6/8 bars (offset 3)
const shifted = (hits: DrumHit[], by: number): DrumHit[] => hits.map(([at, ...rest]) => [at + by, ...rest] as DrumHit)

// A jazz drum bar in compound meter
function jazzBar(): DrumHit[] {
  return [
    [0, 'ride', 86],
    [0.5, 'ride', 56],
    [1, 'ride', 66],
    [1.5, 'ride', 82],
    [2, 'ride', 56],
    [2.5, 'ride', 66],
    [0, 'kick', 40],
    [1.5, 'hhPedal', 66],
  ]
}

// The 6/8 bell over two bars: x.x.xx.x.x.x
function latinPair(): DrumHit[] {
  const bell: DrumHit[] = [0, 1, 2, 2.5, 3.5, 4.5, 5.5].map((at) => [at, 'cowbell', at % 3 === 0 ? 74 : 60])
  // A latin bar of kick, congas and shaker from an offset
  const bar = (o: number): DrumHit[] => [
    [o, 'kick', 76],
    [o + 1.5, 'kick', 62],
    [o + 1, 'congaMute', 58],
    [o + 2, 'congaHigh', 66],
    [o + 2.5, 'congaLow', 72],
    [o + 0.5, 'shaker', 44],
    [o + 2, 'shaker', 44],
  ]
  return [...bell, ...bar(0), ...bar(3)]
}

// A pop drum bar in compound meter
function popBar(): DrumHit[] {
  return [
    ...[0, 0.5, 1, 1.5, 2, 2.5].map((at): DrumHit => [at, 'hhClosed', at === 0 || at === 1.5 ? 80 : 58]),
    [0, 'kick', 92],
    [1.5, 'snare', 88],
  ]
}

// Drums for compound meter, keeping the style's kit and count-in
function compoundDrums(feel: Feel, own: DrumPart): DrumPart {
  const { countIn } = own // the count-in follows the meter (engine/timeline.ts)
  const crash: DrumHit = [0, 'crash', 90, 1, 2] // always: it takes the place of the downbeat's hi-hat

  if (feel === 'jazz') {
    const bar = jazzBar()
    return {
      kit: own.kit,
      countIn,
      grooves: {
        middle: [
          { bars: 2, beats: 3, hits: [...bar, ...shifted(bar, 3), [5.5, 'snare', 44, 0.4]] },
          { bars: 2, beats: 3, hits: [...bar, ...shifted(bar, 3), [2, 'sidestick', 52, 0.5], [4, 'kick', 42, 0.4]] },
        ],
        first: [{ bars: 1, beats: 3, hits: [...bar, crash] }],
        last: [{ bars: 1, beats: 3, hits: [...bar, [1.5, 'snare', 60], [2, 'snare', 68], [2.5, 'snare', 76]] }],
      },
      ending: own.ending,
    }
  }

  if (feel === 'latin') {
    const pair = latinPair()
    return {
      kit: own.kit,
      countIn,
      grooves: {
        middle: [{ bars: 2, beats: 3, hits: pair }],
        first: [{ bars: 1, beats: 3, hits: [...pair.filter(([at]) => at < 3), crash] }],
        last: [
          { bars: 1, beats: 3, hits: [...pair.filter(([at]) => at < 3), [1.5, 'tomHigh', 74], [2, 'tomMid', 78], [2.5, 'tomLow', 84]] },
        ],
      },
      ending: own.ending,
    }
  }

  const bar = popBar()
  return {
    kit: own.kit,
    countIn,
    grooves: {
      middle: [
        { bars: 2, beats: 3, hits: [...bar, ...shifted(bar, 3), [2.5, 'kick', 70, 0.5], [5, 'kick', 66, 0.4]] },
        { bars: 2, beats: 3, hits: [...bar, ...shifted(bar, 3), [1, 'kick', 72, 0.6], [5.5, 'snare', 50, 0.4]] },
      ],
      // The crash takes the place of the first hi-hat; the rest of the bar plays as usual
      first: [{ bars: 1, beats: 3, hits: [...bar.filter(([at, d]) => !(d === 'hhClosed' && at === 0)), crash] }],
      last: [
        {
          bars: 1,
          beats: 3,
          hits: [...bar.filter(([at]) => at < 1.5), [1.5, 'snare', 80], [2, 'tomHigh', 82], [2.5, 'tomLow', 88]],
        },
      ],
    },
    ending: own.ending,
  }
}

// The style as played in a compound meter
export function compoundStyle(style: StyleDefinition): StyleDefinition {
  const feel = feelOf(style.family)
  const bass: BassPart = { mode: 'pattern', program: style.bass.program, range: style.bass.range, patterns: BASS }
  const comp: CompPart = { ...style.comp, rhythms: COMP[feel], anticipation: 0 }
  return { ...style, swing: 0.5, bass, comp, drums: compoundDrums(feel, style.drums) }
}
