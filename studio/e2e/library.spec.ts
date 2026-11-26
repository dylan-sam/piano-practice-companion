// The song list: one playlist of the app's songs (the person's own playlists made, chosen and
// deleted in the Playlists panel), the categories of the exercises, and the Licks filter of Lick
// Sightreading (check boxes, like the Progressions filter).

import { expect, test, type Page } from '@playwright/test'

/** Open a check filter's panel and check (or uncheck) the boxes named. */
async function check(page: Page, filter: RegExp, names: string[]) {
  const button = page.getByRole('button', { name: filter })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  for (const name of names) await page.getByRole('checkbox', { name, exact: true }).click()
}

/** The number of songs listed, as the search box says ("Search 1483 songs"). */
async function songCount(page: Page): Promise<number> {
  const placeholder = await page.getByRole('searchbox', { name: 'Search songs' }).getAttribute('placeholder')
  return Number(/Search (\d+)/.exec(placeholder ?? '')?.[1] ?? NaN)
}

test('one playlist of every shipped song, with no chooser until the person makes a playlist', async ({ page }) => {
  await page.goto('/play-along/lead-sheets')
  // The study tunes, the OpenEWLD lead sheets and the Nottingham folk tunes, in one list by title
  await expect.poll(() => songCount(page)).toBe(1483)
  await expect(page.getByRole('combobox', { name: 'Playlist' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search songs' }).fill('Blue Moon')
  await expect(page.locator('.library-list .tune-title').first()).toHaveText(/Blue Moon/)
  await page.getByRole('searchbox', { name: 'Search songs' }).fill('')

  // Make a playlist (Playlists): the chooser appears and shows it, empty
  await page.locator('.library-list .tune').first().click()
  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  await page.getByRole('textbox', { name: 'New playlist name' }).fill('Jazz')
  await page.getByRole('button', { name: 'Create' }).click()
  const chooser = page.getByRole('combobox', { name: 'Playlist' })
  await expect(chooser.locator('option:checked')).toHaveText('Jazz (0)')
  await page.locator('.playlist-panel').getByRole('button', { name: 'Close' }).click()
  // The open song put in it with Edit Song > Manage playlists
  await page.getByRole('button', { name: 'Edit Song' }).click()
  await page.getByRole('button', { name: 'Manage playlists' }).click()
  const box = page.getByRole('dialog', { name: /Playlists of/ }).getByRole('checkbox', { name: /in Jazz/ })
  await box.click()
  await expect(box).toBeChecked()
  await page.getByRole('dialog', { name: /Playlists of/ }).getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(chooser.locator('option:checked')).toHaveText('Jazz (1)')
  await expect.poll(() => songCount(page)).toBe(1)
  // Taken out again: a shipped song is not deleted, only taken out
  await page.locator('.library-list .tune-remove').click()
  await expect.poll(() => songCount(page)).toBe(0)
  await expect(page.getByText('This playlist is empty.')).toBeVisible()
  // Deleted, keeping the songs: back to the one playlist, no chooser
  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  await page.getByRole('button', { name: 'Delete Jazz' }).click()
  await page.getByRole('button', { name: 'none of its songs' }).click()
  await expect(chooser).toHaveCount(0)
  await expect.poll(() => songCount(page)).toBe(1483)

  // A song of the app deleted for good (Edit Song, two presses) is hidden; the main menu recovers it
  await page.locator('.playlist-panel').getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Edit Song' }).click()
  await page.getByRole('button', { name: 'Delete song' }).click()
  await page.getByRole('button', { name: 'Delete it for good?' }).click()
  await expect.poll(() => songCount(page)).toBe(1482)
  await page.goto('/')
  await page.getByRole('button', { name: 'Restore all default songs' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Recovered 1 song.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore all default songs' })).toBeDisabled()
  await page.goto('/play-along/lead-sheets')
  await expect.poll(() => songCount(page)).toBe(1483)
})

test('exercises and licks are listed by category, in their order', async ({ page }) => {
  await page.goto('/sightreading/exercises')
  await check(page, /^Categories/, ['Licks: Arpeggios'])
  const titles = await page.locator('.library-list .tune-title').allInnerTexts()
  expect(titles[0]).toBe('Arpeggio 1-3-5-7, scale down to the 9')
  expect(titles.slice(1).every((title) => /arpeggio/i.test(title))).toBe(true)
  await expect(page.getByRole('button', { name: 'Playlists', exact: true })).toHaveCount(0)
})

test('the ChoCo charts are searched with the shipped songs', async ({ page }) => {
  await page.goto('/play-along/chords')
  await expect(page.getByRole('heading', { name: /ChoCo chord charts/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Progressions/ })).toBeVisible()
})

test('the progressions are found in the shipped lead sheets, any of them by default', async ({ page }) => {
  await page.goto('/sightreading/lead-sheets')
  await expect.poll(() => songCount(page)).toBe(1483)
  await check(page, /^Progressions/, ['vi – ii – V – I'])
  await expect(page.getByRole('button', { name: 'Any of them' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => songCount(page)).toBeLessThan(1483)
  await expect.poll(() => songCount(page)).toBeGreaterThan(10)
})

test('the Licks filter offers only the checked lick playlists', async ({ page }) => {
  await page.goto('/sightreading/licks')
  const lick = page.getByRole('combobox', { name: 'Lick', exact: true })
  await expect(lick.locator('option').first()).toBeAttached({ timeout: 30_000 })
  await check(page, /^Licks/, ['Blues'])
  await expect(lick.locator('optgroup')).toHaveCount(1)
  await expect(lick.locator('optgroup')).toHaveAttribute('label', 'Blues')
  await expect(lick).toHaveValue(await lick.locator('option').first().getAttribute('value') ?? '')
  // Random lick stays among the checked playlist's licks; each lick shows its level
  const offered = await lick.locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value))
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Random lick' }).click()
    expect(offered).toContain(await lick.inputValue())
  }
  await expect(lick.locator('option').first()).toHaveText(/^\u25cf+ /)
})
