import { describe, expect, it } from 'vitest'
import { backRoute, lessonStepPath, normalizePath, parentRoute, ROUTES } from '../src/router'

describe('app routes', () => {
  it('treats trailing slashes as the same route', () => {
    expect(normalizePath('/')).toBe(ROUTES.home)
    expect(normalizePath('')).toBe(ROUTES.home)
    expect(normalizePath('/play-along/chords/')).toBe(ROUTES.chordPlayer)
    expect(normalizePath('/play-along/chords')).toBe(ROUTES.chordPlayer)
  })
  it('goes up one menu level: a screen to its area, an area to the main menu', () => {
    expect(parentRoute(ROUTES.lickSightreading)).toBe(ROUTES.sightreading)
    expect(parentRoute(ROUTES.chordPlayer)).toBe(ROUTES.playAlong)
    expect(parentRoute(ROUTES.earTraining)).toBe(ROUTES.home)
    expect(parentRoute(ROUTES.home)).toBe(ROUTES.home)
  })
  it('goes back to the Lessons tab from a screen a lesson step opened', () => {
    expect(backRoute(ROUTES.leadSheetSightreading, '?song=Avalon&bpm=70&from=lessons')).toBe(ROUTES.lessons)
    expect(backRoute(ROUTES.leadSheetSightreading, '?song=Avalon')).toBe(ROUTES.sightreading)
    expect(backRoute(ROUTES.lessons, '?from=lessons')).toBe(ROUTES.home)
  })
  it('leads a lesson step\'s screen back to the step\'s page, and the page to the Lessons tab', () => {
    expect(backRoute(ROUTES.chordSightreading, '?bpm=60&step=w1-hands1&from=lessons')).toBe('/lessons/step?id=w1-hands1')
    expect(lessonStepPath('sub1-avalon3')).toBe('/lessons/step?id=sub1-avalon3')
    expect(backRoute(ROUTES.lessonStep, '?id=w1-hands1')).toBe(ROUTES.lessons)
  })
})
