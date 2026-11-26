// The exercises listed in Exercises Sightreading: the six examples shipped with the app (deleted,
// they are only hidden, like the App Playlist's songs: Restore all default songs brings them back)
// and the person's own presets, saved in the browser (a name and the settings of the builder).
// Each is written as a chart when the list is made, under its category.

import { useMemo, useSyncExternalStore } from 'react'
import { hideSongs, useHiddenSongs } from '../../library/playlists'
import type { Tune } from '../../music/songs'
import { buildExercise, categoryList, EXAMPLES, exerciseCategory, readSpec, type ExercisePreset } from './exerciseBuilder'

const KEY = 'eartraining:exercise-presets'
const HIDDEN_PREFIX = 'exercise:' // an example deleted: its id among the hidden songs

// The order of the categories in the list
const ORDER = ['Triads', 'Seventh chords', 'Guide tones', 'Chord-tone and scale lines', 'Scales and scale patterns',
  'Approach notes and enclosures', 'Intervals', 'Rhythm']

/** Whether a value is a list of presets as saved. */
function isPresets(value: unknown): value is ExercisePreset[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object' &&
    typeof item.id === 'string' && typeof item.name === 'string' && typeof item.spec === 'string')
}

let presets: ExercisePreset[] | null = null
const listeners = new Set<() => void>()

/** The person's presets, as kept in the browser (read once). */
function read(): ExercisePreset[] {
  if (presets === null) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      presets = isPresets(value) ? value.filter((item) => readSpec(item.spec)) : []
    } catch {
      presets = []
    }
  }
  return presets
}

/** Keep the presets and tell the screens. */
function write(next: ExercisePreset[]): void {
  presets = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* kept for this visit only */ }
  for (const listener of listeners) listener()
}

/** The person's presets, re-rendering when they change. */
export function useUserPresets(): ExercisePreset[] {
  return useSyncExternalStore((onChange) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }, read, () => [])
}

/** Whether a hidden song's id is a deleted example exercise. */
export const isHiddenExample = (hiddenId: string): boolean => hiddenId.startsWith(HIDDEN_PREFIX)

/** Whether a preset is one of the shipped examples. */
export const isExample = (id: string): boolean => EXAMPLES.some((example) => example.id === id)

/** Save a new preset; returns it. */
export function addPreset(name: string, spec: string): ExercisePreset {
  const preset = { id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim() || 'My exercise', spec }
  write([...read(), preset])
  return preset
}

/** Change a preset's name or settings (one's own only). */
export function updatePreset(id: string, change: Partial<Omit<ExercisePreset, 'id'>>): void {
  write(read().map((preset) => (preset.id === id ? { ...preset, ...change, name: (change.name ?? preset.name).trim() || preset.name } : preset)))
}

/** Delete a preset: one's own is erased, an example hidden. */
export function deletePreset(id: string): void {
  if (isExample(id)) hideSongs([HIDDEN_PREFIX + id])
  else write(read().filter((preset) => preset.id !== id))
}

/** The tune id of a preset in the list. */
export const presetTuneId = (id: string): string => `preset:${id}`
/** The preset id of a tune of the list, or null. */
export const presetOfTune = (tuneId: string): string | null => (tuneId.startsWith('preset:') ? tuneId.slice('preset:'.length) : null)

/** A preset as a tune of the list: its chart written from its settings, named as saved, in its category. */
export function presetTune(preset: ExercisePreset): Tune | null {
  const spec = readSpec(preset.spec)
  if (!spec) return null
  const chart = { ...buildExercise(spec), title: preset.name }
  return { id: presetTuneId(preset.id), source: 'example', playlist: categoryList(exerciseCategory(spec)), addedAt: 0, chart }
}

/** The examples (not hidden) and one's own presets as tunes, category by category. */
export function presetTunes(own: readonly ExercisePreset[], hidden: readonly string[]): Tune[] {
  const shown = [...EXAMPLES.filter((example) => !hidden.includes(HIDDEN_PREFIX + example.id)), ...own]
  const rank = (tune: Tune) => ORDER.findIndex((category) => categoryList(category) === tune.playlist)
  return shown.flatMap((preset) => presetTune(preset) ?? []).sort((a, b) => rank(a) - rank(b))
}

/** The presets as tunes, re-made when they change. */
export function usePresetTunes(): Tune[] {
  const own = useUserPresets()
  const hidden = useHiddenSongs()
  return useMemo(() => presetTunes(own, hidden), [own, hidden])
}
