import { describe, expect, it } from 'vitest'
import { normalizePath, ROUTES } from '../src/router'

describe('app routes', () => {
  it('treats trailing slashes as the same route', () => {
    expect(normalizePath('/')).toBe(ROUTES.home)
    expect(normalizePath('')).toBe(ROUTES.home)
    expect(normalizePath('/studio/')).toBe(ROUTES.studio)
    expect(normalizePath('/studio')).toBe(ROUTES.studio)
  })
})
