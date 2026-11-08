// Fitting chord symbols into their bars: a bar holds one to many chords, some with long symbols
// (C7b9#11, Csusno5/G). The chords share the bar by beats but a long symbol may take more room
// from a short one; only when all of them together are wider than the bar are they drawn smaller,
// by the same factor for the whole bar, down to MIN_SCALE of their normal size (CROWDED_MIN_SCALE
// for a bar of more than CROWDED chords).

import { useLayoutEffect, type RefObject } from 'react'

export const MIN_SCALE = 0.45
// A bar crowded with chords (an iReal chart writing a melody's harmony) may shrink further
export const CROWDED_MIN_SCALE = 0.1
const CROWDED = 6 // chords in a bar from which it counts as crowded

/** Shrink the chords of each bar inside `root` whose chords are wider than the bar. */
export function fitBarChords(root: HTMLElement): void {
  for (const bar of root.querySelectorAll<HTMLElement>('.bar')) {
    const chords = [...bar.children].filter((child): child is HTMLElement => child.classList.contains('chord'))
    for (const chord of chords) chord.style.fontSize = ''
    const style = getComputedStyle(bar)
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const room = bar.clientWidth - padding
    const needed = bar.scrollWidth - padding
    if (!chords.length || room <= 0 || needed <= room + 1) continue
    const floor = chords.length > CROWDED ? CROWDED_MIN_SCALE : MIN_SCALE
    const factor = Math.max(floor, (room / needed) * 0.97) // a little room so the symbols do not touch
    for (const chord of chords) {
      chord.style.fontSize = `${parseFloat(getComputedStyle(chord).fontSize) * factor}px`
    }
  }
}

/**
 * Fit the chords of a chart when it is drawn, when its width changes and once the fonts are loaded.
 * `content` is any value that changes whenever the drawn chords change.
 */
export function useFitChords(ref: RefObject<HTMLElement | null>, content: unknown): void {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let width = -1
    // Fit the bar's chords again when the chart's width changes
    const fit = () => {
      if (root.clientWidth === width) return // only a width change can change the fit
      width = root.clientWidth
      fitBarChords(root)
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(root)
    void document.fonts?.ready.then(() => { width = -1; fit() })
    return () => observer?.disconnect()
  }, [ref, content])
}
