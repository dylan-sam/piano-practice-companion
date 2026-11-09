import App from './App'
import { NameProgression } from './exercises/NameProgression.tsx'
import { ChordSightreading } from './exercises/ChordSightreading.tsx'
import { MelodySightreading } from './exercises/MelodySightreading.tsx'
import { LickSightreading } from './exercises/LickSightreading.tsx'
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
  // The two players are one screen in two modes; the key gives each its own state
  if (path === ROUTES.studio) return <App key="chords" mode="chords" />
  if (path === ROUTES.leadSheet) return <App key="lead" mode="lead" />
  if (path === ROUTES.nameProgression) return <NameProgression />
  if (path === ROUTES.chordSightreading) return <ChordSightreading />
  if (path === ROUTES.melodySightreading) return <MelodySightreading />
  if (path === ROUTES.lickSightreading) return <LickSightreading />
  return <Home />
}
