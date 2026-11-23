import { ROUTES } from './router'
import { AppLink, StandIcon } from './ui/AppLink'
import { DeleteAllData } from './ui/DeleteAllData'

interface MenuItem {
  title: string
  description: string
  path: string
}

/** A menu of the app: the main menu, or the menu of one of its areas. */
interface MenuPage {
  title: string
  description: string
  items: MenuItem[]
}

// The main menu leads to the areas; each area's menu leads to its screens (routes in Root)
const MENUS: Record<string, MenuPage> = {
  [ROUTES.home]: {
    title: 'Ear Training',
    description: 'Hear chord progressions, then play them with a band.',
    items: [
      {
        title: 'Lessons',
        description: 'A 30-week jazz piano program, 20 to 30 minutes a day: both hands and improvising from the first week, one song and one left-hand pattern at a time. Each step opens the exercise it needs, already set up. Nothing is locked.',
        path: ROUTES.lessons,
      },
      {
        title: 'Play along',
        description: 'Choose a ChoCo chord chart or a lead sheet, pick a style, key and tempo, and play along with the band on your instrument! You can import your own charts! The key and tempo can be changed automatically at each repetition to practice in every key!',
        path: ROUTES.playAlong,
      },
      {
        title: 'Ear Training',
        description: 'Practice different ear training exercises using real sheets! The website remembers your mistakes to give you better-suited exercises!',
        path: ROUTES.earTraining,
      },
      {
        title: 'Sightreading',
        description: 'Plug in a MIDI keyboard and sightread chords, melodies, arpeggios or licks with the band. You can import your own charts! The key and tempo can be changed automatically at each repetition to practice in every key!',
        path: ROUTES.sightreading,
      },
      {
        title: 'Improvisation',
        description: 'Plug in a MIDI keyboard and improvise with the band over a song or an endless line of progressions. Every note you play is written out and coloured by how it sounds on the chord.',
        path: ROUTES.improvisation,
      },
    ],
  },
  [ROUTES.playAlong]: {
    title: 'Play along',
    description: 'Play along with a bass, piano and drum band.',
    items: [
      {
        title: 'Chord Player',
        description: 'A bass, piano and drum band plays the chord chart for you! You can import your own iReal Pro charts!',
        path: ROUTES.chordPlayer,
      },
      {
        title: 'Lead Sheet Player',
        description: 'A bass, piano, drum and saxophone band plays the lead sheet for you! You can import your own MuseScore MusicXML files!',
        path: ROUTES.leadSheetPlayer,
      },
    ],
  },
  [ROUTES.earTraining]: {
    title: 'Ear Training',
    description: 'Ear training exercises on real songs and licks.',
    items: [
      {
        title: 'Name the progression',
        description: 'Hear a line from a real song and choose the chord progression that fills the gap.',
        path: ROUTES.nameProgression,
      },
      {
        title: 'Melodic Dictation',
        description: 'Hear a few bars of a song or a lick and write the hidden notes on the staff. The rhythm is written for you; you can hear the tonic or a cadence first.',
        path: ROUTES.melodicDictation,
      },
    ],
  },
  [ROUTES.improvisation]: {
    title: 'Improvisation',
    description: 'Improvise with the band and see how your notes sit on the chords.',
    items: [
      {
        title: 'Free Improvisation',
        description: 'Pick a ChoCo chord chart, a random song or an endless line of progressions and improvise freely! Each key you play is written out on the chart and coloured: chord tones, colour tones, approach tones and outside notes. The page starts again at each chorus.',
        path: ROUTES.freeImprovisation,
      },
    ],
  },
  [ROUTES.sightreading]: {
    title: 'Sightreading',
    description: 'Plug in a MIDI keyboard and read with the band. Every chord or note is checked.',
    items: [
      {
        title: 'Chord Sightreading',
        description: 'Pick a ChoCo chord chart and sightread it! You can import your own iReal Pro charts! An infinite chord progression generator is also available.',
        path: ROUTES.chordSightreading,
      },
      {
        title: 'Lead Sheet Sightreading',
        description: 'Pick a lead sheet and sightread it! You can import your own MuseScore MusicXML files!',
        path: ROUTES.leadSheetSightreading,
      },
      {
        title: 'Exercises Sightreading',
        description: 'Pick a scale, arpeggio, rhythm or lick exercise over a few bars and practice it!',
        path: ROUTES.exerciseSightreading,
      },
      {
        title: 'Lick Sightreading',
        description: 'Pick a ChoCo chord chart, pick a lick and practice sightreading the lick on top of the chord chart. The lick is automatically transposed at each chord change! You can import your own iReal Pro charts! An infinite chord progression generator is also available.',
        path: ROUTES.lickSightreading,
      },
    ],
  },
}

/** A menu page: the main menu (with the data and code credits, and Delete all my data) or an area's menu (with a way back). */
export function Menu({ path }: { path: string }) {
  const page = MENUS[path] ?? MENUS[ROUTES.home]
  const main = page === MENUS[ROUTES.home]
  return (
    <div className="home">
      <header className="home-header">
        {main ? <StandIcon className="home-mark" /> : (
          <AppLink to={ROUTES.home} className="home-back" label="Back to the main menu">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
            Main menu
          </AppLink>
        )}
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </header>

      <nav className="home-menu" aria-label={main ? 'Main menu' : `${page.title} menu`}>
        {page.items.map((item) => (
          <AppLink key={item.path} to={item.path} className="home-item">
            <span className="home-item-title">{item.title}</span>
            <span className="home-item-desc">{item.description}</span>
            <svg className="home-item-arrow" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </AppLink>
        ))}
      </nav>

      {main && <footer className="home-footer">
        Chord data from <a href="https://github.com/smashub/choco">ChoCo</a> (CC BY 4.0).
        Studio is based on <a href="https://github.com/canbmaj7/openstand">OpenStand</a> (AGPL-3.0).{' '}
        <a href={`${import.meta.env.BASE_URL}source.zip`}>Source</a>
        <div className="home-reset"><DeleteAllData /></div>
      </footer>}
    </div>
  )
}
