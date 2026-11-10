// Every screen opens without an error, on a computer and on phones held both ways, without a
// horizontal scroll bar.

import { expect, test } from '@playwright/test'
import { collectErrors, overflows } from './helpers'

const SCREENS = [
  '/', '/play-along', '/ear-training', '/sightreading',
  '/play-along/chords', '/play-along/lead-sheets',
  '/ear-training/name-the-progression', '/ear-training/melodic-dictation',
  '/sightreading/chords', '/sightreading/lead-sheets', '/sightreading/exercises', '/sightreading/licks',
]

const SIZES = [
  { name: 'computer', width: 1280, height: 860 },
  { name: 'phone portrait', width: 412, height: 900 },
  { name: 'phone landscape', width: 844, height: 390 },
]

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.name !== 'computer' })
    for (const path of SCREENS) {
      test(`${path} opens`, async ({ page }) => {
        const errors = collectErrors(page)
        await page.goto(path)
        await expect(page.locator('.topbar, .home').first()).toBeVisible()
        await page.waitForTimeout(1500)
        expect(await overflows(page)).toBe(false)
        expect(errors).toEqual([])
      })
    }
  })
}
