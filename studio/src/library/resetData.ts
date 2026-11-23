// Delete all my data (main menu): everything the app keeps on this device, to start afresh.
// Only the app's own keys are removed, so other sites served from the same address keep theirs.

import { deleteLibrary } from './db'

// The app's keys in the browser's storage all start with one of these
const APP_PREFIXES = ['eartraining', 'openstand']

/**
 * The keys of a storage that belong to the app.
 *
 *   ['eartraining:lick-reading', 'openstand.display', 'other-site'] -> the first two
 */
export function appKeys(storage: Pick<Storage, 'length' | 'key'>): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && APP_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key)
  }
  return keys
}

/**
 * Delete everything the app keeps: saved and imported songs and playlists (IndexedDB), and
 * settings, styles, mixer levels, remembered mistakes, levels passed and lesson progress.
 */
export async function deleteAllData(): Promise<void> {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of appKeys(storage)) storage.removeItem(key)
  }
  await deleteLibrary()
}
