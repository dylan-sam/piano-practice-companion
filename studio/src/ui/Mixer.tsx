import { useEffect, useRef } from 'react'
import type { Part } from '../engine/arrange'
import { BAND_PARTS, SYNC_RANGE } from '../audio/useMixer'
import { Popover } from './Popover'

interface MixerProps {
  parts?: Part[] // omit an instrument that is not part of this exercise
  labels: Record<Part, string>
  volumes: Record<Part, number>
  muted: Record<Part, boolean>
  onVolume: (part: Part, volume: number) => void
  onMute: (part: Part) => void
  master: number
  masterMuted: boolean
  onMaster: (volume: number) => void
  onMasterMute: () => void
  sync: number // the output's extra delay in milliseconds (Bluetooth speakers or headphones)
  onSync: (ms: number) => void
  level: () => { peak: number; rms: number } // output level in dBFS
}


/** Mix the instrument parts offered by the current screen, the metronome (Click, muted until turned on) and the Sync. */
export function Mixer({ parts = BAND_PARTS, labels, volumes, muted, onVolume, onMute, master, masterMuted, onMaster, onMasterMute,
  sync, onSync, level }: MixerProps) {
  const strips: Part[] = [...parts, 'click']
  return (
    <Popover
      id="mixer"
      className="band"
      active={parts.some((p) => muted[p]) || masterMuted || !muted.click || sync !== 0}
      label={
        <>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 2v12M8 2v12M13 2v12" />
            <path d="M1.5 10h3M6.5 5h3M11.5 8h3" strokeWidth="2.4" />
          </svg>
          Mixer
        </>
      }
    >
      {() => (
        <div className="mixer" aria-label="Mixer">
          {strips.map((part) => (
            <div key={part} className={`strip${muted[part] ? ' strip-muted' : ''}`}>
              <span className="label">{labels[part]}</span>
              <input
                className="fader"
                type="range"
                min={0}
                max={127}
                value={volumes[part]}
                aria-label={`${labels[part]} volume`}
                onChange={(e) => onVolume(part, Number(e.target.value))}
              />
              <span className="strip-value">{volumes[part]}</span>
              <button className="mute" aria-pressed={muted[part]} onClick={() => onMute(part)}>
                Mute
              </button>
            </div>
          ))}
          <span className="mixer-divider" aria-hidden="true" />
          <div className={`strip strip-master${masterMuted ? ' strip-muted' : ''}`}>
            <span className="label">Master</span>
            <div className="master-controls">
              <input
                className="fader"
                type="range"
                min={0}
                max={127}
                value={master}
                aria-label="Master volume"
                onChange={(e) => onMaster(Number(e.target.value))}
              />
              <Meter level={level} />
            </div>
            <span className="strip-value">{master}</span>
            <button className="mute" aria-pressed={masterMuted} onClick={onMasterMute}>
              Mute
            </button>
          </div>
          {/* Speakers or headphones that are late (Bluetooth): the highlight and the judging wait for them */}
          <div className="mixer-sync">
            <label className="label" htmlFor="mixer-sync">Sync</label>
            <input id="mixer-sync" className="sync-slider" type="range" min={-SYNC_RANGE} max={SYNC_RANGE} step={10}
              value={sync} onChange={(e) => onSync(Number(e.target.value))} />
            <output className="strip-value" htmlFor="mixer-sync">{sync > 0 ? `+${sync}` : sync} ms</output>
            <button className="mute" disabled={sync === 0} onClick={() => onSync(0)}>Reset</button>
            <p className="mixer-sync-help">If the band sounds late through Bluetooth speakers or headphones, move it right until
              the highlight and your notes line up with what you hear.</p>
          </div>
        </div>
      )}
    </Popover>
  )
}

const FLOOR = -48 // dBFS at the bottom of the meter
// Height of a level meter for a level in decibels
const toHeight = (db: number) => `${Math.max(0, Math.min(1, (db - FLOOR) / -FLOOR)) * 100}%`

// Output level: the bar is the average level, the line the recent peak (held, then falling).
// It turns red when the peak comes within 1 dB of full scale.
function Meter({ level }: { level: MixerProps['level'] }) {
  const bar = useRef<HTMLSpanElement>(null)
  const peak = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let frame = 0
    let held = -100
    let heldAt = 0
    // Update the level meters and their held peak on each animation frame
    const tick = (now: number) => {
      const { peak: p, rms } = level()
      if (p >= held) {
        held = p
        heldAt = now
      } else if (now - heldAt > 800) {
        held = Math.max(p, held - 0.4) // after a moment the peak line falls back
      }
      if (bar.current) bar.current.style.height = toHeight(rms)
      if (peak.current) {
        peak.current.style.bottom = toHeight(held)
        peak.current.dataset.hot = String(held > -1)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [level])

  return (
    <span className="meter" role="img" aria-label="Output level">
      <span className="meter-bar" ref={bar} />
      <span className="meter-peak" ref={peak} />
    </span>
  )
}
