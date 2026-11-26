// The Listen buttons of a lesson page: a staff or a progression played on the app's piano. The
// sound engine is loaded the first time one is pressed (lesson pages open without it).

import type { Player } from '../audio/player'
import { loadAbcjs } from '../ui/abcjsLoad'

const QPM = 96 // the tempo examples are heard at, in quarter notes a minute

let playerLoad: Promise<Player> | null = null

/** The piano, made and loaded once. */
function piano(onProgress: (ratio: number) => void): Promise<Player> {
  playerLoad ??= import('../audio/player').then(async ({ Player }) => {
    const player = new Player()
    await player.init(onProgress)
    return player
  })
  playerLoad.catch(() => { playerLoad = null }) // a failed load is tried again next time
  return playerLoad
}

/** Play some ABC (a staff, a progression), moved by `transpose` semitones; a new one replaces the one playing. */
export async function listen(abc: string, transpose: number, onProgress: (ratio: number) => void = () => {}): Promise<void> {
  const [abcjs, player] = await Promise.all([loadAbcjs(), piano(onProgress)])
  const files = abcjs.synth.getMidiFile(abc, { midiOutputType: 'binary', chordsOff: true, midiTranspose: transpose, qpm: QPM }) as Uint8Array[]
  if (!files[0]) return
  player.stop()
  await player.play(files[0])
}

/** Stop what is playing (leaving the page). */
export function stopListening(): void {
  void playerLoad?.then((player) => player.stop())
}
