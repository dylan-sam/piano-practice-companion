import App from './App'
import { NameProgression } from './exercises/NameProgression.tsx'
import { ChordSightreading } from './exercises/ChordSightreading.tsx'
import { Home } from './Home'
import { routeUrl, ROUTES, usePath } from './router'

// Share links made before the menu existed point at '/#tune=...' or '/#style=...'.
const SHARED = /^#(?:.*&)?(?:tune|style)=/

/** Choose the screen for the current path; unknown paths show the menu. */
export default function Root() {
  const path = usePath()
  if (path === ROUTES.home && SHARED.test(window.location.hash)) {
    history.replaceState(null, '', routeUrl(ROUTES.studio) + window.location.hash)
    return <App />
  }
  if (path === ROUTES.studio) return <App />
  if (path === ROUTES.nameProgression) return <NameProgression />
  if (path === ROUTES.chordSightreading) return <ChordSightreading />
  return <Home />
}
