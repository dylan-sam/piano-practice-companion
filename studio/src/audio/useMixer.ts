// The band's mixer state, shared by every screen that plays the band (Studio, exercises).

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { CHANNELS, type Part } from '../engine/arrange'
import { loadJson, saveJson } from '../library/storage'
import type { Readiness } from '../ui/Transport'
import type { Player } from './player'

// Kept in the browser: levels depend on the speakers, not on the tune or the screen
const MASTER_KEY = 'eartraining:master-volume'
const VOLUMES_KEY = 'eartraining:part-volumes'
const CLICK_KEY = 'eartraining:click-on' // the metronome stays on or off from one screen to the next
const SYNC_KEY = 'eartraining:sync-ms' // the delay of the speakers or headphones (Bluetooth), in ms
/** The range of the Sync slider, in milliseconds. */
export const SYNC_RANGE = 300
/** The band's parts, and the band with a melody (lead sheets, melodies played or dictated). */
export const BAND_PARTS: Part[] = ['bass', 'comp', 'drums']
export const MELODY_PARTS: Part[] = ['bass', 'comp', 'melody', 'drums']
const DEFAULT_VOLUMES: Record<Part, number> = { bass: 110, comp: 85, melody: 100, click: 90, drums: 95 }
const UNMUTED: Record<Part, boolean> = { bass: false, comp: false, melody: false, click: false, drums: false }

// Whether a stored value is a valid Sync delay
const isSync = (v: unknown) => typeof v === 'number' && Math.abs(v) <= SYNC_RANGE
// Whether a stored value is an on/off setting
const isFlag = (v: unknown) => typeof v === 'boolean'
// Whether a stored value is a valid channel level
const isLevel = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 127
// Whether a stored value is a valid set of channel levels; a part saved before it existed is absent
const isVolumes = (v: unknown) =>
  typeof v === 'object' && v !== null &&
  (Object.keys(DEFAULT_VOLUMES) as Part[]).every((p) => (v as Record<string, unknown>)[p] === undefined || isLevel((v as Record<string, unknown>)[p]))

/** The label of the comp part, after the style's General MIDI program. */
export const compLabel = (program: number) => (program >= 24 && program <= 31 ? 'Guitar' : 'Piano')

/** The volume of each MIDI channel from the mixer's parts (0 for a muted part), for the player and the audio download. */
export function channelVolumes(volumes: Record<Part, number>, muted: Record<Part, boolean>): Record<number, number> {
  return Object.fromEntries((Object.keys(CHANNELS) as Part[]).map((part) => [CHANNELS[part], muted[part] ? 0 : volumes[part]]))
}

/**
 * Hold the part volumes, mutes and master volume, and apply them to the player once it is ready.
 * Returns the props of the Mixer popover, given the comp instrument's General MIDI program. A
 * lesson step may ask for some parts muted at first (`mutedAtFirst`).
 */
export function useMixer(playerRef: RefObject<Player | null>, readiness: Readiness, mutedAtFirst: readonly Part[] = []) {
  // Levels kept from an earlier visit; parts added since then start at their default
  const [volumes, setVolumes] = useState(() => ({ ...DEFAULT_VOLUMES, ...loadJson(VOLUMES_KEY, DEFAULT_VOLUMES, isVolumes) }))
  // A lesson step can open the screen with some parts muted
  // The metronome (Click) is muted until it is turned on, and stays as it was left
  const [muted, setMuted] = useState(() => ({ ...UNMUTED, click: !loadJson(CLICK_KEY, false, isFlag),
    ...Object.fromEntries(mutedAtFirst.map((part) => [part, true])) }))
  const [sync, setSync] = useState(() => loadJson(SYNC_KEY, 0, isSync))
  const [master, setMaster] = useState(() => loadJson(MASTER_KEY, 100, isLevel))
  const [masterMuted, setMasterMuted] = useState(false)
  const level = useCallback(() => playerRef.current?.level() ?? { peak: -100, rms: -100 }, [playerRef])

  useEffect(() => {
    saveJson(VOLUMES_KEY, volumes)
    const player = playerRef.current
    if (!player || readiness.kind !== 'ready') return
    for (const [channel, volume] of Object.entries(channelVolumes(volumes, muted))) player.setVolume(Number(channel), volume)
  }, [playerRef, volumes, muted, readiness.kind])

  useEffect(() => { saveJson(CLICK_KEY, !muted.click) }, [muted.click])

  // A positive Sync hears the band later: the highlight and the judging of your notes wait for it
  useEffect(() => {
    saveJson(SYNC_KEY, sync)
    playerRef.current?.setLatencyOffset(sync)
  }, [playerRef, sync, readiness.kind])

  useEffect(() => {
    saveJson(MASTER_KEY, master)
    playerRef.current?.setMasterVolume(masterMuted ? 0 : master)
  }, [playerRef, master, masterMuted, readiness.kind])

  return (compProgram: number) => ({
    labels: { bass: 'Bass', comp: compLabel(compProgram), melody: 'Melody', click: 'Click', drums: 'Drums' },
    volumes,
    muted,
    onVolume: (part: Part, v: number) => setVolumes((all) => ({ ...all, [part]: v })),
    onMute: (part: Part) => setMuted((all) => ({ ...all, [part]: !all[part] })),
    master,
    masterMuted,
    onMaster: setMaster,
    onMasterMute: () => setMasterMuted((m) => !m),
    sync,
    onSync: setSync,
    level,
  })
}
