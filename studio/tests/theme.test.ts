import { describe, expect, test } from 'vitest'
import { BUILT_IN, customVariables, DEFAULT_THEME, isThemeSettings, luminance, mix, readableOn } from '../src/ui/theme'

describe('themes', () => {
  test('Dark mode is the default; stored settings are checked', () => {
    expect(DEFAULT_THEME.id).toBe('dark')
    expect(isThemeSettings({ id: 'custom', base: 'light', colours: { accent: '#123456' } })).toBe(true)
    expect(isThemeSettings({ id: 'custom', base: 'light', colours: { accent: 'red' } })).toBe(false)
    expect(isThemeSettings({ id: 'neon', base: 'dark', colours: {} })).toBe(false)
  })

  test('colours mixed, and a text colour that reads on a background', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(luminance('#ffffff')).toBeCloseTo(1)
    expect(readableOn('#ffd166')).toBe('#14161f')
    expect(readableOn('#1f2230')).toBe('#ffffff')
  })

  test('a custom theme: the colours chosen, the base theme for the others, the shades worked out', () => {
    const vars = customVariables({ id: 'custom', base: 'light', colours: { accent: '#222222', paper: '#ffffff', ink: '#000000' } })
    expect(vars['--accent']).toBe('#222222')
    expect(vars['--on-accent']).toBe('#ffffff')
    expect(vars['--desk']).toBe(BUILT_IN.light.desk)
    expect(vars['--muted']).toBe(mix('#000000', '#ffffff', 0.6))
    expect(vars['--highlighter-blend']).toBe('multiply')
  })
})
