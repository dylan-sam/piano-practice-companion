import { describe, expect, test } from 'vitest'
import { arrange } from '../src/engine/arrange'
import { chartFromMeasures } from '../src/music/chart'
import { getStyle, STYLES } from '../src/styles'
import { copyLayer, labFromStyle, labId, normalizeLab, setBars, styleFromLab, styleSource } from '../src/styles/lab'
import type { StyleDefinition } from '../src/styles/types'

const tune = chartFromMeasures({ title: 'Lab', style: 'swing', key: 0, bpm: 120 }, [['D-7'], ['G7'], ['C^7'], ['C^7']])

// Reads the generated file back the way TypeScript would see the object
function evalSource(source: string): StyleDefinition {
  const literal = source.slice(source.indexOf('= ') + 2)
  return new Function(`return (${literal})`)() as StyleDefinition
}

describe('Pattern Creator', () => {
  test('a style survives the trip through the grid', () => {
    const bossa = getStyle('bossa-nova')
    const back = styleFromLab(labFromStyle(bossa))
    const hits = (s: StyleDefinition) => s.drums.grooves.middle[0].hits.map((h) => `${h[0]}:${h[1]}:${h[2]}`).sort()
    expect(hits(back)).toEqual(hits(bossa))
    expect(back.bass.mode === 'pattern' && back.bass.patterns['4']?.[0].map((n) => [n.at, n.tone])).toEqual(
      bossa.bass.mode === 'pattern' && bossa.bass.patterns['4']?.[0].map((n) => [n.at, n.tone]),
    )
    expect(back.comp.rhythms['4']?.[0].map((h) => h[0])).toEqual(bossa.comp.rhythms['4']?.[0].map((h) => h[0]))
  })

  test('hits that play only sometimes keep their chance', () => {
    const lab = labFromStyle(getStyle('swing'))
    expect(lab.drums.snare?.find(Boolean)).toMatchObject({ chance: 0.15 })
    const snare = styleFromLab(lab).drums.grooves.middle[0].hits.find((h) => h[1] === 'snare')
    expect(snare?.[3]).toBe(0.15)
  })

  test('every style can be opened in the lab and played', () => {
    for (const style of STYLES) {
      const lab = labFromStyle(style)
      expect(lab.beats, style.id).toBe(4)
      const { midi } = arrange(tune, styleFromLab(lab), 0, 2)
      expect(midi.length, style.id).toBeGreaterThan(100)
    }
  })

  test('the generated file reads back as the same style', () => {
    for (const style of STYLES) {
      const made = styleFromLab(labFromStyle(style))
      const source = styleSource(made, style.name)
      expect(source).toContain(`export const `)
      expect(evalSource(source), style.id).toEqual(made)
    }
  })

  test('names become ids', () => {
    const lab = { ...labFromStyle(getStyle('latin')), name: 'Çok Güzel  Samba!' }
    expect(labId(lab)).toBe('cok-guzel-samba')
    expect(labId({ ...lab, name: '   ' })).toBe('my-style')
  })

  test('a one-bar groove doubled repeats its first bar', () => {
    const lab = labFromStyle(getStyle('swing'))
    const two = setBars(lab, 2)
    expect(two.drums.ride).toHaveLength(32)
    expect(two.drums.ride?.slice(16)).toEqual(lab.drums.ride)
    expect(setBars(two, 1).drums.ride).toEqual(lab.drums.ride)
  })

  test('a second groove and a fill come in from a style and go back out', () => {
    for (const style of STYLES) {
      const { middle, last } = style.drums.grooves
      const lab = labFromStyle(style)
      const made = styleFromLab(lab)
      if (lab.drumsB) expect(made.drums.grooves.middle, style.id).toHaveLength(2)
      else expect(made.drums.grooves.middle, style.id).toHaveLength(1)
      if (lab.fill) {
        // Positions snap to sixteenths, so a triplet fill moves slightly; every hit is kept
        const hits = (h: { hits: unknown[][] }) => h.hits.map((x) => `${x[1]}:${x[2]}`).sort()
        expect(hits(made.drums.grooves.last![0]), style.id).toEqual(hits(last![0]))
      }
      if (middle.length > 1 && middle[1].bars === middle[0].bars) expect(lab.drumsB, style.id).toBeTruthy()
    }
  })

  test('variation B and the fill can be added, resized and removed', () => {
    const lab = labFromStyle(getStyle('straight pop/rock'))
    const withB = { ...lab, drumsB: copyLayer(lab.drums, 16), fill: copyLayer(lab.drums, 16) }
    const style = styleFromLab(withB)
    expect(style.drums.grooves.middle).toHaveLength(2)
    expect(style.drums.grooves.last?.[0].bars).toBe(1)
    const two = setBars(withB, 2)
    expect(two.drumsB?.kick).toHaveLength(32)
    expect(two.fill?.kick).toHaveLength(16)
    const plain = styleFromLab({ ...withB, drumsB: null, fill: null, fills: false })
    expect(plain.drums.grooves.middle).toHaveLength(1)
    expect(plain.drums.grooves.last).toBeUndefined()
    expect(plain.drums.grooves.first).toBeUndefined()
    // The top of each chorus gets a crash on one
    const first = styleFromLab({ ...withB, fills: true }).drums.grooves.first?.[0]
    expect(first?.hits).toContainEqual([0, 'crash', 100, 1, 2])
    const { midi } = arrange(tune, style, 0, 2)
    expect(midi.length).toBeGreaterThan(100)
  })

  test('without a bass pattern the bass walks', () => {
    const lab = labFromStyle(getStyle('bossa-nova'))
    const silent = { ...lab, bass: { walking: false, steps: lab.bass.steps.map(() => null) }, bassB: null }
    expect(styleFromLab(silent).bass.mode).toBe('walking')
  })

  test('a style from a link is checked and repaired', () => {
    for (const style of STYLES) {
      const lab = labFromStyle(style)
      expect(normalizeLab(JSON.parse(JSON.stringify(lab))), style.id).toEqual(lab)
    }
    expect(normalizeLab(null)).toBeNull()
    expect(normalizeLab('nonsense')).toBeNull()
    expect(normalizeLab({ base: 'no-such-style' })).toBeNull()

    const odd = normalizeLab({
      base: 'straight pop/rock',
      name: 'x'.repeat(500),
      swing: 9,
      beats: 7,
      bars: 5,
      drums: { kick: [{ vel: 900 }, 'junk', null], laser: [{ vel: 90 }], __proto__: [{ vel: 1 }] },
      bass: { steps: ['R', 'X', 3] },
      comp: [true, 'yes'],
    })!
    expect(odd.name).toHaveLength(60)
    expect(odd.swing).toBe(0.75)
    expect([odd.beats, odd.bars]).toEqual([4, 1])
    expect(Object.keys(odd.drums)).toEqual(['kick'])
    expect(odd.drums.kick?.slice(0, 3)).toEqual([{ vel: 127 }, null, null])
    expect(odd.drums.kick).toHaveLength(16)
    expect(odd.bass.steps.slice(0, 3)).toEqual(['R', null, null])
    expect(odd.comp.slice(0, 2)).toEqual([true, false])
    expect([odd.drumsB, odd.fill]).toEqual([null, null])
    const layered = normalizeLab({ base: 'straight pop/rock', drums: {}, drumsB: { snare: [null, { vel: 90 }] }, fill: { tomLow: 'x', crash: [{ vel: 100 }] } })!
    expect(layered.drumsB?.snare).toHaveLength(16)
    expect(Object.keys(layered.fill!)).toEqual(['crash'])
    expect(layered.fill?.crash).toHaveLength(16)
    expect(() => styleFromLab(odd)).not.toThrow()
  })
})

describe('style links', () => {
  test('a style survives a share link', async () => {
    globalThis.window ??= { location: { href: 'https://openstand.test/' } } as unknown as Window & typeof globalThis
    const { labFromHash, styleShareUrl } = await import('../src/formats/share')
    const lab = { ...labFromStyle(getStyle('latin')), name: 'Samba de Can' }
    const url = await styleShareUrl(lab)
    expect(url.length).toBeLessThan(2500)
    expect(await labFromHash(new URL(url).hash)).toEqual(lab)
    expect(await labFromHash('#style=garbage')).toBeNull()

    // With a tune to hear it on
    const { chartFromHash } = await import('../src/formats/share')
    const withTune = await styleShareUrl(lab, tune)
    expect(await labFromHash(new URL(withTune).hash)).toEqual(lab)
    expect((await chartFromHash(new URL(withTune).hash))?.title).toBe('Lab')
  })
})

describe('bass and chord variations', () => {
  test('a second bass pattern and comping rhythm are played in turn', () => {
    const lab = labFromStyle(getStyle('bossa-nova'))
    const steps = lab.bass.steps.slice()
    steps[14] = '5'
    const comp = lab.comp.map((on, i) => (i === 6 ? !on : on))
    const style = styleFromLab({ ...lab, bassB: steps, compB: comp })
    const patterns = style.bass.mode === 'pattern' ? style.bass.patterns['4'] : []
    expect(patterns).toHaveLength(2)
    expect(style.comp.rhythms['4']).toHaveLength(2)
    expect(arrange(tune, style, 0, 2).midi.length).toBeGreaterThan(100)
    // An empty variation is left out
    const empty = styleFromLab({ ...lab, bassB: steps.map(() => null), compB: comp.map(() => false) })
    expect(empty.bass.mode === 'pattern' && empty.bass.patterns['4']).toHaveLength(1)
    expect(empty.comp.rhythms['4']).toHaveLength(1)
  })

  test('styles with two patterns open with both, and links keep them', () => {
    for (const style of STYLES) {
      const lab = labFromStyle(style)
      const rhythms = style.comp.rhythms[String(lab.beats) as '3' | '4'] ?? []
      expect(!!lab.compB, style.id).toBe(rhythms.length > 1)
      expect(normalizeLab(JSON.parse(JSON.stringify(lab))), style.id).toEqual(lab)
    }
    const odd = normalizeLab({ base: 'straight pop/rock', drums: {}, bassB: ['R', 'X'], compB: [true, 'yes'] })!
    expect(odd.bassB?.slice(0, 2)).toEqual(['R', null])
    expect(odd.bassB).toHaveLength(16)
    expect(odd.compB?.slice(0, 2)).toEqual([true, false])
  })
})
