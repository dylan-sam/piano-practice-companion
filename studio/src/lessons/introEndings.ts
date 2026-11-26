// Intros and endings of the Lessons tab: a lesson step opens a song with bars added before and
// after its head (the "frame"), their chords written and their melody left empty, so the student
// makes an intro and an ending of a fixed number of bars with the band. The framed sheet exists
// only for that visit (lessonLink `frame`): the catalog keeps the song as it is.
//
// Chords are written in the chart's own key (they follow any transposition). A song that starts
// with a pickup bar (no chord, the melody's first notes at its end) takes the intro's last chord
// in that bar, so the intro is the number of bars it says, its last bar holding the pickup.

import type { Chart, ChartBar } from '../music/chart'

/**
 * Bars added to a song, each written as its chords ("G-7 C7": two chords sharing the bar), with
 * their Roman numerals (one per bar), how to build them, and an example written out: a right-hand
 * line in ABC notation, in C (the lesson page draws it in the song's key), and what it shows.
 */
export interface FrameBars { bars: string[]; numerals: string[]; how: string; example: { abc: string; text: string } }

/** An intro and an ending for a song: the bars, and how to build them, in a few sentences. */
export interface Frame {
  song: string // the start of the song's title
  key: number // the key of the song's chart (pitch class): the bars are written in it
  intro: FrameBars
  ending: FrameBars
}

/** An example line: ABC of one staff in C, quarter notes unless `length` says otherwise. */
const line = (body: string, length = '1/4') => `X:1\nL:${length}\nK:C\n${body}`

// What every intro and every ending is for, before the song's own way of making them
const INTRO_WHY = 'An intro sets the key, the tempo and the feel for everyone, and leads into the first bar of the melody.'
const ENDING_WHY = 'An ending tells the band and the listeners that the song is over, instead of simply stopping on the last chord.'

export const FRAMES = {
  avalon: {
    song: 'Avalon',
    key: 5,
    intro: { bars: ['G-7', 'C7', 'F', 'F'], numerals: ['ii', 'V7', 'I', 'I'], how: 'This intro uses the last 4 bars of the song, which is the easiest intro there is. Play their melody, or the chord tones in a rhythm of your own, and finish with the pickup notes that lead into the head.',
      example: { abc: line('"D-7"A2 F2 | "G7"G2 B2 | "C"c4- | c2 z2 |]'), text: 'One way to play it, shown in C: half notes on chord tones, then the tonic held. An intro needs no more than this: clear, in time, and ending on a note that leads into the head.' } },
    ending: { bars: ['G-7', 'C7', 'F6', 'F6'], numerals: ['ii', 'V7', 'I6', 'I6'], how: 'This ending repeats the last 4 bars once more (a repeat like this is called a "tag"). On the final chord, play F as a 6th chord: add the 6th (D) and the 9th (G) to the triad, and hold it for 2 bars.',
      example: { abc: line('"D-7"F A c A | "G7"B d f d | "C6"[EGAd]4- | [EGAd]4 |]'), text: 'One way to play it, shown in C: climb the arpeggio of the ii, then of the V, and hold the last chord as a 6/9 chord (E G A D: the 3rd, the 5th, the 6th and the 9th). Played softly and held, it sounds finished and open at once.' } },
  },
  tinRoof: {
    song: 'Tin Roof Blues',
    key: 3,
    intro: { bars: ['Eb C7', 'F-7 Bb7', 'Eb C7', 'F-7 Bb7'], numerals: ['I VI7', 'ii V7', 'I VI7', 'ii V7'], how: 'This intro is a turnaround played twice: I VI ii V (E♭ C7 F−7 B♭7), the chords that end a blues chorus. Make up a riff of 2 bars and play it twice; the B♭7 at the end leads you into the head.',
      example: { abc: line('"C"c2 _e =e g2 "A7"e2 | "D-7"f2 d c "G7"B2 G2 |]', '1/8'), text: 'A two-bar riff, shown in C, to play twice: it starts with the blue third (E♭ sliding to E) and walks down through the turnaround to G, the 5th of the key, ready for the head.' } },
    ending: { bars: ['E7', 'Eb6'], numerals: ['♭II7', 'I6'], how: 'This ending plays the chord a half step above the tonic (E7, called ♭II7), then the tonic itself, held. The chord falls home by a half step, a sound you hear at the end of many blues.',
      example: { abc: line('"Db7"[F_A_c_d]4 | "C6"[EGAc]4 |]'), text: 'Shown in C: three notes of D♭7 fall a half step onto C6 (F to E, A♭ to G, D♭ to C), and its 7th (C♭) falls onto the 6th (A). Play the two chords slowly and let the last one ring.' } },
  },
  honeysuckle: {
    song: 'Honeysuckle Rose',
    key: 5,
    intro: { bars: ['G-7 C7', 'G-7 C7', 'G-7 C7', 'G-7 C7'], numerals: ['ii V7', 'ii V7', 'ii V7', 'ii V7'], how: 'This intro is a vamp: the first ii-V of the song (G−7 C7) repeated four times. Play one short idea and vary it a little each time; the head then starts on the same ii-V.',
      example: { abc: line('"D-7"z F A c "G7"B2 G2 | "D-7"z F A c "G7"d2 B2 | "D-7"z F A c "G7"f2 d2 | "D-7"z F A c "G7"B G F D |]', '1/8'), text: 'Shown in C: the same start four times, climbing the D−7 arpeggio, with a new ending over G7 each time. Repeating the beginning and changing the end is how a vamp stays interesting without losing its shape.' } },
    ending: { bars: ['A-7 D7', 'G-7 C7', 'A-7 D7', 'G-7 C7', 'F6'], numerals: ['iii VI7', 'ii V7', 'iii VI7', 'ii V7', 'I6'], how: 'This is the "three times" tag. Instead of resting on F, the band plays iii VI ii V (A−7 D7 G−7 C7) twice, so that the final ii-V is heard three times in all, and only then lands on the I, held.',
      example: { abc: line('"E-7"G2 "A7"G2 | "D-7"F2 "G7"F2 | "E-7"G2 "A7"G2 | "D-7"F2 "G7"F2 | "C6"E4 |]\nw: 3rd 7th 3rd 7th 3rd 7th 3rd 7th 3rd'), text: 'The guide tones of the tag, shown in C: G is the 3rd of E−7 and stays as the 7th of A7, F is the 3rd of D−7 and stays as the 7th of G7, and the line comes to rest on E, the 3rd of C. Play this line first, then decorate it.' } },
  },
  loveMe: {
    song: 'Love Me Or Leave Me',
    key: 0,
    intro: { bars: ['Bh7 E7', 'Bh7 E7', 'Bh7 E7', 'Bh7 E7'], numerals: ['iiø V7 (A minor)', 'iiø V7', 'iiø V7', 'iiø V7'], how: 'This intro is a vamp on the minor ii-V of the song (Bø7 E7), four times. Over each E7, aim for its ♭9 (F) and let it fall to E; the head then starts on A−7.',
      example: { abc: line('"Bm7b5"D F "E7"F E | "Bm7b5"A F "E7"F2 |]'), text: 'Two bars of the vamp: over each E7, F (its ♭9) falls a half step to E, the 5th of A minor. Play these two bars, then the next two with a small change of your own.' } },
    ending: { bars: ['F-6', 'C^7', 'F-6', 'C6'], numerals: ['iv−6', 'Imaj7', 'iv−6', 'I6'], how: 'This ending moves from the minor iv chord (F−6) to the I, twice. This is the "amen" sound heard at the end of hymns; hold the last chord.',
      example: { abc: line('"F-6"[F_Ad]4 | "Cmaj7"[EGB]4 | "F-6"[F_Ad]4 | "C6"[EGA]4 |]'), text: 'Listen to the two half steps: F falls to E and A♭ falls to G each time the minor iv goes to the I. This is the sound of the "amen" at the end of a hymn.' } },
  },
  gotRhythm: {
    song: 'I Got Rhythm',
    key: 10,
    intro: { bars: ['Bb G-7', 'C-7 F7', 'Bb G-7', 'Ah7 D7'], numerals: ['I vi', 'ii V7', 'I vi', 'iiø V7 (A minor)'], how: 'This intro plays I vi ii V (B♭ G−7 C−7 F7), the classic intro of Rhythm Changes, then a minor ii-V (Aø7 D7) that leads into the verse in G minor.',
      example: { abc: line('"C"E2 "A-7"E2 | "D-7"F2 "G7"F2 | "C"E2 "A-7"E2 | "Bm7b5"D2 "E7"^G2 |]'), text: 'Shown in C: one note per chord, each moving as little as possible. The last note, G♯ (the 3rd of E7), pulls up into A, the first note of the verse in A minor (G minor in the key of the song).' } },
    ending: { bars: ['Gb7', 'B7', 'Bb6', 'Bb6'], numerals: ['♭VI7', '♭II7', 'I6', 'I6'], how: 'This ending plays ♭VI7, then ♭II7, then I (G♭7, B7, B♭): two dominant chords that slide down by half steps into the tonic, which you hold.',
      example: { abc: line('"Ab7"_G4 | "Db7"F4 | "C6"E4- | E4 |]\nw: 7th 3rd 3rd'), text: 'Shown in C: the 7th of A♭7 (G♭) falls a half step to the 3rd of D♭7 (F), which falls a half step to the 3rd of C (E). Under this line, the roots fall by a 5th and then by a half step.' } },
  },
  thisThing: {
    song: 'What Is This Thing Called Love',
    key: 0,
    intro: { bars: ['Gh7 C7b9', 'Gh7 C7b9', 'Gh7 C7b9', 'Gh7 C7b9'], numerals: ['iiø V7♭9 (F minor)', 'iiø V7♭9', 'iiø V7♭9', 'iiø V7♭9'], how: 'This intro is a vamp on the first ii-V of the song (Gø7 C7♭9), four times; its last bar holds the pickup of the head. Use the ♭9 of C7 (D♭) in your line.',
      example: { abc: line('"Gm7b5"G _B "C7b9"_D C | "Gm7b5"_B G "C7b9"_D2 |]'), text: 'Two bars of the vamp: D♭, the ♭9 of C7, falls to C the first time and is held the second time, so the tension waits for the head. Use the same idea in the next two bars, a little changed.' } },
    ending: { bars: ['E-7 A7b9', 'D-7 G7b9', 'E-7 A7b9', 'D-7 G7b9', 'C^7'], numerals: ['iii VI7♭9', 'ii V7♭9', 'iii VI7♭9', 'ii V7♭9', 'Imaj7'], how: 'This is the "three times" tag with altered dominants: after the I, the band plays iii VI ii V (E−7 A7♭9 D−7 G7♭9) twice, then the I, held.',
      example: { abc: line('"E-7"B2 "A7b9"_B2 | "D-7"A2 "G7b9"_A2 | "E-7"B2 "A7b9"_B2 | "D-7"A2 "G7b9"_A2 | "Cmaj7"G4 |]'), text: 'Each ♭9 falls a half step onto the 5th of the next chord: B♭ (the ♭9 of A7) to A (the 5th of D−7), and A♭ (the ♭9 of G7) to G (the 5th of C). A line of half steps that leads all the way home.' } },
  },
  minorBlues: {
    song: 'Minor Study Blues',
    key: 0,
    intro: { bars: ['Ab7', 'G7b9b13', 'C-7', 'Dh7 G7b9b13'], numerals: ['♭VI7', 'V7♭9♭13', 'i−7', 'iiø V7'], how: 'This intro uses the last 4 bars of the blues (♭VI7, V7, i and the minor ii-V). Play a riff over them; the G7♭9♭13 at the end leads into the head.',
      example: { abc: line('"Ab7"_E c _G2 | "G7b9b13"_A G =B,2 | "C-7"C _E G _B | "Dm7b5"_A F "G7b9b13"_A G |]'), text: 'Four bars of chord tones: the 5th, 3rd and 7th of A♭7, then A♭ (the ♭9 of G7) falling to G before the 3rd, B. The C−7 arpeggio and a last ♭9 lead into the head.' } },
    ending: { bars: ['Ab7', 'G7b9b13', 'C-6', 'C-6'], numerals: ['♭VI7', 'V7♭9♭13', 'i−6', 'i−6'], how: 'This ending plays ♭VI7 and V7, then the tonic as a minor 6th chord (C−6), held. The 6th gives the last minor chord a warm, finished sound.',
      example: { abc: line('"Ab7"c2 _G2 | "G7b9b13"=B2 _A2 | "C-6"[C_EGA]4- | [C_EGA]4 |]'), text: 'The 3rd and 7th of A♭7, then the 3rd and ♭9 of G7, and the last chord held as C−6 (C E♭ G A): the 6th, A, is what gives it its warm, finished sound.' } },
  },
  embraceable: {
    song: 'Embraceable You',
    key: 7,
    intro: { bars: ['G Eb7', 'A7 D7', 'G E-7', 'A-7 D7'], numerals: ['I ♭VI7', 'II7 V7', 'I vi', 'ii V7'], how: 'This intro plays the last 2 bars of the song, then a turnaround (I vi ii V). Play it softly with long notes: this is a ballad.',
      example: { abc: line('"C"G2 "Ab7"_G2 | "D7"^F2 "G7"=F2 | "C"E2 "A-7"E2 | "D-7"F2 "G7"F2 |]'), text: 'Shown in C: a slow line that falls by half steps, G, G♭, F♯, F, E, each note a chord tone (the 5th of C, the 7th of A♭7, the 3rd of D7, the 7th of G7, the 3rd of C). Play it softly, holding each note its full length.' } },
    ending: { bars: ['C-6', 'G^7', 'G^7'], numerals: ['iv−6', 'Imaj7', 'Imaj7'], how: 'This ending moves from the minor iv chord (C−6) to Gmaj7, held with its 9th (A) on top.',
      example: { abc: line('"F-6"[F_Ad]4 | "Cmaj7"[EGBd]4- | [EGBd]4 |]'), text: 'Shown in C: the minor iv (F−6) melts into Cmaj7, held with its 9th (D) on top. In a ballad, let the last chord ring until it fades.' } },
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
    'play the chords with your left hand (the band plays them with you) and make up the intro and the ending with your right hand. ' +
    'The theory below shows the chords of each with their Roman numerals, and one way to play each written out: play the written example first, then make up your own in the same bars.\n' +
    `Intro, ${frame.intro.bars.length} bars. ${INTRO_WHY} ${frame.intro.how}\n` +
    `Ending, ${frame.ending.bars.length} bars. ${ENDING_WHY} ${frame.ending.how}`
}
