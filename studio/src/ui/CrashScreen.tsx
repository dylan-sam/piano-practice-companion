// The crash catch: an error while drawing a screen (or a screen's code that cannot be downloaded,
// after an update) shows a short message with a Reload button instead of a blank page. Your songs
// and settings are kept in the browser, so reloading loses nothing but the song playing.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../errorReports'
import { routeUrl, ROUTES } from '../router'

interface State { error: Error | null }

/** Catch the errors of the screens inside it and offer to reload the app. */
export class CrashCatch extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  /** Remember the error, so the next draw shows the message. */
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  /** Keep the error in the console, with the screens it came through. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, `screen crashed${info.componentStack ? `:${info.componentStack}` : ''}`)
  }

  /** The screen, or the message when it crashed. */
  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main className="crash-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>The app hit an error and stopped this screen. Your songs and settings are safe: reload to go on.</p>
        <div className="crash-actions">
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload</button>
          <a className="button" href={routeUrl(ROUTES.home)}>Main menu</a>
        </div>
        <details>
          <summary>What happened</summary>
          <code>{this.state.error.message}</code>
        </details>
      </main>
    )
  }
}
