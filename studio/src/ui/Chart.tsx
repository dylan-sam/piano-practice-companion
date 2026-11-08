import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { ROW_CELLS, tuplets, type Chart as ChartData, type ChartBar, type TimeSignature } from '../music/chart'
import { parseChord, prettyNoteName, transposeChord, type Chord } from '../music/chords'
import type { StyleDefinition } from '../styles/types'
import { ChordSymbol, type ChordNotation } from './ChordSymbol'
import { useDisplay } from './display'
import { keyChange } from '../music/roman'
import { useFitChords } from './fitChords'
import { useAutoScroll } from './useAutoScroll'
import { useTwoBarRows } from './useNarrowScreen'

// SMuFL glyphs from Petaluma Text
const GLYPH = { repeatLeft: '', repeatRight: '', segno: '', coda: '', fermata: '', repeatBar: '\uE500' }

interface ChartProps {
  chart: ChartData
  style: StyleDefinition
  transpose: number
  activeMeasure: number | null
  beatInBar: number
  barBeats: number
  range?: [number, number] | null // looped bars
  selectedBar?: number | null // the bar being edited
  onBarClick?: (index: number) => void
  header?: ReactNode // replaces the title block, e.g. with inputs in the editor
  concealHidden?: boolean // draw chords marked hidden as one blank per bar (exercises)
  concealOtherChords?: boolean // leave non-answer chords empty while preserving the bar layout
  chordFeedback?: Record<string, 'correct' | 'missed'> // written bar:chord index
  romanNumerals?: boolean // false where Roman numerals would give an answer away (default true)
  autoScroll?: boolean // keep the playing bar near the middle of the screen (player and sightreader)
}

interface PlacedBar {
  index: number
  bar: ChartBar
  column: number
  // keyPc: the key in force where the chord starts (catalog charts carry key changes, ChartBar.keys)
  chords: { chord: Chord | null; symbol: string | null; beats: number; hidden: boolean; index: number; keyPc: number }[]
  closesRow: boolean
  repeats: boolean // the bar has the same chords, with the same lengths, as the bar before
}

/** Tell whether a bar repeats the bar before it exactly (same chords and lengths, nothing hidden). */
function repeatsBar(bar: ChartBar, previous: ChartBar | undefined): boolean {
  if (!previous || previous.spacer || bar.spacer || !bar.chords.length) return false
  if (bar.chords.length !== previous.chords.length || [...bar.chords, ...previous.chords].some((c) => c.hidden)) return false
  return bar.chords.every((c, i) => c.symbol === previous.chords[i].symbol && Math.abs(c.beats - previous.chords[i].beats) < 1e-6)
}

/**
 * Lay out bars in rows of `rowCells` cells and merge concealed chord runs without changing playback data.
 * A chart row wider than `rowCells` (on phones, half a row) continues on the next row.
 */
function rows(chart: ChartData, transpose: number, conceal: boolean, concealOtherChords: boolean,
  rowCells = ROW_CELLS): PlacedBar[][] {
  const out: PlacedBar[][] = []
  let row: PlacedBar[] = []
  let column = 0
  // Charts without row information get four bars to a row
  const hasRows = chart.bars.some((b) => b.rowStart)
  let keyPc = (chart.key + transpose + 12) % 12
  chart.bars.forEach((bar, index) => {
    // Key changes of the bar, in order; an older chart has only its "Key: ..." comment (a change at the downbeat)
    const changes = bar.keys ?? (keyChange(bar.comment) !== null ? [{ beats: 0, key: keyChange(bar.comment)! }] : [])
    // The key in force at a beat of the chart
    const keyAt = (beat: number) => {
      for (const change of changes) if (change.beats <= beat + 1e-6) keyPc = (change.key + transpose + 12) % 12
      return keyPc
    }
    let at = 0 // beats into the bar where the next chord starts
    const startsRow = hasRows ? Boolean(bar.rowStart) : index % 4 === 0
    if (row.length && (startsRow || column + Math.min(bar.cells, rowCells) > rowCells)) {
      out.push(row)
      row = []
      column = 0
    }
    const chords: PlacedBar['chords'] = []
    for (const [chordIndex, { symbol, beats, hidden }] of bar.chords.entries()) {
      const chordKey = keyAt(at)
      at += beats
      const last = chords.at(-1)
      // Concealed neighbours become one blank, so the number of hidden chords isn't given away
      if ((conceal && hidden && last?.hidden) || (concealOtherChords && !hidden && last && !last.hidden)) {
        last.beats += beats
        continue
      }
      const parsed = symbol ? parseChord(symbol) : null
      chords.push({ symbol, beats, hidden: !!hidden, chord: parsed ? transposeChord(parsed, transpose) : null, index: chordIndex, keyPc: chordKey })
    }
    keyAt(Infinity) // a change after the last chord applies from the next bar
    row.push({ index, bar, column, chords, closesRow: false, repeats: repeatsBar(bar, chart.bars[index - 1]) })
    column += Math.min(bar.cells, rowCells)
  })
  if (row.length) out.push(row)
  for (const r of out) r[r.length - 1].closesRow = true
  return out
}

// A time signature written as two stacked numbers
function TimeSig({ time }: { time: TimeSignature }) {
  return (
    <span className="timesig" aria-label={`${time[0]}/${time[1]} time`}>
      <span>{time[0]}</span>
      <span>{time[1]}</span>
    </span>
  )
}

interface BarProps {
  rowCells: number // cells in a row: 16, or 8 on phones
  conceal: boolean
  concealOtherChords: boolean
  placed: PlacedBar
  prev: PlacedBar | undefined
  keyPc: number
  active: boolean
  progress: number
  showTime: TimeSignature | null
  inRange: boolean
  selected: boolean
  onClick?: (index: number) => void
  chordFeedback?: Record<string, 'correct' | 'missed'>
  notation: ChordNotation & { repeatSign: boolean }
}

/** Render one chart bar, leaving context chords empty when the exercise requests it. */
function Bar({ rowCells, conceal, concealOtherChords, placed, prev, keyPc, active, progress, showTime, inRange, selected, onClick, chordFeedback, notation }: BarProps) {
  const { bar, chords, column, closesRow, index } = placed
  // The chords of the bar, in the notation chosen in the Display menu (Roman numerals of the local key)
  const symbolNotation = (chordKey: number): ChordNotation =>
    ({ minor: notation.minor, romanKey: notation.romanKey === null ? null : chordKey })
  // A repeated bar is drawn as % unless an exercise hides chords or marks them right or wrong
  const asRepeat = notation.repeatSign && placed.repeats && !conceal && !concealOtherChords &&
    !chords.some((c) => chordFeedback?.[`${index}:${c.index}`])
  const classes = ['bar']
  if (bar.spacer) classes.push('bar-spacer')
  // The previous bar already drew a special closing barline on this edge
  if (bar.repeatStart) classes.push('bar-repeat-start')
  else if (prev && (prev.bar.barline || prev.bar.repeatEnd)) classes.push('bar-no-left')
  if (bar.repeatEnd) classes.push('bar-repeat-end')
  else if (bar.barline) classes.push(`bar-${bar.barline}`)
  else if (closesRow && !bar.spacer) classes.push('bar-close')
  // A time signature at the start of a line is drawn before the barline, in the margin, so it leaves
  // the bar's room to the chords; inside a line it takes room at the start of the bar
  if (showTime) classes.push(column === 0 ? 'bar-time-before' : 'bar-with-time')
  if (chords.length > 2) classes.push('bar-dense')
  else if (chords.length === 2 && bar.cells <= 4) classes.push('bar-pair')
  if (inRange) classes.push('bar-in-range')
  if (selected) classes.push('bar-selected')
  if (onClick && !bar.spacer) classes.push('bar-clickable')
  const interactive = onClick && !bar.spacer

  const style: CSSProperties = {
    gridColumn: `${column + 1} / span ${Math.min(bar.cells, rowCells)}`,
    gridTemplateColumns: chords.map((c) => `${c.beats}fr`).join(' ') || '1fr',
  }
  // Chords lasting a tuplet (three in the time of four beats...) get a bracket with its count over
  // them; the bracket shares their grid columns, so each chord is placed in its own column
  const marks = tuplets(chords.map((c) => c.beats))
  // Grid placement of a chord when the bar has tuplet marks above it
  const cell = (j: number): CSSProperties | undefined => (marks.length ? { gridColumn: j + 1, gridRow: 1 } : undefined)

  const note = [bar.comment, bar.directive, bar.repeatTimes && bar.repeatTimes > 2 ? `${bar.repeatTimes}x` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={classes.join(' ')}
      style={style}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Bar ${index + 1}` : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? () => onClick(index) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onClick(index)
            }
          : undefined
      }
    >
      {column === 0 && !bar.spacer && <span className="bar-number">{index + 1}</span>}
      {bar.section && (
        <span className="mark-section">{bar.section === 'i' ? 'Intro' : bar.section === 'v' ? 'Verse' : bar.section}</span>
      )}
      {bar.ending && <span className="mark-ending">{bar.ending}.</span>}
      {(bar.segno || bar.coda) && (
        <span className="mark-sign" aria-label={bar.segno ? 'Segno' : 'Coda'}>
          {bar.segno ? GLYPH.segno : GLYPH.coda}
        </span>
      )}
      {bar.repeatStart && (
        <span className="glyph-repeat glyph-repeat-left" aria-hidden="true">
          {GLYPH.repeatLeft}
        </span>
      )}
      {bar.repeatEnd && (
        <span className="glyph-repeat glyph-repeat-right" aria-hidden="true">
          {GLYPH.repeatRight}
        </span>
      )}
      {showTime && <TimeSig time={showTime} />}
      {active && <span className="bar-highlight" style={{ transform: `scaleX(${progress})` }} />}
      {asRepeat && (
        <span className="chord chord-repeat" style={{ gridColumn: '1 / -1' }} aria-label="Repeat the previous bar">
          {GLYPH.repeatBar}
        </span>
      )}
      {!asRepeat && chords.map(({ chord, symbol, hidden, index: chordIndex, keyPc: chordKey }, j) =>
        hidden && conceal ? (
          <span key={j} className="chord chord-hidden" style={cell(j)} aria-label="Hidden chords">
            ?
          </span>
        ) : !hidden && concealOtherChords ? (
          <span key={j} className="chord chord-empty" style={cell(j)} aria-hidden="true" />
        ) : chord ? (
          <ChordSymbol key={j} chord={chord} keyPc={keyPc} style={cell(j)} notation={symbolNotation(chordKey)}
            className={[hidden && 'chord-revealed', chordFeedback?.[`${index}:${chordIndex}`] === 'correct' && 'chord-correct',
              chordFeedback?.[`${index}:${chordIndex}`] === 'missed' && 'chord-missed'].filter(Boolean).join(' ')} />
        ) : symbol === null ? (
          <span key={j} className="chord chord-nc" style={cell(j)}>
            N.C.
          </span>
        ) : (
          <span key={j} className="chord chord-unknown" style={cell(j)} title="Unrecognized chord">
            {symbol}
          </span>
        ),
      )}
      {!asRepeat && marks.map((t) => (
        <span key={`t${t.first}`} className="tuplet" style={{ gridColumn: `${t.first + 1} / ${t.last + 2}`, gridRow: 1 }}
          aria-label={`${t.count} in the time of ${Math.round(chords.slice(t.first, t.last + 1).reduce((sum, c) => sum + c.beats, 0) * 100) / 100} beats`}>
          <span className="tuplet-count">{t.count}</span>
        </span>
      ))}
      {bar.fermata && (
        <span className="mark-fermata" aria-label="Fermata">
          {GLYPH.fermata}
        </span>
      )}
      {note && <span className="mark-text">{note}</span>}
    </div>
  )
}

/** The title block of a sheet: the style, the title, and the composer or the key. */
export function SheetHead({ chart, style, keyPc }: { chart: ChartData; style: StyleDefinition; keyPc: number }) {
  const keyName = prettyNoteName(keyPc) + (chart.minor ? '\u2212' : '')
  return (
    <header className="sheet-head">
      <span className="sheet-meta">{`(${chart.sourceStyle || style.name})`}</span>
      <h1 className="sheet-title">{chart.title}</h1>
      <span className="sheet-meta sheet-meta-right">{chart.composer ?? `Key of ${keyName}`}</span>
    </header>
  )
}

/** Render an editable or read-only chord chart with optional exercise concealment. */
export function Chart(props: ChartProps) {
  const { chart, style, transpose, activeMeasure, beatInBar, barBeats, range, selectedBar, onBarClick, header } = props
  const conceal = props.concealHidden ?? false
  const concealOtherChords = props.concealOtherChords ?? false
  const keyPc = (chart.key + transpose + 12) % 12
  const display = useDisplay()
  const notation = {
    minor: display.minor,
    romanKey: display.roman && (props.romanNumerals ?? true) ? keyPc : null, // per bar: the key in force
    repeatSign: display.repeatSign,
  }
  // On phones a chart row becomes two rows of two bars; an exercise's single line stays one line
  const narrow = useTwoBarRows()
  const rowCells = narrow && !conceal ? ROW_CELLS / 2 : ROW_CELLS
  const layout = useMemo(() => rows(chart, transpose, conceal, concealOtherChords, rowCells),
    [chart, transpose, conceal, concealOtherChords, rowCells])
  const sheetRef = useRef<HTMLElement>(null)
  const drawn = useMemo(() => [layout, keyPc, props.chordFeedback, display], [layout, keyPc, props.chordFeedback, display])
  useFitChords(sheetRef, drawn)
  useAutoScroll(sheetRef, !!props.autoScroll && display.autoScroll && props.activeMeasure !== null, `${props.activeMeasure}:${props.beatInBar}`)

  return (
    <article className="sheet" ref={sheetRef} aria-label={`${chart.title} chord chart`}>
      {header ?? <SheetHead chart={chart} style={style} keyPc={keyPc} />}

      <div className="rows">
        {layout.map((row, r) => (
          <div className="row" key={r} style={{ '--row-cells': rowCells } as CSSProperties}>
            {row.map((placed, b) => (
              <Bar
                key={placed.index}
                rowCells={rowCells}
                conceal={conceal}
                concealOtherChords={concealOtherChords}
                placed={placed}
                prev={row[b - 1]}
                keyPc={keyPc}
                active={activeMeasure === placed.index}
                progress={Math.min(1, beatInBar / barBeats)}
                showTime={placed.index === 0 ? chart.time : placed.bar.partial ? null : (placed.bar.time ?? null)}
                inRange={!!range && placed.index >= Math.min(...range) && placed.index <= Math.max(...range)}
                selected={selectedBar === placed.index}
                onClick={onBarClick}
                chordFeedback={props.chordFeedback}
                notation={notation}
              />
            ))}
          </div>
        ))}
      </div>
    </article>
  )
}
