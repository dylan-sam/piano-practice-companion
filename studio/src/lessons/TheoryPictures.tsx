// The pictures of a lesson step's theory cards (theory.ts): a staff engraved by abcjs from ABC
// notation, and a progression drawn as chord boxes with their Roman numerals under them. Both are
// written in C and drawn in the key chosen on the page, with chord names or Roman numerals, and
// both can be heard (Listen).

import { useEffect, useRef, useState } from 'react'
import { loadAbcjs } from '../ui/abcjsLoad'
import { ChordSymbol } from '../ui/ChordSymbol'
import { Icon } from '../ui/Icon'
import { listen } from './listen'
import type { ProgressionPicture, TheoryCard } from './theory'
import { cardChord, progressionAbc, romanAbc } from './theoryMusic'

const STAFF_WIDTH = 520 // abcjs layout width (narrower on a phone, so the notes keep their size); the drawing then scales to the card

/** How the pictures are drawn: moved from C by `transpose` semitones into `keyPc`, with chord names or Roman numerals. */
export interface PictureKey { keyPc: number; transpose: number; roman: boolean }

/** A short staff, in the text colour of the theme; it scales with the card (laid out for its width when drawn). */
export function Staff({ abc, label, view }: { abc: string; label: string; view: PictureKey }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    void loadAbcjs().then((abcjs) => {
      if (cancelled || !ref.current) return
      abcjs.renderAbc(ref.current, view.roman ? romanAbc(abc) : abc, {
        responsive: 'resize',
        staffwidth: Math.min(STAFF_WIDTH, ref.current.clientWidth || STAFF_WIDTH),
        visualTranspose: view.transpose,
        jazzchords: true,
        foregroundColor: 'currentColor',
        paddingleft: 0,
        paddingright: 0,
        paddingtop: 0,
        paddingbottom: 0,
        format: { gchordfont: '"Petaluma Script" 18', vocalfont: '"IBM Plex Sans Variable" 11', stretchlast: 1 },
        ariaLabel: label,
      })
    })
    return () => {
      cancelled = true
    }
  }, [abc, label, view.roman, view.transpose])
  // abcjs sizes its own box from the width of its parent: the outer box sets that width
  return <div className="theory-staff"><div ref={ref} /></div>
}

/** A progression: a row of chord boxes, each with its Roman numeral (with chord names); it wraps on a phone. */
export function Progression({ picture, label, view }: { picture: ProgressionPicture; label: string; view: PictureKey }) {
  return (
    <ol className="theory-progression" aria-label={label}>
      {picture.chords.map((box, i) => (
        <li key={`${box}-${i}`} className={box === '→' ? 'theory-arrow' : undefined}>
          <span className="theory-chord">
            {box.split(/\s+/).map((text, j) => {
              const chord = cardChord(text, view.transpose)
              return chord
                ? <ChordSymbol key={j} chord={chord} keyPc={view.keyPc} notation={{ romanKey: view.roman ? view.keyPc : null }} />
                : <span key={j}>{text}</span>
            })}
          </span>
          {!view.roman && <span className="theory-numeral">{picture.numerals[i]}</span>}
        </li>
      ))}
    </ol>
  )
}

/** Play some ABC on the piano; the first press loads the sound (its progress shown). */
function ListenButton({ abc, transpose, what }: { abc: string; transpose: number; what: string }) {
  const [loading, setLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  /** Play, loading the sound the first time. */
  const play = async () => {
    setError('')
    try {
      await listen(abc, transpose, (ratio) => setLoading(ratio))
    } catch (cause) {
      setError(String(cause))
    }
    setLoading(null)
  }
  return (
    <span className="theory-listen">
      <button className="chip" onClick={() => void play()} aria-label={`Listen to ${what}`}>
        <Icon name="listen" /> {loading !== null && loading < 1 ? `Loading the sound ${Math.round(loading * 100)}%` : 'Listen'}
      </button>
      {error && <span className="sight-hint">{error}</span>}
    </span>
  )
}

/** One theory card: its title, its paragraphs, its pictures (each with Listen) and where it comes from. */
export function TheoryCardView({ card, view }: { card: TheoryCard; view: PictureKey }) {
  return (
    <article className="theory-card" aria-labelledby={`theory-${card.id}`}>
      <h3 id={`theory-${card.id}`}>{card.title}</h3>
      {card.text.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {card.progression && <>
        <Progression picture={card.progression} label={`${card.title}: the chords`} view={view} />
        <ListenButton abc={progressionAbc(card.progression.chords, view.transpose)} transpose={0} what={`the chords of ${card.title}`} />
      </>}
      {card.abc && <>
        <Staff abc={card.abc} label={`${card.title}, written on a staff`} view={view} />
        <ListenButton abc={card.abc} transpose={view.transpose} what={`the staff of ${card.title}`} />
      </>}
    </article>
  )
}
