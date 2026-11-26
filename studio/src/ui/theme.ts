// The app's colour theme, kept on this device: Dark mode (the default, "Jazz club": night blue,
// amber and teal), Light mode ("Bossa": cream, coral and teal), or a custom theme built on one of
// them with the person's own colours. index.css holds the two built-in themes (the root's
// variables, and [data-mode="light"]); a custom theme sets its colours inline on the root, with
// the shades the app needs worked out from them (the secondary text, lines, controls...).

import { useCallback, useState } from 'react'
import { loadJson, saveJson } from '../library/storage'

export type ThemeMode = 'dark' | 'light'
export type ThemeId = ThemeMode | 'custom'

/** The colours a person can choose, by the CSS variable they set. */
export const THEME_COLOURS = [
  { key: 'desk', label: 'Background' },
  { key: 'paper', label: 'Sheet and panels' },
  { key: 'ink', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accent-2', label: 'Second accent' },
  { key: 'highlighter', label: 'Highlighter (the bar playing)' },
  { key: 'sub-color', label: 'Substituted chords' },
] as const
export type ThemeColour = (typeof THEME_COLOURS)[number]['key']

/** The built-in themes' colours (the same as index.css), the start of a custom theme. */
export const BUILT_IN: Record<ThemeMode, Record<ThemeColour, string>> = {
  dark: { desk: '#14161f', paper: '#1f2230', ink: '#f3ead8', accent: '#f2b544', 'accent-2': '#5ec2b7', highlighter: '#7a6230', 'sub-color': '#6fb0ff' },
  light: { desk: '#fff4e8', paper: '#ffffff', ink: '#2b2135', accent: '#ff7a59', 'accent-2': '#16a394', highlighter: '#ffd166', 'sub-color': '#1f6fd1' },
}

export interface ThemeSettings {
  id: ThemeId
  base: ThemeMode // a custom theme's built-in theme (its fonts, corners and the colours not chosen)
  colours: Partial<Record<ThemeColour, string>> // a custom theme's colours
}

const KEY = 'eartraining:theme'
export const DEFAULT_THEME: ThemeSettings = { id: 'dark', base: 'dark', colours: {} }
const HEX = /^#[0-9a-f]{6}$/i

/** Whether a stored value is theme settings. */
export function isThemeSettings(value: unknown): value is ThemeSettings {
  const v = value as Partial<ThemeSettings> | null
  return !!v && (v.id === 'dark' || v.id === 'light' || v.id === 'custom') && (v.base === 'dark' || v.base === 'light') &&
    !!v.colours && typeof v.colours === 'object' &&
    Object.entries(v.colours).every(([key, colour]) => THEME_COLOURS.some((c) => c.key === key) && typeof colour === 'string' && HEX.test(colour))
}

/** A #rrggbb colour as red, green and blue (0 to 255). */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Two colours mixed: `share` of the first (0 to 1). */
export function mix(a: string, b: string, share: number): string {
  const [x, y] = [rgb(a), rgb(b)]
  return `#${x.map((c, i) => Math.round(c * share + y[i] * (1 - share)).toString(16).padStart(2, '0')).join('')}`
}

/** A colour's relative luminance (0 black to 1 white, WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The text colour that reads on a background: near black or near white. */
export const readableOn = (hex: string) => (luminance(hex) > 0.4 ? '#14161f' : '#ffffff')

/**
 * The CSS variables of a custom theme: the colours chosen (the base theme's for the others) and
 * the shades worked out from them.
 */
export function customVariables(settings: ThemeSettings): Record<string, string> {
  const c = { ...BUILT_IN[settings.base], ...settings.colours }
  return {
    '--desk': c.desk,
    '--paper': c.paper,
    '--paper-edge': mix(c.ink, c.paper, 0.14),
    '--ink': c.ink,
    '--ink-2': mix(c.ink, c.paper, 0.82),
    '--muted': mix(c.ink, c.paper, 0.6),
    '--line': mix(c.ink, c.paper, 0.18),
    '--control': mix(c.ink, c.paper, 0.06),
    '--on-ink': c.paper,
    '--accent': c.accent,
    '--accent-2': c['accent-2'],
    '--on-accent': readableOn(c.accent),
    '--note-playing': c.accent,
    '--highlighter': c.highlighter,
    '--highlighter-blend': settings.base === 'light' ? 'multiply' : 'normal',
    '--sub-color': c['sub-color'],
  }
}

/** The custom variables set inline, so another theme can take them away. */
const CUSTOM_VARIABLES = Object.keys(customVariables(DEFAULT_THEME))

/** Show a theme: the root's mode, a custom theme's colours, and the browser's bar colour. */
export function applyTheme(settings: ThemeSettings, root: HTMLElement = document.documentElement): void {
  const mode = settings.id === 'custom' ? settings.base : settings.id
  root.dataset.mode = mode
  root.dataset.theme = settings.id
  for (const name of CUSTOM_VARIABLES) root.style.removeProperty(name)
  if (settings.id === 'custom') for (const [name, value] of Object.entries(customVariables(settings))) root.style.setProperty(name, value)
  const desk = settings.id === 'custom' ? { ...BUILT_IN[settings.base], ...settings.colours }.desk : BUILT_IN[mode].desk
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', desk)
}

/** The theme kept on this device (Dark mode when none). */
export const storedTheme = (): ThemeSettings => loadJson(KEY, DEFAULT_THEME, isThemeSettings)

/** The theme, and a way to change it (shown at once and kept). */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeSettings>(storedTheme)
  /** Show and keep a theme. */
  const change = useCallback((next: ThemeSettings) => {
    setTheme(next)
    saveJson(KEY, next)
    applyTheme(next)
  }, [])
  return { theme, change }
}
