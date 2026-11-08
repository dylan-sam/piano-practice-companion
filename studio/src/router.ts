// A minimal path router. The URL fragment stays free for Studio's share links.
import { useSyncExternalStore } from 'react'

export const ROUTES = {
  home: '/',
  studio: '/studio',
  nameProgression: '/exercises/name-progression',
  chordSightreading: '/exercises/chord-sightreading',
} as const

const NAVIGATE = 'eartraining:navigate'

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

/** The current route path, re-rendering when it changes. */
export function usePath(): string {
  return useSyncExternalStore(subscribe, () => normalizePath(window.location.pathname))
}

/** Go to an app route without reloading the page. */
export function navigate(path: string): void {
  if (normalizePath(window.location.pathname) === normalizePath(path) && !window.location.hash) return
  history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE))
  window.scrollTo(0, 0)
}
