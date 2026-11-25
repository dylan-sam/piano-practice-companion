import { lazy, Suspense, type ReactNode } from 'react'
import { Menu } from './Home'
import { routeUrl, ROUTES, usePath } from './router'
import { CrashCatch } from './ui/CrashScreen'

// Each screen is its own download, fetched when it is opened: the menu (the first screen) shows
// without waiting for the band, the sheet engraver or the exercises
/** A screen loaded when first shown, from a module's named export. */
function screen<K extends string, P extends object>(load: () => Promise<Record<K, (props: P) => ReactNode>>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }))
}
const App = lazy(() => import('./App'))
const NameProgression = screen(() => import('./exercises/NameProgression.tsx'), 'NameProgression')
const MelodicDictation = screen(() => import('./exercises/MelodicDictation.tsx'), 'MelodicDictation')
const ChordSightreading = screen(() => import('./exercises/ChordSightreading.tsx'), 'ChordSightreading')
const MelodySightreading = screen(() => import('./exercises/MelodySightreading.tsx'), 'MelodySightreading')
const LickSightreading = screen(() => import('./exercises/LickSightreading.tsx'), 'LickSightreading')
const FreeImprovisation = screen(() => import('./exercises/FreeImprovisation.tsx'), 'FreeImprovisation')
const Lessons = screen(() => import('./lessons/Lessons.tsx'), 'Lessons')

// Share links made before the menu existed point at '/#tune=...' or '/#style=...'.
const SHARED = /^#(?:.*&)?(?:tune|style)=/

/** Choose the screen for the current path (menus and unknown paths show a menu), with the crash catch around it. */
export default function Root() {
  return (
    <CrashCatch>
      <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
        <Screen />
      </Suspense>
    </CrashCatch>
  )
}

/** The screen of the current path. */
function Screen() {
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
  if (path === ROUTES.freeImprovisation) return <FreeImprovisation />
  if (path === ROUTES.lessons) return <Lessons />
  return <Menu path={path} />
}
