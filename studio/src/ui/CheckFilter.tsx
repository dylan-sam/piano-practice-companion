import { useState, type ReactNode } from 'react'

/** One choice of a check filter. */
export interface CheckOption {
  id: string
  label: string
  count?: number // shown at the right, e.g. how many songs
}

interface CheckFilterProps {
  name: string // the button's text, e.g. "Playlists"
  options: CheckOption[]
  chosen: string[] // the checked ids; none checked means no filter
  onChange: (chosen: string[]) => void
  before?: ReactNode // controls at the top of the panel (e.g. All of them / Any of them)
  actions?: ReactNode // more buttons beside the filter's button
  summary?: ReactNode // under the filter while some ids are checked
}

/**
 * A filter of check boxes in a panel that opens under its button: Progressions and Playlists in
 * the song list, Licks in Lick Sightreading. Nothing checked means nothing is filtered out.
 */
export function CheckFilter({ name, options, chosen, onChange, before, actions, summary }: CheckFilterProps) {
  const [open, setOpen] = useState(false)
  // Check or uncheck one option, keeping the options' order
  const toggle = (id: string) =>
    onChange(options.map((o) => o.id).filter((o) => (o === id ? !chosen.includes(id) : chosen.includes(o))))
  return (
    <div className="check-filter">
      <div className="check-filter-bar">
        <button className="library-import" aria-expanded={open} onClick={() => setOpen(!open)}>
          {name}{chosen.length ? ` (${chosen.length})` : ''} {open ? '▴' : '▾'}
        </button>
        {chosen.length > 0 && (
          <button className="library-import" onClick={() => onChange([])}>
            Clear
          </button>
        )}
        {actions}
      </div>
      {open && (
        <div className="check-filter-panel">
          {before}
          <ul className="check-filter-options" aria-label={name}>
            {options.map((option) => (
              <li key={option.id}>
                <label>
                  <input type="checkbox" aria-label={option.label} checked={chosen.includes(option.id)} onChange={() => toggle(option.id)} />
                  <span className="check-filter-label">{option.label}</span>
                  {option.count !== undefined && <span className="check-filter-count">{option.count}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {chosen.length > 0 && summary}
    </div>
  )
}
