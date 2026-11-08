// Share links: the whole chart travels in the URL fragment, compressed.
// No server is involved, and the fragment is never sent to one.

import { isChart, type Chart } from '../music/chart'
import { normalizeLab, type LabStyle } from '../styles/lab'

const PARAM = 'tune'
const STYLE_PARAM = 'style'

// Encode bytes as URL-safe base64
function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Decode URL-safe base64 into bytes
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

// Run bytes through a compression or decompression stream
async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

// Compress a value's JSON into URL-safe text
async function encodeJson(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

// Read a value back from compressed URL-safe text
async function decodeJson(value: string): Promise<unknown> {
  try {
    const json = await pipe(fromBase64Url(value), new DecompressionStream('deflate-raw'))
    return JSON.parse(new TextDecoder().decode(json))
  } catch {
    return null
  }
}

// Compress a chart into URL-safe text
export const encodeChart = (chart: Chart) => encodeJson(chart)

/** Decode a shared chart only when its playable structure is valid. */
export async function decodeChart(value: string): Promise<Chart | null> {
  const chart = await decodeJson(value)
  return isChart(chart) ? chart : null
}

// A link to the app carrying these hash parameters
function linkWith(params: Record<string, string>): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return url.toString()
}

// A parameter of a link's hash
const fromHash = (hash: string, param: string) => new URLSearchParams(hash.replace(/^#/, '')).get(param)

// A link that opens this chart
export async function shareUrl(chart: Chart): Promise<string> {
  return linkWith({ [PARAM]: await encodeChart(chart) })
}

// The chart a link's hash carries, or null
export async function chartFromHash(hash: string): Promise<Chart | null> {
  const value = fromHash(hash, PARAM)
  return value ? decodeChart(value) : null
}

// A style made in the style lab travels the same way, with a tune to hear it on
export async function styleShareUrl(lab: LabStyle, chart?: Chart): Promise<string> {
  return linkWith({ [STYLE_PARAM]: await encodeJson(lab), ...(chart ? { [PARAM]: await encodeChart(chart) } : {}) })
}

// The Style lab style a link's hash carries, or null
export async function labFromHash(hash: string): Promise<LabStyle | null> {
  const value = fromHash(hash, STYLE_PARAM)
  return value ? normalizeLab(await decodeJson(value)) : null
}
