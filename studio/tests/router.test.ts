import { describe, expect, it } from 'vitest'
import { backRoute, normalizePath, parentRoute, ROUTES } from '../src/router'

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
})
