// A minimal path router. The URL fragment stays free for Studio's share links.
import { useSyncExternalStore } from 'react'

export const ROUTES = {
  home: '/',
  studio: '/studio',
  leadSheet: '/lead-sheet',
  nameProgression: '/exercises/name-progression',
  chordSightreading: '/exercises/chord-sightreading',
} as const

const NAVIGATE = 'eartraining:navigate'
// The folder the app is served from: '' at the root of a site, '/piano-practice-companion' on GitHub Pages
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, '')

/** Listen to back/forward buttons and in-app navigation; returns the unsubscribe function. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE, onChange)
  }
}

/** Normalize a path so '/studio/' and '/studio' are the same route. */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** The address of an app route in the browser, inside the folder the app is served from. */
export function routeUrl(path: string): string {
  return ROOT + path
}

/** The current route path, without the app's folder ('/studio' also on GitHub Pages). */
export function currentPath(): string {
  const path = window.location.pathname
  return normalizePath(ROOT && path.startsWith(ROOT) ? path.slice(ROOT.length) : path)
}

/** The current route path, re-rendering when it changes. */
export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath)
}

/** Go to an app route without reloading the page. */
export function navigate(path: string): void {
  if (currentPath() === normalizePath(path) && !window.location.hash) return
  history.pushState(null, '', routeUrl(path))
  window.dispatchEvent(new Event(NAVIGATE))
  window.scrollTo(0, 0)
}
