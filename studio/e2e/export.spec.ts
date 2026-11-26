// The Export menu of the players: the person's playlists, each under a name chosen for the file;
// the band's track.

import { expect, test } from '@playwright/test'
import { collectErrors, setTempo } from './helpers'

test('a new song is saved into a playlist, exported under a name and imported into a new playlist', async ({ page }) => {
  await page.goto('/play-along/chords')
  // No playlist yet: nothing to export
  await page.getByRole('button', { name: 'Export' }).click()
  const menu = page.locator('#export-playlists')
  await expect(menu.getByText(/Make a playlist first/)).toBeVisible()
  await page.keyboard.press('Escape')

  // A new song asks for its playlist: a new one, "My songs" suggested
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('button', { name: 'Save new song' }).click()
  const save = page.getByRole('dialog', { name: /Save/ })
  await expect(save.getByRole('textbox', { name: /Name of the new playlist/ })).toHaveValue('My songs')
  await save.getByRole('button', { name: 'Save' }).click()
  // Saved: the editor now offers the song's playlists, then closes
  await page.getByRole('button', { name: 'Manage playlists' }).click()
  const manage = page.getByRole('dialog', { name: /Playlists of/ })
  await expect(manage.getByRole('checkbox', { name: /in My songs/ })).toBeChecked()
  await manage.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('combobox', { name: 'Playlist' }).locator('option:checked')).toHaveText('My songs (1)')

  // Export it under another name
  await page.getByRole('button', { name: 'Export' }).click()
  await menu.getByRole('checkbox').first().check()
  await menu.getByRole('textbox', { name: 'Name of My songs in the file' }).fill('Set list')
  const download = page.waitForEvent('download')
  await menu.getByRole('button', { name: /Download 1 song/ }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('set-list.json')
  const text = (await import('node:fs')).readFileSync((await file.path())!, 'utf8')

  // Import it: the file's name is suggested for a new playlist
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Import songs' })
  await dialog.getByRole('button', { name: 'Studio export' }).click()
  await dialog.getByRole('textbox', { name: 'Studio export JSON' }).fill(text)
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Name of the new playlist for Set list' })).toHaveValue('Set list')
  await dialog.getByRole('button', { name: 'Add the songs' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Added 1 song to Set list.')
  await dialog.getByRole('button', { name: 'Close' }).click()

  // The same song is now in both playlists; both deleted with the song kept, it goes to "Without playlist"
  await page.getByRole('button', { name: 'Playlists', exact: true }).click()
  for (const name of ['My songs', 'Set list']) {
    await page.getByRole('button', { name: `Delete ${name}` }).click()
    await page.getByRole('button', { name: 'none of its songs' }).click()
  }
  await expect(page.getByRole('combobox', { name: 'Playlist' }).locator('option')).toHaveText([/App Playlist/, 'Without playlist (1)'])
})

test('Export downloads the band as MIDI and as MP3', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await setTempo(page, 300)
  // One chorus, so the audio is short
  const fewer = page.getByRole('button', { name: 'Fewer choruses' })
  while (await fewer.isEnabled()) await fewer.click()
  await page.getByRole('button', { name: 'Export' }).click()
  const menu = page.locator('#export-playlists')
  const midi = page.waitForEvent('download')
  await menu.getByRole('button', { name: /MIDI file/ }).click()
  expect((await midi).suggestedFilename()).toMatch(/ - 300 bpm\.mid$/)
  const mp3 = page.waitForEvent('download', { timeout: 200_000 })
  await menu.getByRole('button', { name: /MP3 audio/ }).click()
  await expect(menu.getByText(/Making the MP3/)).toBeVisible()
  const file = await mp3
  expect(file.suggestedFilename()).toMatch(/ - 300 bpm\.mp3$/)
  const bytes = (await import('node:fs')).readFileSync((await file.path())!)
  expect(bytes.length).toBeGreaterThan(50_000)
  // An MP3 frame header (sync bits 0xFFE)
  expect(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0).toBe(true)
  expect(errors).toEqual([])
})
