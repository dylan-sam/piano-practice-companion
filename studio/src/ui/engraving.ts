// Measuring an abcjs engraving: the staff lines, notes and symbols it drew, in the coordinates of
// the element around it. The lead sheet uses them for its highlighter, loops and note input.

import type { DrawnEvent } from '../music/abc'

/** A drawn note or rest with its SVG element and the staff line it sits on. */
export interface DrawnNote extends DrawnEvent {
  element: SVGGraphicsElement
  line: number
}

/** A number from an abcjs class of an element: abcjs-l<n> is its staff line, abcjs-mm<n> its bar. */
export function classNumber(element: Element, prefix: string): number {
  const match = new RegExp(`(?:^|\\s)${prefix}(\\d+)(?:\\s|$)`).exec(element.getAttribute('class') ?? '')
  return match ? Number(match[1]) : -1
}

/** The staff line (0, 1...) an abcjs element was drawn on. */
export const lineOf = (element: Element) => Math.max(0, classNumber(element, 'abcjs-l'))

/** A box in the coordinates of a container element. */
export interface Box { left: number; top: number; width: number; height: number }

/** The box of an element relative to a container. */
export function boxIn(element: Element, container: Element): Box {
  const r = element.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height }
}

/** The smallest box around several boxes. */
export function union(boxes: Box[]): Box | null {
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
export function symbolBox(element: Element, root: Element): Box {
  return union([...element.querySelectorAll('path')].map((path) => boxIn(path, root)).filter((b) => b.width > 0)) ??
    boxIn(element, root)
}

/** The vertical extent of each staff line: the box around its five staff lines. */
export function staffBoxes(root: HTMLElement): Map<number, Box> {
  const out = new Map<number, Box>()
  for (const staff of root.querySelectorAll('.abcjs-staff')) {
    const line = lineOf(staff)
    const box = boxIn(staff, root)
    out.set(line, union([box, ...(out.has(line) ? [out.get(line)!] : [])])!)
  }
  return out
}
