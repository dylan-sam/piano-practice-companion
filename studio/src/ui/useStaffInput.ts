// Writing notes on an engraved staff, as in a score editor: a tap (or click) on the staff above
// or below a note to fill in puts that note where it was tapped; a press and drag moves it up
// and down, and letting go places it. With a mouse a grey note follows the pointer first. The
// lead sheet draws the grey note; this hook finds the note and the staff place under the pointer.

import { useState, type PointerEvent, type RefObject } from 'react'
import type { Clef, Spelled } from '../music/abc'
import { noteAtPosition } from '../music/staff'
import { boxIn, staffBoxes, symbolBox, type Box, type DrawnNote } from './engraving'

/** What can be written on the sheet, and what to do with it. */
export interface StaffInput {
  notes: number[] // the melody notes (indexes) that can be written
  clef: Clef
  majorPc: number // the major key of the key signature
  onSelect: (index: number) => void
  onPlace: (index: number, note: Spelled) => void
}

/** The grey note under the pointer: where it is drawn and which note it writes. */
export interface Ghost {
  x: number // the centre of the note head, in the score's coordinates
  y: number
  space: number // the distance between two staff lines
  ledgers: number[] // the heights of the ledger lines it needs
  note: Spelled
  dragging: boolean // pressed: letting go places the note
}

/** A grey note with the melody note it writes, its staff line and the pointer moving it. */
interface Placing extends Ghost { index: number; line: number; pointer: number }

const REACH_SPACES = 6 // a press counts for a staff from this many spaces above or below it
const HIGHEST = -9 // the highest place: four ledger lines and a half above the staff...
const LOWEST = 17 // ...and the lowest, as far below it
const NEAR_HEAD = 2.5 // a press picks the nearest note within this many spaces of its head (sideways)

/** The centre of a drawn note's head (the first head of a tied note). */
function headCentre(note: DrawnNote, root: HTMLElement): number {
  const head = note.element.querySelector('.abcjs-notehead')
  const box = head ? boxIn(head, root) : symbolBox(note.element, root)
  return box.left + box.width / 2
}

/** The staff line (row) a height falls on, with its box, or null when it is far from every staff. */
function staffAt(y: number, staffs: Map<number, Box>): [number, Box] | null {
  let best: [number, Box] | null = null
  let distance = Infinity
  for (const [line, box] of staffs) {
    const reach = (box.height / 4) * REACH_SPACES
    if (y < box.top - reach || y > box.top + box.height + reach) continue
    const d = Math.abs(y - (box.top + box.height / 2))
    if (d < distance) {
      best = [line, box]
      distance = d
    }
  }
  return best
}

/** The ledger lines a place needs: every line above the staff (positions -2, -4...) or below it (10, 12...). */
function ledgersFor(position: number): number[] {
  const out: number[] = []
  for (let p = -2; p >= position; p -= 2) out.push(p)
  for (let p = 10; p <= position; p += 2) out.push(p)
  return out
}

/**
 * Follow the pointer over a score: which note it would write, and where. `notes` are the drawn
 * notes paired with the melody; `input` says which can be written (null: the sheet is read-only).
 */
export function useStaffInput(scoreRef: RefObject<HTMLElement | null>, notes: DrawnNote[], input: StaffInput | null | undefined) {
  const [ghost, setGhost] = useState<Placing | null>(null)

  /**
   * The note to write and its place at a pointer position, or null when there is none there.
   * While a note is being dragged it stays on its own column and staff line (`held`).
   */
  const target = (event: PointerEvent, held?: Placing): Placing | null => {
    const root = scoreRef.current
    if (!root || !input?.notes.length) return null
    const origin = root.getBoundingClientRect()
    const x = event.clientX - origin.left
    const y = event.clientY - origin.top
    const staffs = staffBoxes(root)
    const found: [number, Box] | null = held ? (staffs.has(held.line) ? [held.line, staffs.get(held.line)!] : null) : staffAt(y, staffs)
    if (!found) return null
    const [line, staff] = found
    const space = staff.height / 4
    let index: number
    let column: number
    if (held) {
      index = held.index
      column = held.x
    } else {
      const writable = new Set(input.notes)
      const nearest = notes.filter((n) => n.line === line && n.note !== undefined && writable.has(n.note))
        .map((n) => ({ index: n.note!, x: headCentre(n, root) }))
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]
      if (!nearest || Math.abs(nearest.x - x) > space * NEAR_HEAD * 2) return null
      index = nearest.index
      column = nearest.x
    }
    const position = Math.max(HIGHEST, Math.min(LOWEST, Math.round((y - staff.top) / (space / 2))))
    return {
      index, line, pointer: event.pointerId, x: column, y: staff.top + (position * space) / 2, space,
      ledgers: ledgersFor(position).map((p) => staff.top + (p * space) / 2),
      note: noteAtPosition(position, input.clef, input.majorPc), dragging: !!held,
    }
  }

  /** A press on a note to write selects it and starts placing it (it follows the pointer until let go). */
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !input) return
    const found = target(event)
    if (!found) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    input.onSelect(found.index)
    setGhost({ ...found, dragging: true })
  }

  /** While pressed the note moves up and down its column; a mouse hovering shows where a click would put it. */
  const onPointerMove = (event: PointerEvent) => {
    if (ghost?.dragging) {
      if (event.pointerId !== ghost.pointer) return
      const moved = target(event, ghost)
      if (moved) setGhost(moved)
      return
    }
    if (event.pointerType !== 'mouse') return
    setGhost(target(event))
  }

  /** Letting go places the note where the grey note is. */
  const onPointerUp = (event: PointerEvent) => {
    if (!ghost?.dragging || event.pointerId !== ghost.pointer || !input) return
    input.onPlace(ghost.index, ghost.note)
    setGhost(null)
  }

  /** The press was taken over by the browser: nothing is placed. */
  const onPointerCancel = () => setGhost(null)

  /** The mouse left the sheet: the hover note goes (a drag goes on, the pointer is captured). */
  const onPointerLeave = () => {
    if (!ghost?.dragging) setGhost(null)
  }

  return {
    ghost,
    handlers: input ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave } : {},
  }
}
