// The Android back button: close the last opened menu, else go back to the main menu, else leave the app
import { useEffect, useRef } from 'react'
import { currentPath, navigate, ROUTES } from '../router'

// Close functions of the menus, panels and dialogs open now, the last opened last
const closers: { close: () => void }[] = []

/** Add a close function to the back button's list; returns the function that removes it again. */
export function registerBackClose(close: () => void): () => void {
  const entry = { close }
  closers.push(entry)
  return () => {
    const index = closers.indexOf(entry)
    if (index >= 0) closers.splice(index, 1)
  }
}

/** Close the last opened menu that is still registered; false when none is open. */
export function closeLastMenu(): boolean {
  const last = closers.pop()
  last?.close()
  return !!last
}

/** Register a menu, panel or dialog while it is open, so the back button closes it, the last opened first. */
export function useBackClose(open: boolean, close: () => void): void {
  const latest = useRef(close)
  useEffect(() => {
    latest.current = close
  })
  useEffect(() => (open ? registerBackClose(() => latest.current()) : undefined), [open])
}

/**
 * Handle one press of the back button: close the last opened menu (without saving), else go
 * back to the main menu. Returns false on the main menu with nothing open, where the app may exit.
 */
export function handleBack(): boolean {
  if (closeLastMenu()) return true
  if (currentPath() !== ROUTES.home) {
    navigate(ROUTES.home)
    return true
  }
  return false
}

/** Let the Android app call handleBack (MainActivity runs window.earTrainingBack() on each press). */
export function installBackHandler(): void {
  (window as Window & { earTrainingBack?: () => boolean }).earTrainingBack = handleBack
}
