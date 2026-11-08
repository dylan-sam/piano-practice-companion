import { ROUTES } from './router'
import { AppLink, StandIcon } from './ui/AppLink'

interface MenuItem {
  title: string
  description: string
  path: string
}

// Each exercise adds one entry here and one route in Root
const MENU: MenuItem[] = [
  {
    title: 'Accompaniment Player',
    description: 'Practice over bass, piano and drums. Load a ChoCo chart, pick a style, key and tempo.',
    path: ROUTES.studio,
  },
  {
    title: 'Name the progression',
    description: 'Hear a line from a real song and choose the chord progression that fills the gap.',
    path: ROUTES.nameProgression,
  },
  {
    title: 'Chord Sightreading',
    description: 'Practice playing chords by plugging in a MIDI keyboard! The chord progressions come from real songs!',
    path: ROUTES.chordSightreading,
  },
]

/** The main menu: one entry per screen of the app, and the data and code credits. */
export function Home() {
  return (
    <div className="home">
      <header className="home-header">
        <StandIcon className="home-mark" />
        <h1>Ear Training</h1>
        <p>Hear chord progressions, then play them with a band.</p>
      </header>

      <nav className="home-menu" aria-label="Main menu">
        {MENU.map((item) => (
          <AppLink key={item.path} to={item.path} className="home-item">
            <span className="home-item-title">{item.title}</span>
            <span className="home-item-desc">{item.description}</span>
            <svg className="home-item-arrow" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </AppLink>
        ))}
      </nav>

      <footer className="home-footer">
        Chord data from <a href="https://github.com/smashub/choco">ChoCo</a> (CC BY 4.0).
        Studio is based on <a href="https://github.com/canbmaj7/openstand">OpenStand</a> (AGPL-3.0).{' '}
        <a href={`${import.meta.env.BASE_URL}source.zip`}>Source</a>
      </footer>
    </div>
  )
}
