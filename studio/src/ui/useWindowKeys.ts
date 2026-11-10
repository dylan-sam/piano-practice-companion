// Keyboard shortcuts of a screen, listened to on the whole window.

import { useEffect, useRef } from 'react'

/**
 * Call `onKey` for every key pressed on the page. The listener is registered once and always
 * calls the latest `onKey`, so the handler can use the screen's current state.
 */
export function useWindowKeys(onKey: (event: KeyboardEvent) => void): void {
  const handler = useRef(onKey)
  useEffect(() => {
    handler.current = onKey
  })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handler.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
