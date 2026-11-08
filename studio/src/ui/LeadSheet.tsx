// A chart with a melody, engraved as a lead sheet by abcjs (MIT, Paul Rosen and Gregory Dyke):
// the melody on a staff with the chord symbols above it. While the band plays, the bar being
// played gets the yellow highlighter of the chord chart and the note being played is coloured.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { barMeters, type Chart as ChartData } from '../music/chart'
import { melodyToAbc, type DrawnEvent } from '../music/abc'
import type { StyleDefinition } from '../styles/types'
import { useDisplay } from './display'
import { SheetHead } from './Chart'
import { useAutoScroll, type ReadingRow } from './useAutoScroll'
import { useTwoBarRows } from './useNarrowScreen'

interface LeadSheetProps {
  chart: ChartData
  style: StyleDefinition
  transpose: number
  activeMeasure: number | null
  beatInBar: number
  barBeats: number
  range?: [number, number] | null // looped bars
  onBarClick?: (index: number) => void
  autoScroll?: boolean
}

// The engraver is loaded with the first lead sheet, so chord charts don't download it
type Abcjs = typeof import('abcjs')
let abcjsLoad: Promise<Abcjs> | null = null
const loadAbcjs = () => (abcjsLoad ??= import('abcjs'))

const STAFF_WIDTH = 900 // abcjs layout width; the drawing then scales to the sheet's width
const PHONE_STAFF_WIDTH = 520
const CLICK_ABOVE = 50 // a bar can be picked from this far above its staff (its chord symbols)...
const CLICK_BELOW = 20 // ...and below it
const LOOP_GAP = 10 // the pencil line under looped bars, this far below the staff
const NOTE_LEAD = 2 // the highlight reaches a note just before its head
const MARGIN_GAP = 6 // a rehearsal mark before a staff line ends this far left of it

/** A drawn note or rest with its SVG element and the staff line it sits on. */
interface DrawnNote extends DrawnEvent {
  element: SVGGraphicsElement
  line: number
}

/** A number from an abcjs class of an element: abcjs-l<n> is its staff line, abcjs-mm<n> its bar. */
function classNumber(element: Element, prefix: string): number {
  const match = new RegExp(`(?:^|\\s)${prefix}(\\d+)(?:\\s|$)`).exec(element.getAttribute('class') ?? '')
  return match ? Number(match[1]) : -1
}

/** The staff line (0, 1...) an abcjs element was drawn on. */
const lineOf = (element: Element) => Math.max(0, classNumber(element, 'abcjs-l'))

/**
 * Pair the writer's notes and rests with the elements abcjs drew for them. abcjs numbers the
 * bars it draws (abcjs-mm<n>), which are the chart's bars without its spacers; inside a bar
 * notes and rests come in drawing order.
 */
function pairNotes(root: HTMLElement, events: DrawnEvent[], drawnBars: number[]): DrawnNote[] {
  const byBar = new Map<number, SVGGraphicsElement[]>()
  for (const element of root.querySelectorAll<SVGGraphicsElement>('.abcjs-note, .abcjs-rest')) {
    const bar = drawnBars[classNumber(element, 'abcjs-mm')]
    if (bar === undefined) continue
    byBar.set(bar, [...(byBar.get(bar) ?? []), element])
  }
  const used = new Map<number, number>()
  return events.flatMap((event) => {
    const index = used.get(event.bar) ?? 0
    used.set(event.bar, index + 1)
    const element = byBar.get(event.bar)?.[index]
    return element ? [{ ...event, element, line: lineOf(element) }] : []
  })
}

/** A box in the coordinates of a container element. */
interface Box { left: number; top: number; width: number; height: number }

/** The box of an element relative to a container. */
function boxIn(element: Element, container: Element): Box {
  const r = element.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height }
}

/** Where a bar is drawn, and whether it starts its staff line. */
interface BarBox extends Box { lineStart: boolean }

/** The smallest box around several boxes. */
function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  const left = Math.min(...boxes.map((b) => b.left))
  const top = Math.min(...boxes.map((b) => b.top))
  const right = Math.max(...boxes.map((b) => b.left + b.width))
  const bottom = Math.max(...boxes.map((b) => b.top + b.height))
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * The box of a note or rest symbol (head, stem, flags, accidentals), without the chord symbol
 * drawn in its group, which may stick out past the bar line.
 */
function symbolBox(element: Element, root: Element): Box {
  return union([...element.querySelectorAll('path')].map((path) => boxIn(path, root)).filter((b) => b.width > 0)) ??
    boxIn(element, root)
}

/** The vertical extent of each staff line: the box around its five staff lines. */
function staffBoxes(root: HTMLElement): Map<number, Box> {
  const out = new Map<number, Box>()
  for (const staff of root.querySelectorAll('.abcjs-staff')) {
    const line = lineOf(staff)
    const box = boxIn(staff, root)
    out.set(line, union([box, ...(out.has(line) ? [out.get(line)!] : [])])!)
  }
  return out
}

/**
 * The box of a written bar: across from the barline before it to the barline after it, over its
 * staff line. Bars are found by their notes; the barlines are the nearest ones around them.
 */
function barBox(root: HTMLElement, notes: DrawnNote[], bar: number, staffs: Map<number, Box>): BarBox | null {
  const own = notes.filter((n) => n.bar === bar)
  const area = union(own.map((n) => symbolBox(n.element, root)))
  if (!area) return null
  const line = own[0].line
  const staff = staffs.get(line)
  const bars = [...root.querySelectorAll('.abcjs-bar')].filter((b) => lineOf(b) === line).map((b) => boxIn(b, root))
  const before = bars.filter((b) => b.left + b.width <= area.left + 1).map((b) => b.left + b.width)
  // The bar line after the last symbol's start (a tie from it runs on past the bar line)
  const lastStart = Math.max(...own.map((n) => symbolBox(n.element, root).left))
  const after = bars.filter((b) => b.left > lastStart).map((b) => b.left)
  // The first bar of a staff line starts after the clef and key signature, just before its first note
  const left = before.length ? Math.max(...before) : area.left - 6
  const right = after.length ? Math.min(...after) : area.left + area.width
  const top = staff ? staff.top : area.top
  const height = staff ? staff.height : area.height
  return { left, top, width: right - left, height, lineStart: !before.length }
}

/** A point of a bar's highlight: at a time of the bar (quarter notes), the highlight reaches x. */
interface Anchor { at: number; x: number }

interface Boxes {
  bars: Map<number, BarBox> // by written bar
  anchors: Map<number, Anchor[]> // by written bar, in time order
  sections: { text: string; left: number; top: number; margin: boolean }[]
}
const NO_BOXES: Boxes = { bars: new Map(), anchors: new Map(), sections: [] }


/**
 * Where the highlight of a bar is at each note: abcjs spaces notes by their kind, not their
 * length (a run of sixteenths takes more room than a half note), so the highlight runs from
 * note to note, reaching each one as it sounds, instead of sweeping the bar at a steady speed.
 */
function barAnchors(root: HTMLElement, notes: DrawnNote[], bar: number, box: Box, beats: number): Anchor[] {
  const anchors: Anchor[] = [{ at: 0, x: box.left }]
  for (const note of notes) {
    if (note.bar !== bar || note.at <= 1e-6) continue // a note on the downbeat: begin at the bar line
    const x = Math.max(symbolBox(note.element, root).left - NOTE_LEAD, anchors[anchors.length - 1].x)
    anchors.push({ at: note.at, x })
  }
  anchors.push({ at: beats, x: Math.max(box.left + box.width, anchors[anchors.length - 1].x) })
  return anchors
}

/** The highlight's right edge at a time of the bar, between the anchors around it. */
function anchorX(anchors: Anchor[], at: number): number {
  const next = anchors.findIndex((a) => a.at > at)
  if (next <= 0) return anchors[next === 0 ? 0 : anchors.length - 1].x
  const a = anchors[next - 1]
  const b = anchors[next]
  return a.x + ((b.x - a.x) * (at - a.at)) / (b.at - a.at)
}

/** The screen rectangle of a staff line: around all the pieces of its five lines. */
function lineRect(root: HTMLElement, line: number): DOMRect | null {
  const rects = [...root.querySelectorAll('.abcjs-staff')].filter((s) => lineOf(s) === line).map((s) => s.getBoundingClientRect())
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  return new DOMRect(left, top, Math.max(...rects.map((r) => r.right)) - left, Math.max(...rects.map((r) => r.bottom)) - top)
}

/**
 * Rehearsal marks (A, B, Intro...), boxed as on the chord chart: in the margin before a staff
 * line that starts with the mark, else above the chord symbols at the start of their bar.
 */
function sectionMarks(root: HTMLElement, chart: ChartData, notes: DrawnNote[], bars: Map<number, BarBox>) {
  const chords = [...root.querySelectorAll('.abcjs-chord')].map((c) => ({ line: lineOf(c), box: boxIn(c, root) }))
  return chart.bars.flatMap((bar, index) => {
    if (!bar.section) return []
    const box = bars.get(index)
    const line = notes.find((n) => n.bar === index)?.line
    if (!box || line === undefined) return []
    const text = bar.section === 'i' ? 'Intro' : bar.section === 'v' ? 'Verse' : bar.section
    if (box.lineStart) return [{ text, left: -MARGIN_GAP, top: box.top - 2, margin: true }]
    const chordTops = chords.filter((c) => c.line === line).map((c) => c.box.top)
    const top = (chordTops.length ? Math.min(...chordTops) : box.top - 30) - 30
    return [{ text, left: box.left - 14, top, margin: false }]
  })
}

/** Render a chart that has a melody as an engraved lead sheet that follows playback. */
export function LeadSheet({ chart, style, transpose, activeMeasure, beatInBar, barBeats, range, onBarClick, autoScroll }: LeadSheetProps) {
  const display = useDisplay()
  const phone = useTwoBarRows()
  const keyPc = (chart.key + transpose + 12) % 12
  const { abc, events } = useMemo(() => melodyToAbc(chart, transpose, display, phone ? 2 : 4), [chart, transpose, display, phone])
  // The chart bars abcjs draws, in order (spacers are left out)
  const drawnBars = useMemo(() => chart.bars.flatMap((bar, index) => (bar.spacer ? [] : [index])), [chart])
  const sheetRef = useRef<HTMLElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<DrawnNote[]>([])
  const [layout, setLayout] = useState(0) // bumped when the drawing is laid out again (resizes)
  const clickRef = useRef(onBarClick)
  useEffect(() => {
    clickRef.current = onBarClick
  }, [onBarClick])

  // Engrave the sheet whenever its music or the layout changes
  useEffect(() => {
    let cancelled = false
    void loadAbcjs().then((abcjs) => {
      const score = scoreRef.current
      if (cancelled || !score) return
      abcjs.renderAbc(score, abc, {
        add_classes: true,
        responsive: 'resize',
        staffwidth: phone ? PHONE_STAFF_WIDTH : STAFF_WIDTH,
        jazzchords: true,
        selectTypes: false, // clicks pick bars (loops); abcjs does not select notes
        foregroundColor: 'currentColor',
        paddingleft: 0,
        paddingright: 0,
        paddingtop: 4,
        paddingbottom: 4,
        format: {
          gchordfont: '"Petaluma Script" 20',
          annotationfont: '"Petaluma Script" 15',
          tripletfont: '"Petaluma Script" 13 italic',
          measurefont: '"IBM Plex Mono" 10',
          stretchlast: 1,
        },
        ariaLabel: `${chart.title} lead sheet`,
      })
      setNotes(pairNotes(score, events, drawnBars))
    })
    return () => {
      cancelled = true
    }
  }, [abc, events, drawnBars, phone, chart.title])

  // The drawing scales with the sheet: measure the highlight again after a resize
  useEffect(() => {
    const score = scoreRef.current
    if (!score || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setLayout((n) => n + 1))
    observer.observe(score)
    return () => observer.disconnect()
  }, [])

  // The note being played: the last one started at the current beat of the playing bar
  const current = useMemo(() => {
    if (activeMeasure === null) return null
    let found: DrawnNote | null = null
    for (const note of notes) if (note.bar === activeMeasure && note.at <= beatInBar + 1e-3) found = note
    return found
  }, [notes, activeMeasure, beatInBar])
  useEffect(() => {
    if (!current || current.rest) return
    current.element.classList.add('lead-note-playing')
    return () => current.element.classList.remove('lead-note-playing')
  }, [current])

  // Where each bar and rehearsal mark is drawn, measured again after each layout
  const [boxes, setBoxes] = useState<Boxes>(NO_BOXES)
  useLayoutEffect(() => {
    const score = scoreRef.current
    if (!score || !notes.length) return setBoxes(NO_BOXES)
    const staffs = staffBoxes(score)
    const bars = new Map<number, BarBox>()
    const anchors = new Map<number, Anchor[]>()
    const meters = barMeters(chart)
    for (const bar of new Set(notes.map((n) => n.bar))) {
      const box = barBox(score, notes, bar, staffs)
      if (!box) continue
      bars.set(bar, box)
      anchors.set(bar, barAnchors(score, notes, bar, box, meters[bar]?.beats ?? 4))
    }
    setBoxes({ bars, anchors, sections: sectionMarks(score, chart, notes, bars) })
  }, [notes, layout, chart])
  const active = activeMeasure === null ? undefined : boxes.bars.get(activeMeasure)
  const loop = range
    ? [...boxes.bars].filter(([bar]) => bar >= Math.min(...range) && bar <= Math.max(...range)).map(([, box]) => box)
    : []

  // Follow the highlight down the page: its row is the staff line, the next row the line below
  const locate = useMemo(() => (): ReadingRow | null => {
    const highlight = sheetRef.current?.querySelector('.lead-highlight')
    const score = scoreRef.current
    const row = score && current && lineRect(score, current.line)
    if (!highlight || !score || !current || !row) return null
    return { highlight: highlight.getBoundingClientRect(), row, next: lineRect(score, current.line + 1) }
  }, [current])
  useAutoScroll(sheetRef, !!autoScroll && display.autoScroll && activeMeasure !== null, `${activeMeasure}:${beatInBar}`, locate)

  // A click on a bar, or above it on its chords, picks it (loops)
  const onClick = (event: MouseEvent) => {
    const score = scoreRef.current
    if (!score || !clickRef.current) return
    const origin = score.getBoundingClientRect()
    const x = event.clientX - origin.left
    const y = event.clientY - origin.top
    const hit = [...boxes.bars].find(([, b]) => x >= b.left && x <= b.left + b.width &&
      y >= b.top - CLICK_ABOVE && y <= b.top + b.height + CLICK_BELOW)
    if (hit) clickRef.current(hit[0])
  }

  // The highlight's right edge: from note to note, as they are played
  const activeAnchors = activeMeasure === null ? undefined : boxes.anchors.get(activeMeasure)
  const reach = active && activeAnchors ? anchorX(activeAnchors, Math.min(beatInBar, barBeats)) - active.left : 0
  return (
    <article className="sheet lead-sheet" ref={sheetRef} aria-label={`${chart.title} lead sheet`}>
      <SheetHead chart={chart} style={style} keyPc={keyPc} />
      <div className={onBarClick ? 'lead-score lead-score-clickable' : 'lead-score'} onClick={onClick}>
        {boxes.sections.map((mark, i) => (
          <span key={`s${i}`} className={mark.margin ? 'mark-section lead-section lead-section-margin' : 'mark-section lead-section'}
            style={{ left: mark.left, top: mark.top }}>{mark.text}</span>
        ))}
        {loop.map((box, i) => (
          <span key={i} className="lead-loop" style={{ left: box.left, top: box.top + box.height + LOOP_GAP, width: box.width }} />
        ))}
        {active && (
          <span
            className="bar-highlight lead-highlight"
            style={{ left: active.left, top: active.top, width: Math.max(0, reach), height: active.height }}
          />
        )}
        <div ref={scoreRef} className="lead-engraving" />
      </div>
    </article>
  )
}
