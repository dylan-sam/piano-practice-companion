// How chord charts are drawn, chosen in the Display menu and kept between visits. The same
// settings apply to every chart (Chord Player, Chord Sightreading, Name the progression).

import { useSyncExternalStore } from 'react'
import { loadJson, saveJson } from '../library/storage'
import { parseChord } from '../music/chords'
import { romanRoot } from '../music/roman'

export interface DisplaySettings {
  roman: boolean // chords as Roman numerals of the key in force (II-7 V7 I^7)
  minor: '-' | 'm' // how minor is written: C- or Cm
  repeatSign: boolean // a bar with the same chords as the bar before is drawn as a % sign
  autoScroll: boolean // a playing sheet scrolls to keep the highlighted bar mid-screen (player and sightreader)
}

export const DEFAULT_DISPLAY: DisplaySettings = { roman: false, minor: '-', repeatSign: false, autoScroll: true }
const STORAGE_KEY = 'openstand.display'

/** Check a stored value before using it as display settings (settings saved before auto-scroll existed lack it). */
function isDisplay(value: unknown): value is Partial<DisplaySettings> {
  const v = value as Partial<DisplaySettings> | null
  return !!v && typeof v.roman === 'boolean' && (v.minor === '-' || v.minor === 'm') && typeof v.repeatSign === 'boolean'
    && (v.autoScroll === undefined || typeof v.autoScroll === 'boolean')
}

// Missing settings take their default
let current: DisplaySettings = { ...DEFAULT_DISPLAY, ...loadJson<Partial<DisplaySettings>>(STORAGE_KEY, DEFAULT_DISPLAY, isDisplay) }
const listeners = new Set<() => void>()

/** Change some display settings, save them and redraw every chart. */
export function setDisplay(change: Partial<DisplaySettings>): void {
  current = { ...current, ...change }
  saveJson(STORAGE_KEY, current)
  for (const listener of listeners) listener()
}

/** Listen to display changes; returns the function that stops listening. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current display settings, updated when they change. */
export function useDisplay(): DisplaySettings {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

/** Whether any display option shown on this screen differs from the default (lights the Display button). */
export function useDisplayChanged(roman = true, autoScroll = false): boolean {
  const display = useDisplay()
  return (roman && display.roman) || display.minor === 'm' || display.repeatSign || (autoScroll && !display.autoScroll)
}

/**
 * Write a chord symbol as plain text in the chosen notation (for cards and labels that do not
 * use chart glyphs): D-7 is "Dm7" with m for minor, "II-7" as a Roman numeral of C.
 */
export function displayText(symbol: string, display: DisplaySettings, keyPc: number | null): string {
  const chord = parseChord(symbol)
  if (!chord) return symbol
  const suffix = display.minor === 'm' ? chord.suffix.replace(/^-/, 'm') : chord.suffix
  // Write flats and sharps as their signs
  const pretty = (s: string) => s.replace(/b/g, '♭').replace(/#/g, '#')
  if (!display.roman || keyPc === null) {
    const root = /^[A-G][b#]?/.exec(symbol)?.[0] ?? ''
    const bass = symbol.includes('/') ? symbol.slice(symbol.lastIndexOf('/') + 1) : null
    return pretty(root) + suffix + (bass ? '/' + pretty(bass) : '')
  }
  // Name of a pitch class in the display settings
  const name = (pc: number) => {
    const { accidental, numeral } = romanRoot(pc, keyPc)
    return pretty(accidental) + numeral
  }
  return name(chord.root) + suffix + (chord.bass !== chord.root ? '/' + name(chord.bass) : '')
}
