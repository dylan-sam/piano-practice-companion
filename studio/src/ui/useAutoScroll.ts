// Keep the reading point of a playing chart near the middle of the screen
import { useEffect, useRef, type RefObject } from 'react'

const MANUAL_PAUSE_MS = 3000 // after the user scrolls by hand, the sheet is left alone this long

/** The element that scrolls the sheet: its nearest scrollable ancestor, or the page. */
function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/**
 * The reading point, in screen pixels from the top: the middle of the playing row, moved down
 * towards the next row as the highlight runs along it, so it moves at a steady speed set by the
 * tempo and the number of beats in a row.
 */
function readingY(highlight: HTMLElement): number | null {
  const row = highlight.parentElement?.parentElement
  if (!row) return null
  const rowBox = row.getBoundingClientRect()
  const along = rowBox.width > 0
    ? Math.min(1, Math.max(0, (highlight.getBoundingClientRect().right - rowBox.left) / rowBox.width)) : 0
  const next = row.nextElementSibling
  const pitch = next ? next.getBoundingClientRect().top - rowBox.top : rowBox.height
  return rowBox.top + rowBox.height / 2 + along * pitch
}

/**
 * Scroll the sheet while it plays so the yellow highlight stays near the middle of the visible
 * area: nothing happens until it reaches the middle, or when the whole sheet fits. `position`
 * changes on every frame of playback; scrolling by hand pauses the auto-scroll for a moment.
 */
export function useAutoScroll(sheetRef: RefObject<HTMLElement | null>, enabled: boolean, position: unknown): void {
  const pausedUntil = useRef(0)

  useEffect(() => {
    // A wheel turn, a swipe or a scrolling key: the user wants to look elsewhere for a moment
    const pause = () => { pausedUntil.current = performance.now() + MANUAL_PAUSE_MS }
    const onKey = (event: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) pause()
    }
    window.addEventListener('wheel', pause, { passive: true })
    window.addEventListener('touchmove', pause, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', pause)
      window.removeEventListener('touchmove', pause)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!enabled || !sheet || performance.now() < pausedUntil.current) return
    const highlight = sheet.querySelector<HTMLElement>('.bar-highlight')
    const y = highlight && readingY(highlight)
    if (y == null) return
    const scroller = scrollerOf(sheet)
    const room = scroller.scrollHeight - scroller.clientHeight
    if (room <= 1) return // the whole sheet is visible
    const page = scroller === document.scrollingElement || scroller === document.documentElement
    const view = page ? { top: 0, height: window.innerHeight } : scroller.getBoundingClientRect()
    const target = Math.max(0, Math.min(room, scroller.scrollTop + y - (view.top + view.height / 2)))
    if (Math.abs(target - scroller.scrollTop) >= 0.5) scroller.scrollTop = target
  }, [sheetRef, enabled, position])
}
