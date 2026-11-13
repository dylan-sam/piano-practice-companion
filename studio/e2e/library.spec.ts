// The song list: choosing a playlist shows that playlist alone, in number order.

import { expect, test } from '@playwright/test'

test('a chosen playlist is shown alone, without the ChoCo search', async ({ page }) => {
  await page.goto('/play-along/lead-sheets')
  const playlist = page.getByRole('combobox', { name: 'Playlist' })
  await expect(playlist).toBeVisible()
  const names = (await playlist.locator('option').allInnerTexts()).filter((name) => name !== 'All playlists')
  expect(names.length).toBeGreaterThan(1)

  await playlist.selectOption(names[0])
  const groups = page.locator('.library-group')
  await expect(groups).toHaveCount(1)
  await expect(groups).toHaveText(names[0])
  await expect(page.getByRole('heading', { name: 'ChoCo scores' })).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Search songs' })).toHaveAttribute('placeholder', 'Search this playlist')

  // Back to every playlist: the search covers every song again
  await playlist.selectOption({ label: 'All playlists' })
  await expect(page.getByRole('searchbox', { name: 'Search songs' })).not.toHaveAttribute('placeholder', 'Search this playlist')
})

test('lick playlists list their licks in number order', async ({ page }) => {
  await page.goto('/sightreading/exercises')
  const playlist = page.getByRole('combobox', { name: 'Playlist' })
  await playlist.selectOption({ label: 'Licks from standards: Major chord' })
  const titles = await page.locator('.library-list .tune-title').allInnerTexts()
  expect(titles.slice(0, 3)).toEqual(['Standards: Major chord 1', 'Standards: Major chord 2', 'Standards: Major chord 3'])
})
