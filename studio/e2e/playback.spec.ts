// A setting that leaves the sheet as it is never starts the song again (AGENTS.md), and an
// endless line goes from one sheet to the next without stopping.

import { expect, test } from '@playwright/test'
import { barNumber, collectErrors, play, readout, setTempo, waitForBar } from './helpers'

test('the Chord Player goes on from the same bar when the style changes', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await play(page)
  const before = await waitForBar(page)
  for (const style of ['Bossa Nova', 'Blues', 'Swing']) {
    await page.locator('.transport select').first().selectOption({ label: style })
    await page.waitForTimeout(400)
    // No new count-in, and the bar does not go back
    expect(await readout(page)).not.toContain('Count-in')
    expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(before)
  }
  expect(errors).toEqual([])
})

test('Melodic Dictation goes on when the band is turned off and the choruses change', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/ear-training/melodic-dictation')
  await expect(page.locator('.dict-hidden').first()).toBeVisible({ timeout: 60_000 })
  // A new excerpt plays by itself
  await waitForBar(page)
  await page.getByRole('button', { name: 'Options' }).click()
  await page.locator('#dictation-options').getByRole('button', { name: /Play with the band/ }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  expect(await readout(page)).toMatch(/^Bar/)
  await page.getByRole('button', { name: 'More choruses' }).click()
  await page.waitForTimeout(400)
  expect(await readout(page)).toMatch(/^Bar/)
  expect(errors).toEqual([])
})

test('an endless lick line goes on from sheet to sheet', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectErrors(page)
  await page.goto('/sightreading/licks')
  await page.getByRole('button', { name: 'Infinite progressions' }).click()
  const start = page.getByRole('button', { name: 'New infinite line' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await setTempo(page, 300)
  // Follow the bars until the second sheet change: the bar number drops back to 1 twice, and
  // never stays still for long (the band does not stop)
  let sheets = 0
  let last = await waitForBar(page)
  let still = 0
  while (sheets < 2) {
    await page.waitForTimeout(250)
    const bar = await barNumber(page)
    if (bar === null || bar === last) {
      still += 1
      expect(still, 'the bars stopped moving').toBeLessThan(16)
      continue
    }
    if (bar < last) sheets += 1
    last = bar
    still = 0
  }
  expect(errors).toEqual([])
})

test('opening Pick a song over an endless line keeps it playing', async ({ page }) => {
  await page.goto('/sightreading/chords')
  await page.getByRole('button', { name: 'Infinite progressions' }).click()
  const start = page.getByRole('button', { name: 'New infinite line' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect.poll(() => readout(page), { timeout: 60_000 }).toMatch(/^Chord/)
  await page.getByRole('button', { name: 'Pick a song' }).click()
  await expect(page.locator('.library')).toBeVisible()
  const first = await readout(page)
  await expect.poll(() => readout(page), { timeout: 10_000 }).not.toBe(first)
  expect(await readout(page)).toMatch(/^Chord/)
})
