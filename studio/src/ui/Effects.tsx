// The overlay of the effects while playing (effects.ts): the last judgement in a small pill above
// the bottom bar ("Perfect", "Good x8", "Missed"), and a burst of colour after a chorus played well.

import { useEffect, useState, type CSSProperties } from 'react'
import { BURST_EVENT, JUDGED_EVENT, type JudgedEvent } from './effects'

const LABELS = { perfect: 'Perfect', good: 'Good', miss: 'Missed' } as const
const FLASH_MS = 700
const BURST_MS = 1600
const PIECES = 28 // pieces of colour in a burst

/** The judgement pill and the burst, drawn over the screen without catching clicks. */
export function Effects() {
  const [flash, setFlash] = useState<(JudgedEvent & { id: number }) | null>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    let flashTimer = 0
    let burstTimer = 0
    /** Show a judgement for a moment. */
    const onJudged = (event: Event) => {
      const { detail } = event as CustomEvent<JudgedEvent>
      setFlash({ ...detail, id: Date.now() })
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => setFlash(null), FLASH_MS)
    }
    /** Show a burst, unless motion is reduced. */
    const onBurst = () => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      setBurst(Date.now())
      window.clearTimeout(burstTimer)
      burstTimer = window.setTimeout(() => setBurst(0), BURST_MS)
    }
    window.addEventListener(JUDGED_EVENT, onJudged)
    window.addEventListener(BURST_EVENT, onBurst)
    return () => {
      window.removeEventListener(JUDGED_EVENT, onJudged)
      window.removeEventListener(BURST_EVENT, onBurst)
      window.clearTimeout(flashTimer)
      window.clearTimeout(burstTimer)
    }
  }, [])

  return (
    <div className="effects" aria-hidden="true">
      {flash && <span key={flash.id} className={`effect-flash effect-${flash.judgement}`}>
        {LABELS[flash.judgement]}{flash.judgement !== 'miss' && flash.run >= 4 ? ` ×${flash.run}` : ''}
      </span>}
      {burst > 0 && <div key={burst} className="effect-burst">
        {Array.from({ length: PIECES }, (_, i) => (
          <i key={i} style={{ '--angle': `${(360 / PIECES) * i}deg`, '--far': `${110 + ((i * 37) % 90)}px`, '--hue': i % 3 } as CSSProperties} />
        ))}
      </div>}
    </div>
  )
}
