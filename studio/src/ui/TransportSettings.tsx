import type { ReactNode } from 'react'
import { Popover } from './Popover'

/** On phones, the transport's settings (style, key, tempo, practice, mixer...) in a panel that slides up from the bottom. */
export function TransportSettings({ children }: { children: ReactNode }) {
  return (
    <Popover id="transport-settings" className="transport-settings" label="Settings" title="Style, key, tempo and mixer">
      {(close) => (
        <div className="settings-sheet">
          <div className="settings-sheet-head">
            <span className="label">Settings</span>
            <button className="topbar-button" onClick={close}>Done</button>
          </div>
          {children}
        </div>
      )}
    </Popover>
  )
}
