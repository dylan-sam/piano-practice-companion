import { describe, expect, it } from 'vitest'
import { versionToOpen } from '../src/library/scoreSearch'

describe('ChoCo song versions', () => {
  // A song whose filtered list offers only its Wikifonia version
  const filtered = { id: 'wikifonia_1', versions: [{ id: 'wikifonia_1' }] } as Parameters<typeof versionToOpen>[0]

  it('opens a version picked earlier only while the filter still offers it', () => {
    expect(versionToOpen(filtered, 'ireal-pro_9')).toBe('wikifonia_1')
    expect(versionToOpen(filtered, 'wikifonia_1')).toBe('wikifonia_1')
    expect(versionToOpen(filtered, undefined)).toBe('wikifonia_1')
  })
})
