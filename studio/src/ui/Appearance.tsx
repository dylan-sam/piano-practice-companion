// The home screen's Appearance panel: Dark mode, Light mode or a custom theme (its colours chosen
// one by one, starting from either mode), and the effects while playing turned on or off.

import { useState } from 'react'
import { Icon } from './Icon'
import { BUILT_IN, THEME_COLOURS, useTheme, type ThemeId, type ThemeMode } from './theme'
import { effectsOn, setEffectsOn } from './effects'
import { Popover } from './Popover'

const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'dark', label: 'Dark mode', hint: 'Night blue, amber and teal' },
  { id: 'light', label: 'Light mode', hint: 'Cream, coral and teal' },
  { id: 'custom', label: 'My colours', hint: 'Choose each colour' },
]

/** The Appearance button and its panel. */
export function Appearance() {
  const { theme, change } = useTheme()
  const [effects, setEffects] = useState(effectsOn)
  const colours = { ...BUILT_IN[theme.base], ...theme.colours }

  /** Choose a theme; a custom one starts from the mode shown. */
  const choose = (id: ThemeId) => {
    if (id === 'custom') change({ ...theme, id, base: theme.id === 'custom' ? theme.base : theme.id })
    else change({ ...theme, id })
  }

  return (
    <Popover id="appearance-panel" className="appearance" title="Theme and effects"
      label={<><Icon name="palette" /> Appearance</>}>
      {() => (
        <div className="appearance-panel">
          <span className="label">Theme</span>
          <div className="appearance-themes" role="radiogroup" aria-label="Theme">
            {THEMES.map((item) => (
              <button key={item.id} role="radio" aria-checked={theme.id === item.id} className={`appearance-theme appearance-theme-${item.id}`}
                onClick={() => choose(item.id)}>
                <span className="appearance-swatch" aria-hidden="true" />
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>
          {theme.id === 'custom' && <div className="appearance-custom">
            <label className="appearance-row">
              <span>Start from</span>
              <select value={theme.base} onChange={(e) => change({ ...theme, base: e.target.value as ThemeMode })}>
                <option value="dark">Dark mode</option>
                <option value="light">Light mode</option>
              </select>
            </label>
            {THEME_COLOURS.map((item) => (
              <label key={item.key} className="appearance-row">
                <span>{item.label}</span>
                <input type="color" value={colours[item.key]}
                  onChange={(e) => change({ ...theme, colours: { ...theme.colours, [item.key]: e.target.value } })} />
              </label>
            ))}
            <button className="chip" onClick={() => change({ ...theme, colours: {} })}>Reset my colours</button>
          </div>}
          <label className="check appearance-effects">
            <input type="checkbox" checked={effects} onChange={(e) => { setEffects(e.target.checked); setEffectsOn(e.target.checked) }} />
            Effects while playing: "Perfect" and "Good", and a burst of colour after a good chorus
          </label>
        </div>
      )}
    </Popover>
  )
}
