// The worker that renders the audio download off the page (exportAudio.ts), so the app stays
// responsive on phones. One render per worker: the page ends the worker to cancel.

import { synthesize, type SynthRequest } from './synthesize'

/** Messages from the worker: progress, the rendered samples, or an error. */
export type SynthReply =
  | { type: 'progress'; ratio: number }
  | { type: 'done'; left: Float32Array; right: Float32Array }
  | { type: 'error'; message: string }

/** Post a reply to the page, handing over the samples' memory instead of copying it. */
function reply(message: SynthReply, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer })
}

self.addEventListener('message', (event: MessageEvent<SynthRequest>) => {
  synthesize(event.data, (ratio) => reply({ type: 'progress', ratio })).then(
    ({ left, right }) => reply({ type: 'done', left, right }, [left.buffer, right.buffer]),
    (error: unknown) => reply({ type: 'error', message: error instanceof Error ? error.message : String(error) }),
  )
})
