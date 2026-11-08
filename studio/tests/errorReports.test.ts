import { describe, expect, test } from 'vitest'
import { scrubUrl } from '../src/errorReports'

describe('error reports', () => {
  test('shared charts and styles never leave in the address', () => {
    expect(scrubUrl('https://openstand-eta.vercel.app/#tune=abc')).toBe('https://openstand-eta.vercel.app/')
    expect(scrubUrl('https://openstand-eta.vercel.app/?x=1#style=abc&tune=def')).toBe('https://openstand-eta.vercel.app/')
    expect(scrubUrl('https://openstand-eta.vercel.app/path')).toBe('https://openstand-eta.vercel.app/path')
  })
})
