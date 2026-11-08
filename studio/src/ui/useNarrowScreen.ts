import { useSyncExternalStore } from 'react'

// Upright phones and narrow windows: the top bar's actions and the tune list move into menus
// (index.css uses the same query). Landscape phones keep the desktop layout (LANDSCAPE_QUERY).
export const NARROW_QUERY = '(max-width: 820px) and (min-height: 501px), (max-width: 600px)'
// Landscape phones: the desktop layout made compact (index.css)
export const LANDSCAPE_QUERY = '(max-height: 500px) and (min-width: 601px)'
// Screens where the tune list is a drawer over the chart: upright and landscape phones
export const DRAWER_QUERY = `${NARROW_QUERY}, ${LANDSCAPE_QUERY}`
// Narrow enough for two bars to a chart row: the same screens as NARROW_QUERY
export const TWO_BAR_QUERY = NARROW_QUERY
// Too narrow for the transport's controls in one row (phones, tablets, narrow windows): they open from Settings
export const COMPACT_TRANSPORT_QUERY = '(max-width: 1100px), (max-height: 500px)'

/** Subscribe to changes of a media query. */
function subscribeTo(text: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const query = window.matchMedia(text)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }
}

const subscribeNarrow = subscribeTo(NARROW_QUERY)
const subscribeTwoBars = subscribeTo(TWO_BAR_QUERY)
const subscribeCompact = subscribeTo(COMPACT_TRANSPORT_QUERY)
const subscribeDrawer = subscribeTo(DRAWER_QUERY)

/** Whether the screen is narrow (upright phone or narrow window), updated when it changes. */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => !!window.matchMedia?.(NARROW_QUERY).matches, () => false)
}

/** Whether chart rows hold two bars instead of four (upright phones and narrow windows). */
export function useTwoBarRows(): boolean {
  return useSyncExternalStore(subscribeTwoBars, () => !!window.matchMedia?.(TWO_BAR_QUERY).matches, () => false)
}

/** Whether the transport shows play, position and a Settings button only (screens up to 1100 px wide). */
export function useCompactTransport(): boolean {
  return useSyncExternalStore(subscribeCompact, () => !!window.matchMedia?.(COMPACT_TRANSPORT_QUERY).matches, () => false)
}

/** Whether the tune list is a drawer that opens over the chart (upright and landscape phones). */
export function useDrawerScreen(): boolean {
  return useSyncExternalStore(subscribeDrawer, () => !!window.matchMedia?.(DRAWER_QUERY).matches, () => false)
}
