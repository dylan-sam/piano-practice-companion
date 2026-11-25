// The key of each chorus with Practice > Keys: a fixed step (round the cycle of fourths, up a half
// step...) or random keys. Random keys adapted from OpenStand (keyOrder.ts, #124): the twelve keys
// in a shuffled order, the written key first, each key once per twelve choruses.

/** How the key moves from chorus to chorus: a step in semitones, or a seeded random order. */
export interface KeyPlan {
  keyStep?: number // semitones added to the key on each chorus (5 = round the cycle of fourths)
  randomKeys?: { seed: number } // the twelve keys in a random order, the same for the same seed
}

/** Transposition for each chorus, kept within -5..+6 so the band's register doesn't drift. */
export function chorusTranspose(transpose: number, keyStep: number, chorus: number): number {
  return ((((transpose + keyStep * chorus + 5) % 12) + 12) % 12) - 5
}

/** The next number of a small seeded generator (Mulberry32): the same seed gives the same keys everywhere. */
function nextUint32(state: { s: number }): number {
  state.s = (state.s + 0x6d2b79f5) | 0
  let t = Math.imul(state.s ^ (state.s >>> 15), 1 | state.s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return (t ^ (t >>> 14)) >>> 0
}

/** Shuffle a list in place (Fisher-Yates) with the seeded generator. */
function shuffle(items: number[], rng: { s: number }): number[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextUint32(rng) % (i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/**
 * One block of twelve choruses in random keys (semitones above the written key, 0..11, each once).
 * The first block starts in the written key; a later block never starts on the key the previous one ended in.
 */
function randomKeyBlock(seed: number, block: number, previousLast?: number): number[] {
  const rng = { s: (seed ^ Math.imul(block + 1, 0x9e3779b1)) | 0 }
  if (block === 0) return [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], rng)]
  const keys = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], rng)
  if (keys[0] === previousLast) {
    const swap = 1 + (nextUint32(rng) % 11)
    ;[keys[0], keys[swap]] = [keys[swap], keys[0]]
  }
  return keys
}

/** The transposition of a chorus (-5..+6 semitones) with a fixed key step or random keys. */
export function chorusKeyOffset(plan: KeyPlan, chorus: number, transpose = 0): number {
  if (!plan.randomKeys) return chorusTranspose(transpose, plan.keyStep ?? 0, chorus)
  const at = Math.max(0, Math.floor(chorus))
  let keys: number[] = []
  for (let block = 0; block <= Math.floor(at / 12); block++) keys = randomKeyBlock(plan.randomKeys.seed | 0, block, keys.at(-1))
  return chorusTranspose(transpose, keys[at % 12], 1)
}

/** A new seed for random keys: each time random keys are chosen, a new order. */
export function newRandomKeySeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}
