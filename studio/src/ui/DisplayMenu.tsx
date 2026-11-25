import { Popover } from './Popover'
import { SHEET_SCALES, setDisplay, stepSheetScale, useDisplay, useDisplayChanged } from './display'

/**
 * The chart display options: the sheet size, Roman numerals, how minor is written, % for a repeated
 * bar and the sheet auto-scroller. `roman` is false where numerals would give an answer away (Name the
 * progression); `autoScroll` is shown where a whole sheet is read (player and sightreader).
 */
export function DisplayOptions({ roman = true, autoScroll = false }: { roman?: boolean; autoScroll?: boolean }) {
  const display = useDisplay()
  return (
    <>
      <div className="share-option display-size">
        <span className="share-name" id="sheet-size-label">Sheet size</span>
        <div className="stepper" role="group" aria-labelledby="sheet-size-label">
          <button aria-label="Smaller sheet" disabled={display.sheetScale <= SHEET_SCALES[0]}
            onClick={() => setDisplay({ sheetScale: stepSheetScale(display.sheetScale, -1) })}>A−</button>
          <output className="stepper-value">{display.sheetScale}%</output>
          <button aria-label="Larger sheet" disabled={display.sheetScale >= SHEET_SCALES.at(-1)!}
            onClick={() => setDisplay({ sheetScale: stepSheetScale(display.sheetScale, 1) })}>A+</button>
        </div>
        <span className="share-desc">Draw the chords and the music smaller, to see more of a song, or larger, to read from further away.</span>
      </div>
      {roman && (
        <button className="share-option" aria-pressed={display.roman} onClick={() => setDisplay({ roman: !display.roman })}>
          <span className="share-name">Roman numerals {display.roman ? 'On' : 'Off'}</span>
          <span className="share-desc">Chords as degrees of the key in force (II−7 V7 IΔ7). The band still plays in the chosen key.</span>
        </button>
      )}
      <button className="share-option" aria-pressed={display.minor === 'm'}
        onClick={() => setDisplay({ minor: display.minor === 'm' ? '-' : 'm' })}>
        <span className="share-name">Minor written {display.minor === 'm' ? 'Cm' : 'C−'}</span>
        <span className="share-desc">Switch between a dash (C−7) and m (Cm7).</span>
      </button>
      <button className="share-option" aria-pressed={display.repeatSign} onClick={() => setDisplay({ repeatSign: !display.repeatSign })}>
        <span className="share-name">Repeat sign {display.repeatSign ? 'On' : 'Off'}</span>
        <span className="share-desc">Draw a bar with the same chords as the bar before as %.</span>
      </button>
      {autoScroll && (
        <button className="share-option" aria-pressed={display.autoScroll} onClick={() => setDisplay({ autoScroll: !display.autoScroll })}>
          <span className="share-name">Sheet auto-scroller {display.autoScroll ? 'On' : 'Off'}</span>
          <span className="share-desc">While playing, scroll a long sheet so the highlighted bar stays near the middle of the screen.</span>
        </button>
      )}
    </>
  )
}

/**
 * The Display button of a sheet-reading screen's top bar (player, sightreader), with the display
 * options; `autoScroll` is false where no sheet is read (the sightreader's infinite line).
 */
export function DisplayMenu({ roman = true, autoScroll = true }: { roman?: boolean; autoScroll?: boolean }) {
  const changed = useDisplayChanged(roman, autoScroll)
  return (
    <Popover id="chart-display" className="share" label="Display" title="Choose how chord charts are drawn" active={changed}>
      {() => (
        <div className="share-panel">
          <DisplayOptions roman={roman} autoScroll={autoScroll} />
        </div>
      )}
    </Popover>
  )
}
