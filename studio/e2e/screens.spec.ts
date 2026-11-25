// Every screen opens without an error, on a computer and on phones held both ways, without a
// horizontal scroll bar.

import { expect, test } from '@playwright/test'
import { collectErrors, overflows } from './helpers'

const SCREENS = [
  '/', '/play-along', '/ear-training', '/sightreading',
  '/play-along/chords', '/play-along/lead-sheets',
  '/ear-training/name-the-progression', '/ear-training/melodic-dictation',
  '/sightreading/chords', '/sightreading/lead-sheets', '/sightreading/exercises', '/sightreading/licks',
  '/improvisation', '/improvisation/free', '/lessons',
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

// A- / A+ in the Display menu zoom the chart's bars, on a phone too, without a horizontal scroll bar
for (const size of SIZES) {
  test(`the sheet size of the Display menu (${size.name})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    const errors = collectErrors(page)
    await page.goto('/play-along/chords')
    const rows = page.locator('.sheet .rows')
    await expect(rows).toBeVisible()
    const before = (await rows.boundingBox())!.height
    // On a phone held upright, Display is in the More menu
    const more = page.getByRole('button', { name: 'More', exact: true }).first()
    if (await more.isVisible()) await more.click()
    await page.getByRole('button', { name: 'Display' }).click()
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Larger sheet' }).click()
    await expect(page.getByText('130%')).toBeVisible()
    expect((await rows.boundingBox())!.height).toBeGreaterThan(before * 1.2)
    expect(await overflows(page)).toBe(false)
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Smaller sheet' }).click()
    await expect(page.getByText('100%')).toBeVisible()
    expect(errors).toEqual([])
  })
}

// The crash catch: a screen whose code cannot be downloaded (offline after an update) shows a
// message with Reload instead of a blank page, and Reload brings the screen back
test('a screen that fails shows Reload instead of a blank page', async ({ page }) => {
  let block = true
  await page.route(/\/assets\/App-[^/]+\.js$/, (route) => (block ? route.abort() : route.continue()))
  await page.goto('/play-along/chords')
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
  block = false
  await page.getByRole('button', { name: 'Reload' }).click()
  await expect(page.locator('.sheet .bar').first()).toBeVisible({ timeout: 30_000 })
})

// The bottom bar fits every desktop width: below 1760 px its controls, Chords, Practice and Substitutions move
// into the Settings panel, as on tablets; the Chords button there closes the panel and opens the helper
for (const width of [1101, 1280, 1759, 1760]) {
  test(`the bottom bar fits a ${width} px wide window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/play-along/chords')
    await expect(page.locator('.sheet .bar').first()).toBeVisible()
    const [scroll, client] = await page.locator('.transport').evaluate((el) => [el.scrollWidth, el.clientWidth])
    expect(scroll).toBeLessThanOrEqual(client)
    const settings = page.getByRole('button', { name: 'Settings' })
    if (width < 1760) {
      await settings.click()
      await page.getByRole('button', { name: 'Chords', exact: true }).click()
      await expect(page.locator('.settings-sheet')).toHaveCount(0)
      await expect(page.getByRole('complementary', { name: 'Chord helper' })).toBeInViewport()
    } else {
      await expect(settings).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Mixer' })).toBeInViewport()
    }
  })
}

// A sightreading screen's bar has four buttons too (Scoring, Practice, Substitutions, Mixer): at 1760 px
// its controls stay on one line
test('the bottom bar of Lead Sheet Sightreading fits a 1760 px wide window on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1760, height: 800 })
  await page.goto('/sightreading/lead-sheets?song=Avalon')
  await expect(page.getByRole('button', { name: 'Substitutions' })).toBeInViewport({ timeout: 30_000 })
  const controls = (await page.locator('.transport .controls').boundingBox())!
  expect(controls.height).toBeLessThan(60)
  const [scroll, client] = await page.locator('.transport').evaluate((el) => [el.scrollWidth, el.clientWidth])
  expect(scroll).toBeLessThanOrEqual(client)
})
