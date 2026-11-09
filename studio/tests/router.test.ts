import { describe, expect, it } from 'vitest'
import { normalizePath, parentRoute, ROUTES } from '../src/router'

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
})
