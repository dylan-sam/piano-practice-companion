// Links between the app's screens, and the music-stand mark shown in top bars and on the menu.

import type { MouseEvent, ReactNode } from 'react'
import { navigate, ROUTES } from '../router'

/** The music-stand mark. */
export function StandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 4h20l-2 11H8z" />
      <path d="M5 15h22" />
      <path d="M16 15v12M16 27l-6 3M16 27l6 3" />
    </svg>
  )
}

interface AppLinkProps {
  to: string
  className?: string
  label?: string // accessible name when the visible text is not enough
  children: ReactNode
}

/** A link to an app route that changes screen without reloading; modified clicks open a new tab. */
export function AppLink({ to, className, label, children }: AppLinkProps) {
  // Plain clicks stay in the page; Ctrl, Cmd, Shift or middle clicks keep the browser's behaviour
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a className={className} href={to} aria-label={label} onClick={onClick}>
      {children}
    </a>
  )
}

/** The top-bar title of a screen; it leads back to the main menu. */
export function Wordmark({ children }: { children: ReactNode }) {
  return (
    <AppLink to={ROUTES.home} className="wordmark" label="Ear Training menu">
      <StandIcon />
      <span className="wordmark-text">{children}</span>
    </AppLink>
  )
}
