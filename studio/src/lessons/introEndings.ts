// Intros and endings of the Lessons tab: a lesson step opens a song with bars added before and
// after its head (the "frame"), their chords written and their melody left empty, so the student
// makes an intro and an ending of a fixed number of bars with the band. The framed sheet exists
// only for that visit (lessonLink `frame`): the catalog keeps the song as it is.
//
// Chords are written in the chart's own key (they follow any transposition). A song that starts
// with a pickup bar (no chord, the melody's first notes at its end) takes the intro's last chord
// in that bar, so the intro is the number of bars it says, its last bar holding the pickup.

import type { Chart, ChartBar } from '../music/chart'

/** Bars added to a song, each written as its chords ("G-7 C7": two chords sharing the bar). */
export interface FrameBars { bars: string[]; how: string }

/** An intro and an ending for a song: the bars, and how to build them, in a few sentences. */
export interface Frame {
  song: string // the start of the song's title
  intro: FrameBars
  ending: FrameBars
}

// What every intro and every ending is for, before the song's own way of making them
const INTRO_WHY = 'An intro sets the key, the tempo and the feel for everyone, and leads into the first bar of the melody.'
const ENDING_WHY = 'An ending tells the band and the listeners that the song is over, instead of simply stopping on the last chord.'

export const FRAMES = {
  avalon: {
    song: 'Avalon',
    intro: { bars: ['G-7', 'C7', 'F', 'F'], how: 'This intro uses the last 4 bars of the song, which is the easiest intro there is. Play their melody, or the chord tones in a rhythm of your own, and finish with the pickup notes that lead into the head.' },
    ending: { bars: ['G-7', 'C7', 'F6', 'F6'], how: 'This ending repeats the last 4 bars once more (a repeat like this is called a "tag"). On the final chord, play F as a 6th chord: add the 6th (D) and the 9th (G) to the triad, and hold it for 2 bars.' },
  },
  tinRoof: {
    song: 'Tin Roof Blues',
    intro: { bars: ['Eb C7', 'F-7 Bb7', 'Eb C7', 'F-7 Bb7'], how: 'This intro is a turnaround played twice: I VI ii V (E♭ C7 F−7 B♭7), the chords that end a blues chorus. Make up a riff of 2 bars and play it twice; the B♭7 at the end leads you into the head.' },
    ending: { bars: ['E7', 'Eb6'], how: 'This ending plays the chord a half step above the tonic (E7, called ♭II7), then the tonic itself, held. The chord falls home by a half step, a sound you hear at the end of many blues.' },
  },
  honeysuckle: {
    song: 'Honeysuckle Rose',
    intro: { bars: ['G-7 C7', 'G-7 C7', 'G-7 C7', 'G-7 C7'], how: 'This intro is a vamp: the first ii-V of the song (G−7 C7) repeated four times. Play one short idea and vary it a little each time; the head then starts on the same ii-V.' },
    ending: { bars: ['A-7 D7', 'G-7 C7', 'A-7 D7', 'G-7 C7', 'F6'], how: 'This is the "three times" tag. Instead of resting on F, the band plays iii VI ii V (A−7 D7 G−7 C7) twice, so that the final ii-V is heard three times in all, and only then lands on the I, held.' },
  },
  loveMe: {
    song: 'Love Me Or Leave Me',
    intro: { bars: ['Bh7 E7', 'Bh7 E7', 'Bh7 E7', 'Bh7 E7'], how: 'This intro is a vamp on the minor ii-V of the song (Bø7 E7), four times. Over each E7, aim for its ♭9 (F) and let it fall to E; the head then starts on A−7.' },
    ending: { bars: ['F-6', 'C^7', 'F-6', 'C6'], how: 'This ending moves from the minor iv chord (F−6) to the I, twice. This is the "amen" sound heard at the end of hymns; hold the last chord.' },
  },
  gotRhythm: {
    song: 'I Got Rhythm',
    intro: { bars: ['Bb G-7', 'C-7 F7', 'Bb G-7', 'Ah7 D7'], how: 'This intro plays I vi ii V (B♭ G−7 C−7 F7), the classic intro of Rhythm Changes, then a minor ii-V (Aø7 D7) that leads into the verse in G minor.' },
    ending: { bars: ['Gb7', 'B7', 'Bb6', 'Bb6'], how: 'This ending plays ♭VI7, then ♭II7, then I (G♭7, B7, B♭): two dominant chords that slide down by half steps into the tonic, which you hold.' },
  },
  thisThing: {
    song: 'What Is This Thing Called Love',
    intro: { bars: ['Gh7 C7b9', 'Gh7 C7b9', 'Gh7 C7b9', 'Gh7 C7b9'], how: 'This intro is a vamp on the first ii-V of the song (Gø7 C7♭9), four times; its last bar holds the pickup of the head. Use the ♭9 of C7 (D♭) in your line.' },
    ending: { bars: ['E-7 A7b9', 'D-7 G7b9', 'E-7 A7b9', 'D-7 G7b9', 'C^7'], how: 'This is the "three times" tag with altered dominants: after the I, the band plays iii VI ii V (E−7 A7♭9 D−7 G7♭9) twice, then the I, held.' },
  },
  minorBlues: {
    song: 'Minor Study Blues',
    intro: { bars: ['Ab7', 'G7b9b13', 'C-7', 'Dh7 G7b9b13'], how: 'This intro uses the last 4 bars of the blues (♭VI7, V7, i and the minor ii-V). Play a riff over them; the G7♭9♭13 at the end leads into the head.' },
    ending: { bars: ['Ab7', 'G7b9b13', 'C-6', 'C-6'], how: 'This ending plays ♭VI7 and V7, then the tonic as a minor 6th chord (C−6), held. The 6th gives the last minor chord a warm, finished sound.' },
  },
  embraceable: {
    song: 'Embraceable You',
    intro: { bars: ['G Eb7', 'A7 D7', 'G E-7', 'A-7 D7'], how: 'This intro plays the last 2 bars of the song, then a turnaround (I vi ii V). Play it softly with long notes: this is a ballad.' },
    ending: { bars: ['C-6', 'G^7', 'G^7'], how: 'This ending moves from the minor iv chord (C−6) to Gmaj7, held with its 9th (A) on top.' },
  },
} satisfies Record<string, Frame>

/** A bar of a frame: its chords sharing the bar, no melody. */
function frameBar(chords: string, beats: number, rowStart: boolean): ChartBar {
  const symbols = chords.split(' ')
  return { chords: symbols.map((symbol) => ({ symbol, beats: beats / symbols.length })), cells: 4, ...(rowStart ? { rowStart: true } : {}) }
}

/** Whether a bar is a pickup bar: no chord written in it (N.C.), the melody starting in it. */
const isPickup = (bar: ChartBar | undefined) => !!bar && bar.chords.length === 1 && !bar.chords[0].symbol

/**
 * A chart with a frame's intro before its head and ending after it (4/4 bars, the melody moved
 * along). A pickup bar takes the intro's last chord. The chart itself when the frame is not its.
 */
export function withFrame(chart: Chart, frame: Frame): Chart {
  if (!chart.title.toLowerCase().startsWith(frame.song.toLowerCase())) return chart
  const beats = chart.time ? (chart.time[0] * 4) / chart.time[1] : 4
  const pickup = isPickup(chart.bars[0])
  const added = pickup ? frame.intro.bars.slice(0, -1) : frame.intro.bars
  const intro = added.map((chords, i) => ({ ...frameBar(chords, beats, i % 4 === 0), ...(i === 0 ? { section: 'i' } : {}) }))
  const head = chart.bars.map((bar, i) => {
    const kept = { ...bar, rowStart: i === 0 ? true : bar.rowStart, barline: bar.barline === 'final' ? undefined : bar.barline }
    return pickup && i === 0 ? { ...kept, chords: frameBar(frame.intro.bars.at(-1)!, beats, true).chords } : kept
  })
  const ending = frame.ending.bars.map((chords, i) => ({
    ...frameBar(chords, beats, i === 0), ...(i === frame.ending.bars.length - 1 ? { barline: 'final' as const } : {}),
  }))
  const melody = chart.melody && { ...chart.melody, notes: chart.melody.notes.map((note) => ({ ...note, bar: note.bar + added.length })) }
  return { ...chart, bars: [...intro, ...head, ...ending], ...(melody ? { melody } : {}) }
}

/** A chart with the frame of a lesson link (by its id), or as it is without one. */
export function withFrameOf(chart: Chart, id: string | undefined): Chart {
  const frame = id ? (FRAMES as Record<string, Frame>)[id] : undefined
  return frame ? withFrame(chart, frame) : chart
}

/**
 * The words of a step, a paragraph each: what to do with the added bars, how to build the intro,
 * how to build the ending.
 */
export function frameText(frame: Frame): string {
  return `For this step the sheet has ${frame.intro.bars.length} bars added before the head and ${frame.ending.bars.length} after it. Their chords are written, but there is no melody: ` +
    'play the chords with your left hand (the band plays them with you) and make up the intro and the ending with your right hand.\n' +
    `Intro, ${frame.intro.bars.length} bars. ${INTRO_WHY} ${frame.intro.how}\n` +
    `Ending, ${frame.ending.bars.length} bars. ${ENDING_WHY} ${frame.ending.how}`
}
