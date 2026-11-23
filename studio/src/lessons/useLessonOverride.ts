// A lesson step's settings for a screen (what is checked, the left hand, a lick playlist...), for
// this visit only: they lie over the screen's own settings without changing them. A setting the
// player changes on the screen is theirs again and is kept as usual.

import { useMemo, useState } from 'react'

/** Some settings without the keys of a change. */
function without<T extends object>(settings: Partial<T>, change: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !(key in change))) as Partial<T>
}

/**
 * The settings a screen uses: its stored ones (`stored`, changed with `store`, which returns them
 * all) with the lesson's `patch` over them. Returns them, and the screen's way to change them.
 *
 *   stored { check: 'melody', anyOctave: true }, patch { check: 'both' }
 *     -> { check: 'both', anyOctave: true }; change({ anyOctave: false }) keeps check 'both' for the visit
 */
export function useLessonOverride<T extends object>(stored: T, store: (change: Partial<T>) => T,
  patch: Partial<T> | null): [T, (change: Partial<T>) => T] {
  const [override, setOverride] = useState<Partial<T>>(() => Object.fromEntries(
    Object.entries(patch ?? {}).filter(([, value]) => value !== undefined)) as Partial<T>)
  const settings = useMemo(() => ({ ...stored, ...override }), [stored, override])

  /** Change some settings: they are stored, and the lesson's value for them is dropped. */
  const change = (next: Partial<T>): T => {
    const left = without(override, next)
    setOverride(left)
    return { ...store(next), ...left }
  }
  return [settings, change]
}
