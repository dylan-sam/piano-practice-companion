import App from './App'
import { NameProgression } from './exercises/NameProgression.tsx'
import { MelodicDictation } from './exercises/MelodicDictation.tsx'
import { ChordSightreading } from './exercises/ChordSightreading.tsx'
import { MelodySightreading } from './exercises/MelodySightreading.tsx'
import { LickSightreading } from './exercises/LickSightreading.tsx'
import { Menu } from './Home'
import { routeUrl, ROUTES, usePath } from './router'

// Share links made before the menu existed point at '/#tune=...' or '/#style=...'.
const SHARED = /^#(?:.*&)?(?:tune|style)=/

/** Choose the screen for the current path; menus and unknown paths show a menu. */
export default function Root() {
  const path = usePath()
  if (path === ROUTES.home && SHARED.test(window.location.hash)) {
    history.replaceState(null, '', routeUrl(ROUTES.chordPlayer) + window.location.hash)
    return <App />
  }
  // The two players are one screen in two modes; the key gives each its own state
  if (path === ROUTES.chordPlayer) return <App key="chords" mode="chords" />
  if (path === ROUTES.leadSheetPlayer) return <App key="lead" mode="lead" />
  if (path === ROUTES.nameProgression) return <NameProgression />
  if (path === ROUTES.melodicDictation) return <MelodicDictation />
  if (path === ROUTES.chordSightreading) return <ChordSightreading />
  // Lead sheets and exercises are read on one screen in two modes
  if (path === ROUTES.leadSheetSightreading) return <MelodySightreading key="lead-sheets" kind="lead-sheets" />
  if (path === ROUTES.exerciseSightreading) return <MelodySightreading key="exercises" kind="exercises" />
  if (path === ROUTES.lickSightreading) return <LickSightreading />
  return <Menu path={path} />
}
