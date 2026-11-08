import { describe, expect, it } from 'vitest'
import { closeLastMenu, registerBackClose } from '../src/ui/backButton'

describe('back button', () => {
  it('closes the last opened menu first, then the one before', () => {
    const closed: string[] = []
    registerBackClose(() => closed.push('settings'))
    registerBackClose(() => closed.push('mixer'))
    expect(closeLastMenu()).toBe(true)
    expect(closed).toEqual(['mixer'])
    expect(closeLastMenu()).toBe(true)
    expect(closed).toEqual(['mixer', 'settings'])
    expect(closeLastMenu()).toBe(false)
  })

  it('forgets a menu closed by other means', () => {
    const closed: string[] = []
    registerBackClose(() => closed.push('display'))
    const remove = registerBackClose(() => closed.push('share'))
    remove() // closed with its own button
    expect(closeLastMenu()).toBe(true)
    expect(closed).toEqual(['display'])
    expect(closeLastMenu()).toBe(false)
  })
})
