// Small values kept in the browser between visits (settings, progress).
// Storage can be missing or full (private browsing); the app then keeps them for the visit only.

/** Read a JSON value, or `fallback` when it is missing, unreadable or rejected by `valid`. */
export function loadJson<T>(key: string, fallback: T, valid: (value: unknown) => boolean): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return valid(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

/** Save a JSON value, ignoring storage that is unavailable. */
export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do: the value lasts for this visit only
  }
}
