import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arrange, BASE_BPM } from './engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from './engine/pianoPatterns'
import { warmUpMidi } from './engine/warmup'
import { buildTimeline, chordStartBeat, chorusKeyOffset, type Timeline } from './engine/timeline'
import { useHear } from './audio/hear'
import { ChordHelperButton, ChordHelperPanel } from './ui/ChordHelper'
import { Substitutions } from './ui/Substitutions'
import { useChordHelper } from './ui/useChordHelper'
import { substituteChart } from './music/substitutions'
import { useSubstitutedChart } from './ui/useSubstitutedChart'
import { irealLink } from './formats/irealWrite'
import { reportError } from './errorReports'
import { chartFromHash, labFromHash, shareUrl, styleShareUrl } from './formats/share'
import { addTunes, loadTunes, saveTune } from './library/db'
import { CHORD_SOURCES, importByName, LEAD_SOURCES, type ImportTarget } from './library/importTunes'
import { addToPlaylist, addToPlaylistNamed, createPlaylist, deleteSongs, SHARED_PLAYLIST, showPlaylist } from './library/playlists'
import { fetchChocoTune } from './library/choco'
import { loadMyStyles, myStyleId, removeMyStyle, saveMyStyle } from './library/myStyles'
import { hasMelody, withoutMelody, type Chart as ChartData } from './music/chart'
import { offsetToKey, prettyNoteName } from './music/chords'
import { emptyChart } from './music/edit'
import { isSavedTune, STARTER, type Tune } from './music/songs'
import { loadBundledLeadSheets } from './library/bundled'
import { getStyle, STYLES, styleForChart, type StyleDefinition } from './styles'
import { labFromStyle, styleFromLab, styleSource, STEPS_PER_BEAT, type LabStyle } from './styles/lab'
import { Chart } from './ui/Chart'
import { Editor, EditorHeader } from './ui/Editor'
import { ImportDialog } from './ui/ImportDialog'
import { ExportPlaylists } from './ui/ExportPlaylists'
import { SaveToPlaylist } from './ui/SaveToPlaylist'
import { ManagePlaylists } from './ui/ManagePlaylists'
import { Library } from './ui/Library'
import { Mixer } from './ui/Mixer'
import { Popover } from './ui/Popover'
import { TopbarMenu } from './ui/TopbarMenu'
import { DisplayMenu } from './ui/DisplayMenu'
import { BPM_RANGE, changesKeys, chorusesForKeys, NO_PRACTICE, practiceChange, practiceOptions, rampedBpm, type PracticeSettings } from './music/practice'
import { Practice } from './ui/Practice'
import { StyleLab } from './ui/StyleLab'
import { useWindowKeys } from './ui/useWindowKeys'
import { Transport } from './ui/Transport'
import { handlePracticeShortcut, type PracticeShortcuts } from './ui/shortcuts'
import { Wordmark } from './ui/AppLink'
import type { Player } from './audio/player'
import { useHeardBeat, usePausedAt, usePlayer } from './audio/usePlayer'
import { channelVolumes, MELODY_PARTS, useMixer } from './audio/useMixer'
import { exportMidi, trackFilename } from './engine/exportTrack'
import { TrackDownloads } from './ui/TrackDownload'
import { useTrackDownload, type TrackSource } from './ui/useTrackDownload'
import { LeadSheet } from './ui/LeadSheet'
import { useBackClose } from './ui/backButton'
import { useDrawerScreen } from './ui/useNarrowScreen'
import { loadJson, saveJson } from './library/storage'

interface Position {
  measure: number // -1 during the count-in and the ending
  chorus: number
  beatInBar: number
  countIn: number // 1, 2, 3... during the count-in, otherwise 0
  ending: boolean
  barBeats: number
  barNumber: number // bars played since the start, -1 during the count-in
}

interface ArrangeOptions {
  styleId: string
  patternId: string | null
  transpose: number
  choruses: number
  practice: PracticeSettings
}

// The chart being edited, and the saved tune it came from (none for a new chart)
interface Draft {
  chart: ChartData
  from: Tune | null
}

// The mixer strips of a lead sheet, with the melody instrument
const MAX_CHORUSES = 24
// Keep a tempo inside the allowed range
const clampBpm = (v: number) => Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], v))
// Start a little before a chosen chord, so its notes on the beat sound
const START_LEAD_SECONDS = 0.02

// The comp instrument is named after the style's General MIDI program
const LAST_TUNE = 'eartraining:last-tune'

// The two players share the tune library: the chord player accompanies any chart (a lead sheet's
// melody is left out), the Lead Sheet Player plays the charts that have a melody, with it
export type PlayerMode = 'chords' | 'lead'
// Each player remembers its own last tune
const lastTuneKey = (mode: PlayerMode) => (mode === 'lead' ? `${LAST_TUNE}:lead` : LAST_TUNE)
const PLAYER_NAMES: Record<PlayerMode, { title: string; tag: string }> = {
  chords: { title: 'Chord Player', tag: 'Practice with a band in your browser' },
  lead: { title: 'Lead Sheet Player', tag: 'Read and hear the melody with the band' },
}
// Import formats of each player: iReal Pro charts have no melody, MusicXML lead sheets do
const NO_LEAD_SHEETS = 'No lead sheets yet. Import a MusicXML lead sheet or a Studio export with melodies (Import).'

// The style being made in the Pattern Creator is kept in the browser between visits
const LAB_KEY = 'eartraining:style-lab'
const LAB_STYLE = 'lab' // style id used while the lab is open

/** The style being made in the Pattern Creator, as last saved in the browser. */
function loadLab(): LabStyle | null {
  return loadJson<LabStyle | null>(LAB_KEY, null, (value) => typeof value === 'object')
}

// Greatest common divisor, for the choruses needed to go round the keys


// Where the playhead is at a beat: a count-in click, or a bar, beat and chorus
function positionAt(timeline: Timeline, beat: number): Position | null {
  if (beat < timeline.countIn) {
    const barBeats = timeline.countIn
    return { measure: -1, chorus: 0, beatInBar: beat, countIn: timeline.clicks.findLast((c) => c.at <= beat + 1e-6)?.count ?? 1, ending: false, barBeats, barNumber: -1 }
  }
  const barNumber = timeline.bars.findLastIndex((b) => b.start <= beat)
  const bar = timeline.bars[barNumber]
  if (!bar) return null
  const chorus = timeline.slots.findLast((s) => s.start <= beat)?.chorus ?? 0
  return {
    measure: bar.measure,
    chorus,
    beatInBar: beat - bar.start,
    countIn: 0,
    ending: bar.measure === -1,
    barBeats: bar.beats,
    barNumber,
  }
}

/** Run an accompaniment player (chords only, or lead sheets) and its local tune library. */
export default function App({ mode = 'chords' }: { mode?: PlayerMode }) {
  const leadMode = mode === 'lead'
  const playerRef = useRef<Player | null>(null)
  const timelineRef = useRef<Timeline | null>(null)

  const [tunes, setTunes] = useState<Tune[]>([])
  const [songId, setSongId] = useState(STARTER.id)
  const [styleId, setStyleId] = useState(styleForChart(STARTER.chart))
  const [patternId, setPatternId] = useState<string | null>(() => defaultPatternForStyle(styleForChart(STARTER.chart)))
  const styleRef = useRef(styleId)
  const [lab, setLabState] = useState<LabStyle | null>(null)
  const labRef = useRef<LabStyle | null>(null)
  const [labUndo, setLabUndo] = useState<LabStyle | null>(null)
  const [labCopy, setLabCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [labShare, setLabShare] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [labSaved, setLabSaved] = useState<'idle' | 'saved'>('idle')
  const [myStyles, setMyStylesState] = useState<LabStyle[]>(loadMyStyles)
  const myStylesRef = useRef(myStyles)
  const openSharedStyleRef = useRef<(lab: LabStyle) => void>(() => {})
  // Save the user's own styles and keep the ref used by playback in step
  const setMyStyles = (next: LabStyle[]) => {
    myStylesRef.current = next
    setMyStylesState(next)
  }
  useEffect(() => {
    styleRef.current = styleId
  }, [styleId])
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(STARTER.chart.bpm)
  const [importOpen, setImportOpen] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [choruses, setChoruses] = useState(3)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  // Where the band was paused: Play goes on from there
  const { pausedAt, mark: startMark, hold: holdPause, holdAt: holdStart, forget: forgetPause } = usePausedAt(playerRef)
  // Decode the sounds in the background, the style on screen first
  const readiness = usePlayer(
    playerRef,
    () => {
      setPlaying(false)
      setPosition(null)
      forgetPause()
    },
    () => {
      const first = getStyle(styleRef.current)
      return [first, ...STYLES.filter((s) => s !== first)].map(warmUpMidi)
    },
  )
  const mixer = useMixer(playerRef, readiness)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)
  const [picking, setPicking] = useState<null | 'first' | { from: number }>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editBar, setEditBar] = useState(0)
  const [irealState, setIrealState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saving, setSaving] = useState(false) // the Save dialog: which playlist a new song goes into
  const [managing, setManaging] = useState(false) // Edit Song's Manage playlists dialog

  // The tunes this player offers, and the chart as it plays it
  const shownTunes = useMemo(() => (leadMode ? tunes.filter((t) => hasMelody(t.chart)) : tunes), [tunes, leadMode])
  const tune = shownTunes.find((t) => t.id === songId) ?? shownTunes[0] ?? STARTER
  const tuneChart = useMemo(() => (leadMode ? tune.chart : withoutMelody(tune.chart)), [tune.chart, leadMode])
  const chart = draft?.chart ?? tuneChart
  // The Lead Sheet Player with nothing to play yet
  const empty = leadMode && !shownTunes.length && !draft
  // The lab's style is rebuilt from the grid each time it is needed
  // Saved styles are chosen as "my:<id>"
  const styleFor = (id: string, current: LabStyle | null, mine: LabStyle[]): StyleDefinition => {
    if (id === LAB_STYLE && current) return { ...styleFromLab(current), id }
    const saved = id.startsWith('my:') ? mine.find((m) => myStyleId(m) === id) : undefined
    return saved ? { ...styleFromLab(saved), id } : getStyle(id)
  }
  // Find a style by id among the built-in, Pattern Creator and saved styles
  const resolveStyle = (id: string) => styleFor(id, labRef.current, myStylesRef.current)
  const style = draft ? getStyle(draft.chart.style) : styleFor(styleId, lab, myStyles)
  const keyPc = (chart.key + transpose + 12) % 12
  // A chart with a melody is drawn as a lead sheet (the editor shows the chords only)
  const leadSheet = !draft && hasMelody(chart)
  // Where the band is, for the sheet's highlight
  const playhead = {
    activeMeasure: position && position.measure >= 0 ? position.measure : null,
    beatInBar: position?.beatInBar ?? 0,
    barBeats: position?.barBeats ?? 4,
  }

  // During practice the chorus decides the key on the stand and the tempo
  const chorus = position ? Math.min(position.chorus, choruses - 1) : 0
  const shownTranspose = playing ? chorusKeyOffset(practice, chorus, transpose) : transpose
  // The chord helper (tap a chord): its chords in the chorus playing (its key with Practice > Keys),
  // otherwise as the first chorus
  const keyPlan = useMemo(() => ({ keyStep: practice.keyStep, randomKeys: practice.randomKeys, subs: practice.subs }),
    [practice.keyStep, practice.randomKeys, practice.subs])
  // The sheet as the band plays it: the chorus playing (the first one when stopped), with its substitutions in a colour
  const shownChart = useSubstitutedChart(chart, practice.subs, playing, chorus)
  const chordHelper = useChordHelper({ chart, transpose, choruses, keyPlan, chorus: playing ? chorus : 0,
    sounding: position && position.measure >= 0 ? position : null })
  const closeChordHelper = chordHelper.close
  const liveBpm = rampedBpm(bpm, practice, playing ? chorus : 0, BPM_RANGE)

  // Tempo changes only the playback rate; the arrangement is not regenerated
  useEffect(() => {
    playerRef.current?.setRate(liveBpm / BASE_BPM)
  }, [liveBpm])

  // Arrange the chart with these options and start playing it from a time
  const start = async (opts: ArrangeOptions, fromSeconds = 0) => {
    const player = playerRef.current
    if (!player) return
    const { midi, timeline } = arrange(chart, resolveStyle(opts.styleId), opts.transpose, opts.choruses, practiceOptions(opts.practice), opts.patternId)
    timelineRef.current = timeline
    forgetPause()
    await player.play(midi, fromSeconds)
    player.setRate(liveBpm / BASE_BPM)
    setPlaying(true)
  }

  /** Stop the band; the next Play starts from the beginning. */
  const stop = useCallback(() => {
    playerRef.current?.stop()
    setPlaying(false)
    setPosition(null)
    forgetPause()
  }, [forgetPause])

  /** Pause the band where it is: the highlight stays, and Play goes on from there. */
  const pausePlayback = () => {
    holdPause()
    playerRef.current?.stop()
    setPlaying(false)
  }

  // Changing style, key or choruses while playing continues from the same spot with a new arrangement;
  // a new loop starts over
  const changeArrangement = (patch: Partial<ArrangeOptions>) => {
    const next = { styleId, patternId, transpose, choruses, practice, ...patch }
    setStyleId(next.styleId)
    setPatternId(next.patternId)
    setTranspose(next.transpose)
    setChoruses(next.choruses)
    setPractice(next.practice)
    const player = playerRef.current
    const loopChanged = String(next.practice.loop) !== String(practice.loop)
    if (playing && player) void start(next, loopChanged ? 0 : player.position)
    else if (loopChanged) stop() // a paused band starts the new loop from its beginning
  }

  // Change the practice settings, adding choruses when going round the keys needs more. A tempo
  // ramp only changes the tempo, so the band is not arranged again
  const changePractice = (next: PracticeSettings) => {
    if (practiceChange(practice, next) === 'tempo') {
      setPractice(next)
      return
    }
    changeArrangement({ practice: next, choruses: chorusesForKeys(practice, next, choruses) })
  }

  // Play, pause, or go on from where the band was paused
  const toggle = () => (playing ? pausePlayback() : void start({ styleId, patternId, transpose, choruses, practice }, pausedAt ?? 0))
  /** Play from the beginning. */
  const restart = () => void start({ styleId, patternId, transpose, choruses, practice }, 0)
  const shortcuts: PracticeShortcuts = {
    toggle: () => {
      if (readiness.kind === 'ready') toggle()
    },
    tempo: (delta) => setBpm((current) => clampBpm(current + delta)),
    transpose: (delta) => changeArrangement({ transpose: offsetToKey(chart.key, (keyPc + delta + 12) % 12) }),
    clearLoop: () => {
      setPicking(null)
      if (practice.loop) changePractice({ ...practice, loop: null })
    },
  }
  // Escape cancels loop picking; the practice shortcuts run on every key press
  const editing = draft !== null
  useWindowKeys((e) => {
    if (e.key === 'Escape') setPicking(null)
    handlePracticeShortcut(e, editing, shortcuts)
  })

  // Follow the audio clock to highlight the current bar
  useHeardBeat(playing, playerRef, (beat) => {
    const timeline = timelineRef.current
    if (timeline) setPosition(positionAt(timeline, beat))
  })

  const showTune = useCallback((next: Tune) => {
    playerRef.current?.stop()
    setPlaying(false)
    setPosition(null)
    forgetPause()
    setSongId(next.id)
    setStyleId(labRef.current ? LAB_STYLE : styleForChart(next.chart))
    setPatternId(labRef.current ? null : defaultPatternForStyle(styleForChart(next.chart)))
    setTranspose(0)
    setBpm(next.chart.bpm)
    setPractice((p) => ({ ...p, loop: null }))
    setPicking(null)
    closeChordHelper()
    setLibraryOpen(false)
    localStorage.setItem(lastTuneKey(mode), next.id)
  }, [mode, forgetPause, closeChordHelper])

  // Open a tune of the library
  const selectSong = (id: string) => {
    const next = tunes.find((t) => t.id === id)
    if (next) showTune(next)
  }

  // Load the saved library, then open a shared tune from the URL or the last tune played
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadTunes().catch((err: unknown) => {
        reportError(err, 'library')
        return [] as Tune[]
      })
      // Lead sheets served with the app (the licks and exercises are in Exercises Sightreading)
      const bundled = await loadBundledLeadSheets()
      let all = [...saved, ...bundled]
      const shared = await chartFromHash(window.location.hash)
      const sharedStyle = await labFromHash(window.location.hash)
      if (sharedStyle) openSharedStyleRef.current(sharedStyle)
      let open: Tune | undefined
      if (shared) {
        const [added] = await addTunes([shared], 'link')
        await addToPlaylistNamed(SHARED_PLAYLIST, [added])
        all = [...all.filter((t) => t.id !== added.id), added]
        open = added
        history.replaceState(null, '', window.location.pathname)
      } else {
        open = all.find((t) => t.id === localStorage.getItem(lastTuneKey(mode)))
      }
      // A catalog chart asked for in the address (chord player only: the catalog has no melodies)
      const requestedTrack = leadMode ? null : new URLSearchParams(window.location.search).get('track')
      if (requestedTrack) {
        try {
          const loaded = await fetchChocoTune(requestedTrack)
          all = [...all.filter((item) => item.id !== loaded.id), loaded]
          open = loaded
        } catch (error) {
          reportError(error, 'ChoCo score')
        }
      }
      if (cancelled) return
      setTunes(all)
      if (open) showTune(open)
    })()
    return () => {
      cancelled = true
    }
  }, [showTune, mode, leadMode])

  // A share link opened while the app is already open only changes the URL fragment
  useEffect(() => {
    // Open the tune and Pattern Creator style that a shared link carries
    const onHash = async () => {
      // A style link may carry a tune too; read both before the fragment is cleared
      const sharedStyle = await labFromHash(window.location.hash)
      const shared = await chartFromHash(window.location.hash)
      if (sharedStyle) openSharedStyleRef.current(sharedStyle)
      if (!shared) return
      const [added] = await addTunes([shared], 'link')
      await addToPlaylistNamed(SHARED_PLAYLIST, [added])
      setTunes((all) => [...all.filter((t) => t.id !== added.id), added])
      showTune(added)
      history.replaceState(null, '', window.location.pathname)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [showTune])

  /** Add imported tunes to the open library and select the first one. */
  const showAddedTunes = useCallback((added: Tune[]) => {
    if (!added.length) return
    const ids = new Set(added.map((tune) => tune.id))
    setTunes((all) => [...all.filter((tune) => !ids.has(tune.id)), ...added])
    // The Lead Sheet Player opens the first imported lead sheet
    const first = leadMode ? added.find((tune) => hasMelody(tune.chart)) : added[0]
    if (first) showTune(first)
  }, [showTune, leadMode])


  // The band's track to download, made with the settings of the moment it is asked for
  const trackDownload = useTrackDownload()
  const mixerNow = mixer(style.comp.program)
  const trackSource: TrackSource = {
    midi: () => exportMidi({ chart, style: resolveStyle(styleId), patternId, transpose, choruses, practice, bpm, muted: mixerNow.muted }),
    mix: () => ({ volumes: channelVolumes(mixerNow.volumes, mixerNow.muted), master: mixerNow.masterMuted ? 0 : mixerNow.master }),
    filename: (extension) => trackFilename(chart, transpose, bpm, extension),
  }


  // Load a ChoCo score from the catalog and open it
  const loadChoco = async (id: string) => {
    // Fetch one chart on demand; edits are saved as a new personal tune.
    const loaded = await fetchChocoTune(id)
    setTunes((all) => [...all.filter((item) => item.id !== loaded.id), loaded])
    showTune(loaded)
  }

  // Pasting an iReal Pro link anywhere outside a text field imports it
  useEffect(() => {
    // Import iReal Pro links pasted anywhere on the page
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea')) return
      const text = e.clipboardData?.getData('text') ?? ''
      if (!/irealb(ook)?:\/\//.test(text)) return
      e.preventDefault()
      void importByName('ireal', text).then(showAddedTunes)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [showAddedTunes])

  // Copy a text to the clipboard and show whether it worked
  const copy = async (text: () => Promise<string> | string, set: (s: 'idle' | 'copied' | 'failed') => void) => {
    try {
      await navigator.clipboard.writeText(await text())
      set('copied')
    } catch {
      set('failed')
    }
    setTimeout(() => set('idle'), 2200)
  }

  // ---- Pattern Creator ----

  const labTimer = useRef(0)
  const rearrangeRef = useRef(() => {})
  useEffect(() => {
    rearrangeRef.current = () => changeArrangement({})
  })

  // Change the Pattern Creator style and play with it
  const setLab = (next: LabStyle) => {
    labRef.current = next
    setLabState(next)
    saveJson(LAB_KEY, next)
    // While playing, the change is heard from the same spot; quick clicks are gathered into one update
    window.clearTimeout(labTimer.current)
    labTimer.current = window.setTimeout(() => rearrangeRef.current(), 120)
  }

  // Open the Pattern Creator, starting from the current style
  const openLab = () => {
    setLibraryOpen(false)
    setLab(loadLab() ?? labFromStyle(getStyle(styleId)))
    setStyleId(LAB_STYLE)
    setPatternId(null)
  }

  // Close the Pattern Creator and go back to the style used before
  function closeLab() {
    const current = labRef.current
    if (!current) return
    window.clearTimeout(labTimer.current)
    labRef.current = null
    setLabState(null)
    setLabUndo(null)
    changeArrangement({ styleId: current.base, patternId: defaultPatternForStyle(current.base) })
  }

  // A style link: the style is saved to My styles and opened in the lab
  useEffect(() => {
    openSharedStyleRef.current = (shared: LabStyle) => {
      setMyStyles(saveMyStyle(myStylesRef.current, shared))
      setLabUndo(null)
      setLab(shared)
      setStyleId(LAB_STYLE)
      setPatternId(null)
      history.replaceState(null, '', window.location.pathname)
    }
  })

  // The Pattern Creator grid step playing now, to highlight it (null outside the groove)
  const labStep = (() => {
    if (!lab || !position || position.countIn || position.ending) return null
    const groovebar = position.barNumber - (lab.fills ? 1 : 0)
    if (groovebar < 0) return null
    return Math.floor(((groovebar % lab.bars) * lab.beats + position.beatInBar) * STEPS_PER_BEAT)
  })()

  // ---- Editing ----

  const startEditing = (from: Tune | null) => {
    stop()
    closeLab()
    setPicking(null)
    setLibraryOpen(false)
    setDraft({ chart: from ? from.chart : emptyChart(), from })
    setEditBar(0)
  }

  /** Show a saved song and keep editing it (its playlists now managed, new edits saved again). */
  const keepEditing = (saved: Tune) => {
    setTunes((all) => [...all.filter((t) => t.id !== saved.id), saved])
    showTune(saved)
    setDraft({ chart: saved.chart, from: saved })
  }

  /** The chart being edited, with a title. */
  const draftChart = () => (draft ? { ...draft.chart, title: draft.chart.title.trim() || 'Untitled' } : null)

  /** Save the edits of one's own song in place (it stays in its playlists). */
  const saveDraft = async () => {
    const chart = draftChart()
    if (!chart || !draft?.from || !isSavedTune(draft.from)) return
    const saved = { ...draft.from, chart }
    await saveTune(saved)
    keepEditing(saved)
  }

  /**
   * Save the edits as a new song, into the playlist chosen in the Save dialog (asked first). The
   * new song is then the one being edited.
   */
  const saveDraftAsNew = async (target?: ImportTarget) => {
    const chart = draftChart()
    if (!chart) return
    if (!target) {
      setSaving(true) // ask where it goes first
      return
    }
    setSaving(false)
    const [saved] = await addTunes([chart], 'own')
    if ('playlist' in target) await addToPlaylist(target.playlist, [saved])
    showPlaylist('playlist' in target ? target.playlist : (await createPlaylist(target.newName, [saved])).id)
    keepEditing(saved)
  }

  // Delete the song being edited for good (a saved one erased, a shipped or ChoCo one hidden; out of every playlist) and show another
  const deleteDraftTune = async () => {
    if (!draft?.from) return
    const erased = await deleteSongs([draft.from])
    setTunes((all) => all.filter((t) => !erased.includes(t.id)))
    setDraft(null)
    showTune(shownTunes.find((item) => item.id !== draft.from?.id) ?? STARTER)
  }

  // ---- The chord helper: tap a chord (a bar of a lead sheet) to see its scales ----

  const hear = useHear(playerRef, readiness.kind === 'ready')

  // ---- Start from a chord: the chord helper's Start from here, while the band is stopped or paused ----

  /**
   * Make a written chord the start point: Play then starts the band there, without a count-in, and
   * the chord is marked; asking again for the same chord clears it (Play starts from the beginning).
   */
  const startFromChord = (measure: number, chordIndex: number) => {
    const mark = `${measure}:${chordIndex}`
    const timeline = buildTimeline(chart, transpose, choruses, practiceOptions(practice))
    // The chord is counted in the first chorus's chart, as drawn (a substitution can split a chord)
    const beat = chordStartBeat(timeline, substituteChart(chart, practice.subs, 0), measure, chordIndex)
    if (beat === null || mark === startMark) {
      forgetPause()
      setPosition(null)
      return
    }
    // A hair early, so the chord's first notes, written on the beat, are played
    holdStart(Math.max(0, beat * 60 / BASE_BPM - START_LEAD_SECONDS), mark)
    setPosition(positionAt(timeline, beat))
  }

  // ---- Loop picking: tap the first bar, then the last ----

  const pickBar = (index: number) => {
    if (picking === 'first') setPicking({ from: index })
    else if (picking) {
      setPicking(null)
      const from = picking.from
      changePractice({ ...practice, loop: [Math.min(from, index), Math.max(from, index)] })
    }
  }

  const loopLabel = practice.loop
    ? practice.loop[0] === practice.loop[1]
      ? `Bar ${practice.loop[0] + 1}`
      : `Bars ${practice.loop[0] + 1}–${practice.loop[1] + 1}`
    : null

  // The transport readout: loop-picking hints, or the position with the chorus key and tempo
  const readout = (() => {
    if (picking) return picking === 'first' ? 'Tap the first bar of the loop' : 'Now tap the last bar'
    const extras = [
      changesKeys(practice) && position && !position.countIn ? `in\u00a0${prettyNoteName((chart.key + shownTranspose + 12) % 12)}` : '',
      practice.ramp && position ? `${liveBpm}\u00a0bpm` : '',
    ]
      .filter(Boolean)
      .join('  ')
    if (!position) return `${loopLabel ?? `${chart.bars.filter((b) => !b.spacer).length} bars`} × ${choruses}`
    if (position.countIn) return `Count-in  ${position.countIn}`
    if (position.ending) return 'Ending'
    if (startMark && !playing) return `Start from Bar\u00a0${position.measure + 1}`
    // Non-breaking spaces keep each part on one line when the readout wraps on phones
    return `Chorus\u00a0${position.chorus + 1}/${choruses}  Bar\u00a0${position.measure + 1}${extras ? `  ${extras}` : ''}`
  })()

  // The Android back button closes, the last opened first: the tune drawer, the editor (without
  // saving), the Pattern Creator and loop picking (menus and dialogs register themselves)
  const drawer = useDrawerScreen()
  useBackClose(drawer && libraryOpen, () => setLibraryOpen(false))
  useBackClose(draft !== null, () => setDraft(null))
  useBackClose(lab !== null, closeLab)
  useBackClose(picking !== null, () => setPicking(null))

  return (
    <div className="app">
      <header className="topbar">
        <Wordmark>{PLAYER_NAMES[mode].title}</Wordmark>
        <span className="topbar-tag">{PLAYER_NAMES[mode].tag}</span>
        <span className="topbar-spacer" />
        {!editing && !empty && (
          <TopbarMenu active={!!lab}>
            <button
              className="topbar-button"
              aria-pressed={!!lab}
              onClick={() => (lab ? closeLab() : openLab())}
              title="Make your own style: edit the drums, bass and chords and hear them as you go"
            >
              Pattern Creator
            </button>
            <DisplayMenu />
            <button className="topbar-button" onClick={() => startEditing(tune)} title="Edit this chart">
              Edit Song
            </button>
            <Popover id="share" className="share" label="Share">
              {() => (
                <div className="share-panel">
                  <button className="share-option" onClick={() => void copy(() => shareUrl(chart), setShareState)}>
                    <span className="share-name">
                      {shareState === 'copied' ? 'Link copied' : shareState === 'failed' ? 'Copy failed' : 'Copy Studio link'}
                    </span>
                    <span className="share-desc">Opens this chart in Studio. Nothing is uploaded.</span>
                  </button>
                  <button className="share-option" onClick={() => void copy(() => irealLink([chart]), setIrealState)}>
                    <span className="share-name">
                      {irealState === 'copied' ? 'Link copied' : irealState === 'failed' ? 'Copy failed' : 'Copy iReal Pro link'}
                    </span>
                    <span className="share-desc">An irealb:// link that opens in iReal Pro.</span>
                  </button>
                </div>
              )}
            </Popover>
            <Popover id="export-playlists" className="share" label="Export">
              {(close) => (
                <div className="share-panel">
                  <ExportPlaylists tunes={tunes} onDone={close} />
                  <TrackDownloads download={trackDownload} source={trackSource} />
                </div>
              )}
            </Popover>
          </TopbarMenu>
        )}
        <button className="tunes-toggle" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>
          Songs
        </button>
        <a className="topbar-link" href={`${import.meta.env.BASE_URL}source.zip`} title="Download Studio source and license">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="topbar-link-text">Source</span>
        </a>
      </header>

      <div className={libraryOpen ? 'workspace library-open' : 'workspace'}>
        <Library
          tunes={shownTunes}
          selectedId={tune.id}
          onSelect={selectSong}
          onLoadChoco={leadMode ? undefined : loadChoco}
          onImport={() => setImportOpen(true)}
          onNew={leadMode ? undefined : () => startEditing(null)}
          emptyText={leadMode ? NO_LEAD_SHEETS : undefined}
          disabled={editing}
          onTunesDeleted={(ids) => setTunes((all) => all.filter((t) => !ids.includes(t.id)))}
        />

        <main
          className={['stage', editing && 'stage-editing', picking && 'stage-picking'].filter(Boolean).join(' ')}
          onClick={() => setLibraryOpen(false)}
        >
          {empty ? (
            <article className="sheet lead-empty" aria-label="No lead sheets">
              <h1 className="sheet-title">Lead Sheet Player</h1>
              <p>
                Lead sheets are charts with a melody: the band plays the chords and the melody is played and drawn on a
                staff. The song catalog has chords only, so import lead sheets: a MusicXML file (from MuseScore, or a scan read by Audiveris) or a Studio export.
              </p>
              <button className="button button-primary" onClick={() => setImportOpen(true)}>Import lead sheets</button>
            </article>
          ) : leadSheet ? (
            <LeadSheet
              chart={shownChart}
              style={style}
              transpose={shownTranspose}
              {...playhead}
              range={picking && picking !== 'first' ? [picking.from, picking.from] : practice.loop}
              onBarClick={picking ? pickBar : chordHelper.open}
              autoScroll={playing}
            />
          ) : (
            <Chart
              chart={draft ? chart : shownChart}
              style={style}
              transpose={draft ? 0 : shownTranspose}
              {...playhead}
              range={picking && picking !== 'first' ? [picking.from, picking.from] : draft ? null : practice.loop}
              selectedBar={draft ? editBar : null}
              onBarClick={draft ? setEditBar : picking ? pickBar : chordHelper.open}
              startAt={draft || playing ? null : startMark}
              autoScroll={playing && !draft}
              header={draft ? <EditorHeader chart={draft.chart} onChange={(c) => setDraft({ ...draft, chart: c })} /> : undefined}
            />
          )}
        </main>
      </div>

      {draft ? (
        <Editor
          chart={draft.chart}
          onChange={(c) => setDraft({ ...draft, chart: c })}
          selected={editBar}
          onSelect={setEditBar}
          edited={!draft.from || draft.chart !== draft.from.chart}
          canSaveInPlace={!!draft.from && isSavedTune(draft.from)}
          canDelete={!!draft.from && draft.from.id !== STARTER.id}
          onSave={() => void saveDraft()}
          onSaveNew={() => void saveDraftAsNew()}
          onManage={draft.from && draft.from.id !== STARTER.id ? () => setManaging(true) : undefined}
          onCancel={() => setDraft(null)}
          onDelete={() => void deleteDraftTune()}
        />
      ) : (
      <>
      {lab && (
        <StyleLab
          lab={lab}
          onChange={(next) => {
            setLab(next)
            setLabUndo(null)
          }}
          onStartFrom={(id) => {
            setLabUndo(lab)
            const saved = myStyles.find((m) => myStyleId(m) === id)
            setLab(saved ?? labFromStyle(getStyle(id)))
          }}
          myStyles={myStyles.map((m) => ({ id: myStyleId(m), name: m.name }))}
          isSaved={myStyles.some((m) => myStyleId(m) === myStyleId(lab))}
          onSave={() => {
            setMyStyles(saveMyStyle(myStyles, lab))
            setLabSaved('saved')
            setTimeout(() => setLabSaved('idle'), 2200)
          }}
          saveState={labSaved}
          onShare={() => void copy(() => styleShareUrl(lab, chart), setLabShare)}
          shareState={labShare}
          onDelete={() => {
            const id = myStyleId(lab)
            setMyStyles(removeMyStyle(myStyles, id))
            if (styleId === id) changeArrangement({ styleId: LAB_STYLE, patternId: null })
          }}
          canUndo={labUndo !== null}
          onUndo={() => {
            if (labUndo) setLab(labUndo)
            setLabUndo(null)
          }}
          step={playing ? labStep : null}
          onCopy={() => void copy(() => styleSource(styleFromLab(lab), getStyle(lab.base).name), setLabCopy)}
          copyState={labCopy}
          onClose={closeLab}
        />
      )}
      {!empty && <Transport
        readiness={readiness}
        playing={playing}
        onToggle={toggle}
        paused={pausedAt !== null}
        onRestart={restart}
        position={readout}
        styleId={styleId}
        pianoPatternId={patternId}
        pianoPatterns={patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS}
        onPianoPattern={(id) => changeArrangement({ patternId: id })}
        extraStyles={[
          ...(lab ? [{ id: LAB_STYLE, name: `${lab.name.trim() || 'My style'} (Pattern Creator)` }] : []),
          ...myStyles.map((m) => ({ id: myStyleId(m), name: m.name })),
        ]}
        onStyle={(id) => {
          setBpm(resolveStyle(id).tempo.default)
          changeArrangement({ styleId: id, patternId: defaultPatternForStyle(id) })
        }}
        keyPc={keyPc}
        onKey={(pc) => changeArrangement({ transpose: offsetToKey(chart.key, pc) })}
        bpm={bpm}
        bpmRange={BPM_RANGE}
        onBpm={setBpm}
        choruses={choruses}
        maxChoruses={MAX_CHORUSES}
        onChoruses={(n) => changeArrangement({ choruses: n })}
      >
        <ChordHelperButton helper={chordHelper} />
        <Practice chart={chart} settings={practice} onChange={changePractice} onPickLoop={() => setPicking('first')} />
        <Substitutions practice={practice} onChange={changePractice} />
        <Mixer {...mixerNow} parts={leadSheet ? MELODY_PARTS : undefined} />
      </Transport>}
      {!draft && <ChordHelperPanel helper={chordHelper} onHear={hear}
        actions={playing ? undefined : ({ measure, chordIndex }) => (
          <button className="button" onClick={() => { startFromChord(measure, chordIndex); chordHelper.close() }}>
            {startMark === `${measure}:${chordIndex}` ? 'Start from the beginning again' : 'Start the band from here'}
          </button>
        )} />}
      </>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)}
        sources={leadMode ? LEAD_SOURCES : CHORD_SOURCES} onImported={showAddedTunes} />
      <SaveToPlaylist open={saving} title={draft?.chart.title.trim() || 'Untitled'}
        onSave={(target) => void saveDraftAsNew(target)} onCancel={() => setSaving(false)} />
      <ManagePlaylists song={managing && draft?.from ? draft.from : null} onClose={() => setManaging(false)}
        onDeleted={(ids) => setTunes((all) => all.filter((t) => !ids.includes(t.id)))} />
    </div>
  )
}
