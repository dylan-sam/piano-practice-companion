// The abcjs engraver (MIT, Paul Rosen and Gregory Dyke), downloaded with the first staff drawn:
// chord charts and menus never fetch it. Shared by the lead sheet and the lesson pages' staves.

export type Abcjs = typeof import('abcjs')
let abcjsLoad: Promise<Abcjs> | null = null

/** The engraver, fetched once. */
export const loadAbcjs = (): Promise<Abcjs> => (abcjsLoad ??= import('abcjs'))
