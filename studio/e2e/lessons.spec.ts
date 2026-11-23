// The Lessons tab: a step's Start button opens its screen set up for the step, and progress is
// kept on this device. Free Improvisation writes out the keys played (a fake MIDI keyboard).

import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

test('a lesson step opens Lead Sheet Sightreading with its song and left-hand stage', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/lessons')
  await expect(page.getByRole('heading', { name: 'Jazz piano in 30 weeks' })).toBeVisible()
  // Units start closed; a unit shows one week at a time
  await expect(page.locator('details.lesson-unit[open]')).toHaveCount(0)
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await expect(page.getByRole('tab', { name: 'Week 1' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Week 2' }).click()
  await expect(page.locator('#w2-avalon2')).toBeVisible()
  await expect(page.locator('#w1-avalon1')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Week 1' }).click()
  const step = page.locator('#w1-avalon1')
  await step.getByRole('button', { name: 'Mark done' }).click()
  await expect(step.getByRole('button', { name: 'Done' })).toBeVisible()
  await page.reload()
  await expect(page.locator('#w1-avalon1').getByRole('button', { name: 'Done' })).toBeVisible()

  await page.locator('#w1-avalon1').getByRole('button', { name: 'Start' }).click()
  await expect(page).toHaveURL(/\/sightreading\/lead-sheets\?song=Avalon/)
  // Back once: the Lessons tab, as it was left
  await expect(page.locator('.readout')).toContainText('Avalon', { timeout: 60_000 })
  await page.goBack()
  await expect(page).toHaveURL(/\/lessons$/)
  await expect(page.locator('#w1-avalon1')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.lead-sheet, .readout').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.readout')).toContainText('Avalon')
  await page.getByRole('button', { name: /Scoring/ }).click()
  await expect(page.getByLabel('Check')).toHaveValue('both')
  await expect(page.getByLabel('Left hand')).toHaveValue('bass')
  await expect(page).toHaveURL(/step=w1-avalon1&goal=90/)

  // The lesson's checking was for that visit only
  await page.goto('/sightreading/lead-sheets')
  await page.locator('.library-list .tune-title').first().click()
  await page.getByRole('button', { name: /Scoring/ }).click()
  await expect(page.getByLabel('Check')).toHaveValue('melody')
  expect(errors).toEqual([])
})

test('Free Improvisation writes out and colours the keys played', async ({ page }) => {
  await page.addInitScript(() => {
    const input = { name: 'Test keys', state: 'connected', onmidimessage: null as null | ((event: { data: Uint8Array }) => void) }
    Object.assign(window, { testKeys: input })
    Object.assign(navigator, { requestMIDIAccess: async () => ({ inputs: new Map([['1', input]]), onstatechange: null }) })
  })
  await page.goto('/improvisation/free?song=Avalon&bpm=120')
  await page.getByRole('button', { name: /Connect/ }).first().click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.locator('.readout').innerText(), { timeout: 60_000 }).toMatch(/Bar/)
  for (const note of [64, 66, 67, 61]) {
    await page.evaluate((n) => (window as unknown as { testKeys: { onmidimessage: (e: { data: Uint8Array }) => void } }).testKeys.onmidimessage({ data: new Uint8Array([0x90, n, 90]) }), note)
    await page.waitForTimeout(250)
    await page.evaluate((n) => (window as unknown as { testKeys: { onmidimessage: (e: { data: Uint8Array }) => void } }).testKeys.onmidimessage({ data: new Uint8Array([0x80, n, 0]) }), note)
  }
  await expect.poll(() => page.locator('[class*="tone-note-"], .abcjs-note').count()).toBeGreaterThan(0)
  await expect(page.getByRole('status', { name: 'Note colours' })).toContainText('chord tones')
  // The scales under the sheet: the chord sounding, and Avalon's ideas for the part playing (or all of them)
  const scales = page.getByRole('region', { name: 'Scales' })
  await expect(scales).toContainText('Now:')
  await expect(scales).toContainText('In the key: F major pentatonic')
  await scales.getByRole('button', { name: 'Show all' }).click()
  await expect(scales).toContainText('B (bars 17 to 24)')
})

test('Delete all my data asks once more, then forgets everything', async ({ page }) => {
  await page.goto('/lessons')
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await page.locator('#w1-hands1').getByRole('button', { name: 'Mark done' }).click()
  await page.evaluate(() => localStorage.setItem('other-site', 'kept'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Delete all my data' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('deleted forever')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('eartraining:lessons:progress'))).not.toBeNull()

  await page.getByRole('button', { name: 'Delete all my data' }).click()
  await page.getByRole('button', { name: 'Yes, delete everything' }).click()
  await page.waitForLoadState('load')
  await expect(page.getByRole('button', { name: 'Delete all my data' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('eartraining')))).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('other-site'))).toBe('kept')
})
