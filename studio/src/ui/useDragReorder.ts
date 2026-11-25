// Reordering a short list by dragging a handle (mouse, pen or finger) or with the arrow keys on it.
// While a row is dragged the list shows the new order; it is handed over when the row is let go,
// so a band that follows the order is arranged once, not at every row passed.

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** The list with one item moved from one place to another. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * The order to draw (the dragged one where it is now), the list's ref (its rows marked
 * `data-reorder-row`), the props of each row's handle, and the row being dragged.
 */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [drag, setDrag] = useState<{ order: T[]; index: number } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  /** The row under a height on the screen (the first or the last above or below the list). */
  const rowAt = (y: number): number => {
    const rows = [...(listRef.current?.querySelectorAll('[data-reorder-row]') ?? [])]
    const below = rows.findIndex((row) => y < row.getBoundingClientRect().bottom)
    return below < 0 ? rows.length - 1 : below
  }

  /** The props of the handle of the row at `index`. */
  const handle = (index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ order: items, index })
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag) return
      const to = rowAt(e.clientY)
      if (to !== drag.index) setDrag({ order: moved(drag.order, drag.index, to), index: to })
    },
    onPointerUp: () => {
      if (drag && drag.order !== items) onReorder(drag.order)
      setDrag(null)
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
      if (to < 0 || to >= items.length) return
      e.preventDefault()
      onReorder(moved(items, index, to))
    },
  })

  return { order: drag?.order ?? items, listRef, handle, dragging: drag?.index ?? null }
}
