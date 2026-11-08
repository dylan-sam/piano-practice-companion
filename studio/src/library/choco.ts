import { loadChart } from './catalog'
import type { Tune } from '../music/songs'

/** Fetch one keyed ChoCo score and present it as a temporary tune. */
export async function fetchChocoTune(id: string): Promise<Tune> {
  const chart = await loadChart(id)
  return { id: `choco:${id}`, chart, source: 'choco', playlist: 'ChoCo', addedAt: Date.now() }
}
