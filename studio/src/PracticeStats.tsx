// The home screen's statistics (library/practiceStats.ts): days in a row, this week's minutes,
// the right answers in sightreading, ear training and lesson steps, and the notes inside the
// harmony in Free Improvisation, against the week before, where the time went
// this month, and what to work on (the chords missed most, the progression heard wrong most).

import { useState } from 'react'
import { loadPracticeLog, PRACTICE_AREAS, type PracticeArea, type PracticeLog } from './library/practiceLog'
import { accuracy, hardestProgression, lastWeek, minutesByArea, streaks, totalHours, weakestChords } from './library/practiceStats'
import { loadJson } from './library/storage'
import { Icon } from './ui/Icon'

const AREA_NAMES: Record<PracticeArea, string> = { play: 'Play along', sightreading: 'Sightreading', ear: 'Ear training', improvisation: 'Improvisation', lessons: 'Lessons' }
// What the exercises remember (Chord Sightreading, Name the progression)
const CHORD_MISTAKES_KEY = 'eartraining:sightreading:mistakes'
const PROGRESSION_RESULTS_KEY = 'eartraining:name-progression:results'
const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)

/** A share as a whole percent. */
const percent = (share: number) => `${Math.round(share * 100)}%`

/** This week's share right in an area, and how it moved since the week before. */
function AccuracyCard({ area, label, log, today, right = 'right' }: { area: PracticeArea; label: string; log: PracticeLog; today: Date; right?: string }) {
  const now = accuracy(log, area, today)
  const before = accuracy(log, area, today, 7)
  const change = now !== null && before !== null ? Math.round((now - before) * 100) : null
  return (
    <div className="stat">
      <span className="stat-label"><Icon name="target" />{label}</span>
      <strong className="stat-value">{now === null ? '–' : percent(now)}</strong>
      <span className="stat-note">
        {now === null ? `${right} this week, once you play` : change === null ? `${right} this week`
          : change === 0 ? `${right}, as last week` : `${right}, ${change > 0 ? '+' : ''}${change} points on last week`}
      </span>
    </div>
  )
}

/** The statistics section. */
export function PracticeStats() {
  // Read once when the home screen opens
  const [log] = useState(loadPracticeLog)
  const [today] = useState(() => new Date())
  const { current, best } = streaks(log, today)
  const week = lastWeek(log, today)
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0)
  const tallest = Math.max(10, ...week.map((day) => day.minutes))
  const month = minutesByArea(log, 30, today)
  const monthTotal = PRACTICE_AREAS.reduce((sum, area) => sum + month[area], 0)
  const chords = weakestChords(loadJson(CHORD_MISTAKES_KEY, {}, isObject))
  const progression = hardestProgression(loadJson(PROGRESSION_RESULTS_KEY, {}, isObject))
  const empty = !Object.keys(log).length

  return (
    <section className="home-stats" aria-labelledby="stats-title">
      <h2 id="stats-title">Your statistics</h2>
      {empty && <p className="stat-empty">Play, read or train your ear for a minute: your statistics start here.</p>}
      <div className="stats-grid">
        <div className="stat stat-streak">
          <span className="stat-label"><Icon name="flame" />Days in a row</span>
          <strong className="stat-value">{current}</strong>
          <span className="stat-note">best {best} · {totalHours(log)} hours in all</span>
        </div>
        <div className="stat stat-week">
          <span className="stat-label"><Icon name="clock" />This week</span>
          <strong className="stat-value">{weekMinutes} min</strong>
          <div className="stat-bars" role="img" aria-label={`Minutes each day: ${week.map((d) => d.minutes).join(', ')}`}>
            {week.map((day, i) => (
              <span key={i} className="stat-bar">
                <i style={{ height: `${Math.max(day.minutes ? 8 : 2, (day.minutes / tallest) * 100)}%` }} className={day.minutes ? 'on' : ''} />
                <small>{day.day}</small>
              </span>
            ))}
          </div>
        </div>
        <AccuracyCard area="sightreading" label="Sightreading" log={log} today={today} />
        <AccuracyCard area="ear" label="Ear training" log={log} today={today} />
        <AccuracyCard area="improvisation" label="Improvisation" log={log} today={today} right="of the notes inside the harmony" />
        <AccuracyCard area="lessons" label="Lessons" log={log} today={today} right="right in lesson steps" />
        <div className="stat stat-areas">
          <span className="stat-label"><Icon name="clock" />The last 30 days</span>
          {monthTotal ? <ul className="stat-area-list">
            {PRACTICE_AREAS.map((area) => (
              <li key={area}>
                <span>{AREA_NAMES[area]}</span>
                <span className="stat-area-bar"><i style={{ width: `${(month[area] / monthTotal) * 100}%` }} /></span>
                <span>{month[area]} min</span>
              </li>
            ))}
          </ul> : <span className="stat-note">Where your time goes, by area.</span>}
        </div>
        <div className="stat stat-work">
          <span className="stat-label"><Icon name="target" />To work on</span>
          {chords.length || progression ? <ul className="stat-work-list">
            {chords.length > 0 && <li>Chords missed most: {chords.map((c) => c.name).join(', ')}</li>}
            {progression && <li>
              Heard right least: {progression.name} ({percent(progression.share)}){progression.takenFor ? `, taken for ${progression.takenFor}` : ''}
            </li>}
          </ul> : <span className="stat-note">The chords you miss in Chord Sightreading and the progressions you confuse in Name the progression.</span>}
        </div>
      </div>
    </section>
  )
}
