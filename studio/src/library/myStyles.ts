// Styles made in the Pattern Creator and saved by the user, kept in this browser

import { labId, normalizeLab, type LabStyle } from '../styles/lab'

const KEY = 'openstand:my-styles'

// The id of a saved style
export const myStyleId = (lab: LabStyle) => `my:${labId(lab)}`

// Load the saved styles (none when storage is empty or unreadable)
export function loadMyStyles(): LabStyle[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[]
    return saved.map(normalizeLab).filter((s): s is LabStyle => s !== null)
  } catch {
    return []
  }
}

// Save the styles and return them
function store(styles: LabStyle[]): LabStyle[] {
  localStorage.setItem(KEY, JSON.stringify(styles))
  return styles
}

// A style with the same name replaces the saved one
export function saveMyStyle(styles: LabStyle[], lab: LabStyle): LabStyle[] {
  const id = myStyleId(lab)
  return store([...styles.filter((s) => myStyleId(s) !== id), lab].sort((a, b) => a.name.localeCompare(b.name)))
}

// Remove a saved style
export function removeMyStyle(styles: LabStyle[], id: string): LabStyle[] {
  return store(styles.filter((s) => myStyleId(s) !== id))
}
