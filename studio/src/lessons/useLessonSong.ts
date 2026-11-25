// A screen opened from a lesson step: its song is put on the stand once the screen's songs are
// loaded, with the band the step asks for.

import { useEffect, useRef } from 'react'
import type { LessonBand } from '../exercises/useBand'
import { findByTitle, type LessonLink } from './lessonLink'

/** A song of a screen's list. */
interface Listed { id: string; chart: { title: string } }

/**
 * Open a lesson's song once it is in `tunes` (with `open`, the screen's own way). Returns the
 * band a song takes (the step's style, pattern, key and tempo for the lesson's song, nothing for
 * another song) and whether the song is still missing from a loaded list.
 */
export function useLessonSong<T extends Listed, P = string | null>(lesson: Omit<LessonLink, 'route'> | null, tunes: readonly T[],
  open: (tune: T) => void) {
  const opened = useRef<string | null>(null) // the song opened for the lesson
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])
  const found = lesson?.song ? findByTitle(tunes, lesson.song) : undefined

  useEffect(() => {
    if (!found || opened.current) return
    opened.current = found.id
    openRef.current(found)
  }, [found])

  /** The lesson's band for a song being opened. */
  const bandFor = (id: string): LessonBand<P> | undefined => (lesson && id === opened.current
    ? { style: lesson.style, pattern: lesson.pattern as P | undefined, key: lesson.key, bpm: lesson.bpm, subs: lesson.subs } : undefined)
  return { bandFor, missing: !!lesson?.song && tunes.length > 0 && !found ? lesson.song : null }
}
