// The Playlists filter of the song list, and the Licks filter of Lick Sightreading: check boxes,
// like the Progressions filter. Only the checked playlists are listed (all of them when none is).

import { expect, test, type Page } from '@playwright/test'

/** Open a check filter's panel and check (or uncheck) the boxes named. */
async function check(page: Page, filter: RegExp, names: string[]) {
  const button = page.getByRole('button', { name: filter })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  for (const name of names) await page.getByRole('checkbox', { name, exact: true }).click()
}

test('only the checked playlists are listed', async ({ page }) => {
  await page.goto('/play-along/lead-sheets')
  await check(page, /^Playlists/, ['Nottingham folk tunes'])
  const groups = page.locator('.library-group')
  await expect(groups).toHaveText(['Nottingham folk tunes'])
  await expect(page.getByRole('button', { name: /^Playlists \(1\)/ })).toBeVisible()

  await expect(page.locator('.library-count')).toHaveText('981')

  // A second playlist joins the list (its songs come after the first's); Clear lists every playlist again
  await check(page, /^Playlists/, ['OpenEWLD lead sheets'])
  await expect(page.locator('.library-count')).toHaveText('1479')
  await page.getByRole('searchbox', { name: 'Search songs' }).fill('Blue Moon')
  await expect(groups).toHaveText(['OpenEWLD lead sheets'])
  await page.getByRole('searchbox', { name: 'Search songs' }).fill('')
  await page.locator('.check-filter').getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('button', { name: /^Playlists$/ })).toBeVisible()
})

test('lick playlists list their licks in number order', async ({ page }) => {
  await page.goto('/sightreading/exercises')
  await check(page, /^Playlists/, ['Licks from standards: Major chord'])
  const titles = await page.locator('.library-list .tune-title').allInnerTexts()
  expect(titles.slice(0, 3)).toEqual(['Standards: Major chord 1', 'Standards: Major chord 2', 'Standards: Major chord 3'])
})

test('the ChoCo chord charts are one of the playlists', async ({ page }) => {
  await page.goto('/play-along/chords')
  await check(page, /^Playlists/, ['ChoCo chord charts'])
  await expect(page.getByRole('heading', { name: 'ChoCo scores' })).toBeVisible()
  await expect(page.locator('.library-group')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Progressions/ })).toBeVisible()

  // With a saved playlist checked too, both are listed; without ChoCo, its search goes away
  await check(page, /^Playlists/, ['Nottingham folk tunes'])
  await expect(page.locator('.library-group')).toHaveText(['Nottingham folk tunes'])
  await expect(page.getByRole('heading', { name: 'ChoCo scores' })).toBeVisible()
  await check(page, /^Playlists/, ['ChoCo chord charts'])
  await expect(page.getByRole('heading', { name: 'ChoCo scores' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Progressions/ })).toHaveCount(0)
})

test('the Licks filter offers only the checked lick playlists', async ({ page }) => {
  await page.goto('/sightreading/licks')
  const lick = page.getByRole('combobox', { name: 'Lick', exact: true })
  await expect(lick.locator('option').first()).toBeAttached({ timeout: 30_000 })
  await check(page, /^Licks/, ['Standards: Dominant chord'])
  await expect(lick.locator('optgroup')).toHaveCount(1)
  await expect(lick.locator('optgroup')).toHaveAttribute('label', 'Standards: Dominant chord')
  await expect(lick).toHaveValue(await lick.locator('option').first().getAttribute('value') ?? '')
  // Random lick stays among the checked playlist's licks
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Random lick' }).click()
    await expect(page.locator('.lick-source')).toContainText('Standards: Dominant chord')
  }
})
