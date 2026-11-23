// The Scoring menu of the reading screens: what is checked (melody only by default, chords, both,
// or improvising with note colours), with no Guide melody switch (the Mixer's Melody slider mutes the melody).

import { expect, test, type Page } from '@playwright/test'
import { collectErrors } from './helpers'

/** Open something to read, so the bottom bar shows: a song, or an infinite line for the licks. */
async function openSheet(page: Page, path: string): Promise<void> {
  if (path.endsWith('/licks')) {
    await page.getByRole('button', { name: 'Infinite progressions' }).click()
    const start = page.getByRole('button', { name: 'New infinite line' })
    await expect(start).toBeEnabled({ timeout: 60_000 })
    await start.click()
  } else await page.locator('.library-list .tune-title').first().click()
}

for (const path of ['/sightreading/lead-sheets', '/sightreading/exercises', '/sightreading/licks']) {
  test(`${path} Scoring checks the melody only by default`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(path)
    await openSheet(page, path)
    await page.getByRole('button', { name: /Scoring/ }).click()
    const check = page.getByLabel('Check')
    await expect(check).toHaveValue('melody')
    await expect(check.locator('option')).toHaveText(['Melody only', 'Chords only', 'Melody and chords', 'Improvise (note colours)'])
    await expect(page.getByRole('button', { name: /Guide melody/ })).toHaveCount(0)
    await check.selectOption('both')
    await page.reload()
    await openSheet(page, path)
    await page.getByRole('button', { name: /Scoring/ }).click()
    await expect(page.getByLabel('Check')).toHaveValue('both')
    expect(errors).toEqual([])
  })
}
