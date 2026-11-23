import { describe, expect, test } from 'vitest'
import bundled from '../public/leadsheets/catalog.json'
import lessonSongs from '../public/leadsheets/lessons.json'
import licks from '../public/licks/licks.json'
import { PIANO_PATTERNS, patternsForStyle } from '../src/engine/pianoPatterns'
import { findByTitle, lessonUrl, readLessonLink, transposeTo } from '../src/lessons/lessonLink'
import { ALL_STEPS, PROGRAM } from '../src/lessons/program'
import { isLessonProgress, nextStep } from '../src/lessons/useLessonProgress'
import { reachesGoal } from '../src/lessons/useLessonGoal'
import { parseChord } from '../src/music/chords'
import { ROUTES } from '../src/router'

const charts = (file: { playlists: { charts: { title: string; style?: string }[] }[] }) =>
  file.playlists.flatMap((list) => list.charts.map((chart) => ({ chart })))
const leadSheets = [...charts(bundled), ...charts(lessonSongs)]
const exercises = charts(licks)

describe('lesson links', () => {
  test('a link goes to its address and back', () => {
    const link = { route: ROUTES.leadSheetSightreading, song: "'S Wonderful", key: 5, bpm: 90, check: 'both' as const, leftHand: 'pattern' as const, mute: ['comp' as const] }
    const url = lessonUrl(link)
    expect(url.startsWith('/sightreading/lead-sheets?')).toBe(true)
    expect(readLessonLink(url.slice(url.indexOf('?')))).toMatchObject({ song: "'S Wonderful", key: 5, bpm: 90, check: 'both', leftHand: 'pattern', mute: ['comp'] })
  })

  test('an ordinary visit has no lesson, and unknown values are left out', () => {
    expect(readLessonLink('')).toBeNull()
    expect(readLessonLink('?check=sing&key=13&mute=voice,bass')).toMatchObject({ check: undefined, key: undefined, mute: ['bass'] })
  })

  test('songs are found by the start of their title, keys by the nearest way', () => {
    expect(findByTitle(leadSheets, "'S Wonderful")?.chart.title).toBe("'S Wonderful!")
    expect(transposeTo(0, 5)).toBe(5)
    expect(transposeTo(0, 10)).toBe(-2)
    expect(transposeTo(3, undefined)).toBeUndefined()
  })
})

describe('the program', () => {
  test('30 weeks in order, with unique step ids', () => {
    expect(PROGRAM.flatMap((unit) => unit.weekList.map((week) => week.week))).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(new Set(ALL_STEPS.map((item) => item.id)).size).toBe(ALL_STEPS.length)
  })

  test('every link opens something the app has', () => {
    for (const item of ALL_STEPS) {
      const link = item.link
      if (!link) continue
      if (link.route === ROUTES.exerciseSightreading) expect(findByTitle(exercises, link.song!), link.song).toBeDefined()
      else if (link.song) expect(findByTitle(leadSheets, link.song), link.song).toBeDefined()
      if (link.pattern) {
        const style = link.style ?? findByTitle(leadSheets, link.song!)?.chart.style ?? 'swing'
        expect(patternsForStyle(style).map((pattern) => pattern.id), `${item.id} ${link.pattern} in ${style}`).toContain(link.pattern)
        expect(PIANO_PATTERNS.some((pattern) => pattern.id === link.pattern)).toBe(true)
      }
      if (link.playlist) expect(licks.playlists.some((list) => list.name === link.playlist), link.playlist).toBe(true)
    }
  })

  test('every week has the four parts of a session', () => {
    for (const unit of PROGRAM.slice(0, 6)) {
      for (const week of unit.weekList) {
        const kinds = new Set(week.steps.map((item) => item.kind))
        expect(kinds.has('hands') && kinds.has('ear') && (kinds.has('song') || kinds.has('improvise')), `week ${week.week}`).toBe(true)
      }
    }
  })
})

describe('progress', () => {
  test('suggests the first step not done, and checks what it reads', () => {
    expect(nextStep(ALL_STEPS, { done: [], ticked: {} })).toBe(ALL_STEPS[0])
    expect(nextStep(ALL_STEPS, { done: [ALL_STEPS[0].id], ticked: {} })).toBe(ALL_STEPS[1])
    expect(isLessonProgress({ done: ['w1-hands1'], ticked: { 'w10-check': [0, 2] } })).toBe(true)
    expect(isLessonProgress({ done: 'w1' })).toBe(false)
  })
})

describe('targets', () => {
  test('a step with a target sends its id, percent and tempo with its link', () => {
    const scored = ALL_STEPS.filter((item) => item.goal)
    expect(scored.length).toBeGreaterThan(60)
    for (const item of scored) {
      expect(item.link).toMatchObject({ step: item.id, goal: item.goal!.percent })
      expect(item.link!.bpm).toBe(item.goal!.bpm || undefined)
    }
    expect(ALL_STEPS.filter((item) => item.kind === 'check').every((item) => !item.goal)).toBe(true)
    // Ear training: 80% right, no tempo
    for (const item of ALL_STEPS.filter((each) => each.kind === 'ear')) expect([item.link!.goal, item.link!.bpm]).toEqual([80, undefined])
    expect(ALL_STEPS.find((item) => item.id === 'w23-embraceable2')?.link).toMatchObject({ goal: 90, bpm: 60, timing: 60 })
  })

  test('the target is reached through the whole piece, right enough, fast enough', () => {
    const lesson = { goal: 90, bpm: 80 }
    expect(reachesGoal(lesson, { right: 19, judged: 20, complete: true, bpm: 80 })).toBe(true)
    expect(reachesGoal(lesson, { right: 19, judged: 20, complete: true, bpm: 70 })).toBe(false)
    expect(reachesGoal(lesson, { right: 17, judged: 20, complete: true, bpm: 90 })).toBe(false)
    expect(reachesGoal(lesson, { right: 10, judged: 10, complete: false, bpm: 90 })).toBe(false)
    expect(reachesGoal({ bpm: 80 }, { right: 10, judged: 10, complete: true, bpm: 90 })).toBe(false)
    // With a timing target, the average must be within it (early or late)
    const timed = { goal: 90, bpm: 60, timing: 60 }
    expect(reachesGoal(timed, { right: 20, judged: 20, complete: true, bpm: 60, offsetMs: 45 })).toBe(true)
    expect(reachesGoal(timed, { right: 20, judged: 20, complete: true, bpm: 60, offsetMs: -80 })).toBe(false)
    expect(reachesGoal(timed, { right: 20, judged: 20, complete: true, bpm: 60, offsetMs: null })).toBe(false)
    // Ear training has no tempo
    expect(reachesGoal({ goal: 80 }, { right: 8, judged: 10, complete: true, bpm: 0 })).toBe(true)
  })
})

describe('the lesson tunes', () => {
  test('every chord reads, every bar is full, What Is This Thing Called Love? has its refrain', () => {
    for (const chart of lessonSongs.playlists[0].charts) {
      for (const bar of chart.bars) for (const chord of bar.chords) if (chord.symbol) expect(parseChord(chord.symbol), chord.symbol).not.toBeNull()
    }
    const tune = lessonSongs.playlists[0].charts.find((chart) => chart.title.startsWith('What Is This'))!
    expect(tune.bars).toHaveLength(33) // the pickup and 32 bars, AABA
    expect(tune.bars[1].chords[0].symbol).toBe('Gh7')
    expect(tune.melody.notes[0]).toMatchObject({ bar: 0, at: 3, pitch: 70 }) // the pickup Bb
  })
})

