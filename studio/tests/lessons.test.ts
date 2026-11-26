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
import { exerciseTitle, readSpec } from '../src/exercises/builder/exerciseBuilder'

const charts = (file: { playlists: { charts: { title: string; style?: string }[] }[] }) =>
  file.playlists.flatMap((list) => list.charts.map((chart) => ({ chart })))
const leadSheets = [...charts(bundled), ...charts(lessonSongs)]

describe('lesson links', () => {
  test('a link goes to its address and back', () => {
    const link = { route: ROUTES.leadSheetSightreading, song: "'S Wonderful", key: 5, bpm: 90, check: 'both' as const, leftHand: 'pattern' as const, mute: ['comp' as const] }
    const url = lessonUrl(link)
    expect(url.startsWith('/sightreading/lead-sheets?')).toBe(true)
    expect(url.endsWith('&from=lessons')).toBe(true) // the back button leads to the Lessons tab
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
  test('46 weeks in order, with unique step ids', () => {
    expect(PROGRAM.flatMap((unit) => unit.weekList.map((week) => week.week))).toEqual(Array.from({ length: 46 }, (_, i) => i + 1))
    expect(new Set(ALL_STEPS.map((item) => item.id)).size).toBe(ALL_STEPS.length)
  })

  test('every link opens something the app has', () => {
    for (const item of ALL_STEPS) {
      const link = item.link
      if (!link) continue
      if (link.route === ROUTES.exerciseSightreading) {
        const spec = readSpec(link.exercise ?? '')
        expect(spec, `${item.id} ${link.exercise}`).toBeTruthy()
        expect(link.song).toBe(exerciseTitle(spec!))
      }
      else if (link.song) expect(findByTitle(leadSheets, link.song), link.song).toBeDefined()
      if (link.pattern) {
        const style = link.style ?? findByTitle(leadSheets, link.song!)?.chart.style ?? 'swing'
        expect(patternsForStyle(style).map((pattern) => pattern.id), `${item.id} ${link.pattern} in ${style}`).toContain(link.pattern)
        expect(PIANO_PATTERNS.some((pattern) => pattern.id === link.pattern)).toBe(true)
      }
      if (link.playlist) expect(licks.playlists.some((list) => list.name === link.playlist), link.playlist).toBe(true)
    }
  })

  test('units 1 to 3 and 5 end with a substitution week, its steps keeping ids of their own', () => {
    const ending = (id: string) => PROGRAM.find((unit) => unit.id === id)!.weekList.at(-1)!.steps.every((item) => item.id.startsWith('sub'))
    expect(['u1', 'u2', 'u3', 'u4'].map(ending)).toEqual([true, true, true, true])
    expect(PROGRAM.map((unit) => `${unit.number} ${unit.weeks}`)).toEqual(['1 Weeks 1 to 5', '2 Weeks 6 to 12', '3 Weeks 13 to 19',
      '4 Weeks 20 to 23', '5 Weeks 24 to 30', '6 Weeks 31 to 34', '7 Weeks 35 to 38', '8 Weeks 39 to 42', '9 Weeks 43 to 45', '0 Week 46'])
    // Steps written before keep their ids (the progress kept by id stays)
    expect(ALL_STEPS.some((item) => item.id === 'w23-embraceable2')).toBe(true)
    const avalon = ALL_STEPS.find((item) => item.id === 'sub1-avalon3')!
    expect(avalon.link).toMatchObject({ song: 'Avalon', subs: ['addII'], pattern: 'open_fifths' })
  })

  test('every week has the four parts of a session', () => {
    for (const unit of PROGRAM.filter((u) => u.number)) {
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

  test('the minor ii-V-i, altered dominants and minor blues units, their songs and exercises', () => {
    expect(PROGRAM.map((unit) => unit.id)).toEqual(['u1', 'u2', 'u3', 'uMinor', 'u4', 'uAltered', 'uMinorBlues', 'u5', 'u6', 'review'])
    const songs = (id: string) => new Set(PROGRAM.find((unit) => unit.id === id)!.weekList.flatMap((week) => week.steps)
      .map((item) => item.link?.song).filter(Boolean))
    expect(songs('uMinor').has('Love Me Or Leave Me')).toBe(true)
    expect(songs('uMinorBlues')).toEqual(new Set(['Minor blues: guide tones, one per chord, from the 3rd', 'Minor Study Blues',
      'Minor blues: guide tones, two per chord', 'Minor blues: chord scales in eighth notes', 'Black And Tan Fantasy',
      'Minor blues: guide tones, one per chord, from the 7th']))
    // The altered unit's songs play the altered dominant substitution
    const altered = PROGRAM.find((unit) => unit.id === 'uAltered')!.weekList.flatMap((week) => week.steps)
    expect(altered.filter((item) => item.kind === 'song').every((item) => item.link?.subs?.includes('altered'))).toBe(true)
    // Intros and endings on several songs, each with its frame of bars
    const intros = ALL_STEPS.filter((item) => item.id.includes('-intro-'))
    expect(new Set(intros.map((item) => item.link?.song)).size).toBe(8)
    expect(intros.every((item) => item.link?.frame && item.what.includes('bars added before the head'))).toBe(true)
  })
})
