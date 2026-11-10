// The Export menu of the players: four choices, greyed out while they hold no song.

import { expect, test } from '@playwright/test'

test('Export offers the written, shared, imported and all songs', async ({ page }) => {
  await page.goto('/play-along/chords')
  await page.getByRole('button', { name: 'Export' }).click()
  const menu = page.locator('#export-playlists')
  const choices = ['Songs I wrote or edited', 'Shared with me via link', 'Imported', 'All 3']
  for (const name of choices) await expect(menu.getByRole('button', { name: new RegExp(name) })).toBeDisabled()
  await page.keyboard.press('Escape')

  // A song saved from the editor is in the first choice and in All 3
  await page.getByRole('button', { name: 'Edit Song' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(menu.getByRole('button', { name: /Songs I wrote or edited/ })).toBeEnabled()
  await expect(menu.getByRole('button', { name: /Imported/ })).toBeDisabled()
  const download = page.waitForEvent('download')
  await menu.getByRole('button', { name: /All 3/ }).click()
  expect((await download).suggestedFilename()).toBe('ear-training-all-songs.json')
})
