// Picking a Practice loop on the sheet: tap its first bar, then its last.

import { useState } from 'react'
import { useBackClose } from './backButton'

/**
 * Loop picking for a sheet: `start` waits for a first bar, `chooseBar` takes the first and then
 * the last bar and calls `onLoop` with them in order. The Android back button cancels it.
 */
export function useLoopPicking(onLoop: (loop: [number, number]) => void) {
  const [picking, setPicking] = useState<number | 'first' | null>(null)
  useBackClose(picking !== null, () => setPicking(null))

  /** Take a tapped bar: the first one, or the last one (then the loop is set). */
  const chooseBar = (index: number) => {
    if (picking === 'first') setPicking(index)
    else if (typeof picking === 'number') {
      onLoop([Math.min(picking, index), Math.max(picking, index)])
      setPicking(null)
    }
  }

  return {
    picking: picking !== null, // waiting for a bar
    firstBar: typeof picking === 'number' ? picking : null, // the first bar, once tapped
    start: () => setPicking('first'),
    cancel: () => setPicking(null),
    chooseBar,
  }
}
