// Settings of a screen kept on this device: read once from browser storage, written on each change.

import { useState } from 'react'
import { loadJson, saveJson } from './storage'

/**
 * A screen's settings, kept in browser storage under `key` (invalid or old stored values fall
 * back to `fallback`). `update` merges a change, keeps it and returns the new settings, so a
 * caller can act on them at once.
 */
export function useStoredSettings<T extends object>(key: string, fallback: T, valid: (value: unknown) => boolean) {
  const [settings, setSettings] = useState<T>(() => loadJson(key, fallback, valid))
  /** Merge a change into the settings, keep them, and return them. */
  const update = (change: Partial<T>): T => {
    const next = { ...settings, ...change }
    setSettings(next)
    saveJson(key, next)
    return next
  }
  return [settings, update] as const
}
