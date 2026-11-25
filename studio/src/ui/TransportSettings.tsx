import type { ReactNode } from 'react'
import { Popover } from './Popover'

/** On phones, tablets and windows below 1760 px, the transport's settings (style, key, tempo, practice, mixer...) in a panel that opens from the Settings button. */
export function TransportSettings({ children }: { children: ReactNode }) {
  return (
    <Popover id="transport-settings" className="transport-settings" label="Settings" title="Style, key, tempo and mixer">
      {(close) => (
        // A button that opens something of its own over the sheet (the chord helper) closes the sheet
        <div className="settings-sheet" onClick={(e) => { if ((e.target as Element).closest('[data-closes-settings]')) close() }}>
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
