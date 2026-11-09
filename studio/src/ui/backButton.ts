// The back button: close the last opened menu, else go up one menu level, else leave the app.
// In the Android app, MainActivity calls handleBack on each press. In a phone's browser (the web
// demo), each open menu adds a history entry, so the browser's back button closes it the same way.
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { currentPath, navigate, parentRoute, routeUrl, ROUTES } from '../router'

// History state of an entry added for an open menu, holding the menu's number
const MENU_STATE = 'eartrainingMenu'

// Close functions of the menus, panels and dialogs open now, the last opened last
const closers: { close: () => void; id: number }[] = []
let nextId = 0
// True in a phone's browser: open menus are mirrored in the browser history
let browserBack = false
// History steps taken back by the app itself (a menu closed by its own button), not by the user
let ownSteps = 0

/** The number of the menu a history entry was added for, if any. */
function menuOfEntry(): number | undefined {
  const state = history.state as Record<string, unknown> | null
  return typeof state?.[MENU_STATE] === 'number' ? state[MENU_STATE] : undefined
}

/** Add a close function to the back button's list; returns the function that removes it again. */
export function registerBackClose(close: () => void): () => void {
  const entry = { close, id: ++nextId }
  closers.push(entry)
  if (browserBack) history.pushState({ [MENU_STATE]: entry.id }, '')
  return () => {
    const index = closers.indexOf(entry)
    if (index < 0) return // already closed by the back button, which used up its history entry
    closers.splice(index, 1)
    // Closed by its own button (Done, a click outside...): take back its history entry, if it is the latest
    if (browserBack && menuOfEntry() === entry.id) {
      ownSteps++
      history.back()
    }
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
 * up one level (a screen to its area's menu, an area's menu to the main menu). Returns false on
 * the main menu with nothing open, where the app may exit.
 */
export function handleBack(): boolean {
  if (closeLastMenu()) return true
  if (currentPath() !== ROUTES.home) {
    navigate(parentRoute(currentPath()))
    return true
  }
  return false
}

/** Whether the page runs in a phone or tablet browser (a touch screen), not in the Android or iOS app. */
function inMobileBrowser(): boolean {
  return !Capacitor.isNativePlatform() && !!window.matchMedia?.('(pointer: coarse)').matches
}

/**
 * Set up the back button: let the Android app call handleBack (window.earTrainingBack), and in a
 * phone's browser make the browser's back button close menus first, then go up one menu level.
 */
export function installBackHandler(): void {
  (window as Window & { earTrainingBack?: () => boolean }).earTrainingBack = handleBack
  if (!inMobileBrowser()) return
  browserBack = true
  // A screen opened from a link goes back up to its menu, as in the app
  const path = currentPath()
  if (path !== ROUTES.home && history.length <= 2) {
    const { search, hash } = window.location
    history.replaceState(null, '', routeUrl(parentRoute(path)))
    history.pushState(null, '', routeUrl(path) + search + hash)
  }
  // The browser has gone back one entry: if it was a menu's, close that menu
  window.addEventListener('popstate', () => {
    if (ownSteps > 0) {
      ownSteps--
      return
    }
    closeLastMenu()
  })
}
