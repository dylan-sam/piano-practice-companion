import type { ReactNode } from 'react'
import { Popover } from './Popover'
import { useNarrowScreen } from './useNarrowScreen'

/**
 * A screen's top-bar actions: shown in the bar on wide screens, and in a "More" menu on phones,
 * where they do not fit. Panels of actions inside the menu (Share, Display) open in place.
 */
export function TopbarMenu({ children, active }: { children: ReactNode; active?: boolean }) {
  const narrow = useNarrowScreen()
  if (!narrow) return <>{children}</>
  return (
    <Popover id="topbar-menu" className="share topbar-menu" active={active} title="More"
      label={<span aria-label="More">⋯</span>}>
      {() => <div className="topbar-menu-items">{children}</div>}
    </Popover>
  )
}
