import { describe, expect, test } from 'vitest'
import { appKeys } from '../src/library/resetData'

describe('Delete all my data', () => {
  test("only the app's keys are deleted", () => {
    const keys = ['eartraining:lick-reading', 'openstand.display', 'openstand:my-styles', 'other-site', 'eartraining:lessons:progress']
    const storage = { length: keys.length, key: (i: number) => keys[i] ?? null }
    expect(appKeys(storage)).toEqual(['eartraining:lick-reading', 'openstand.display', 'openstand:my-styles', 'eartraining:lessons:progress'])
  })
})
