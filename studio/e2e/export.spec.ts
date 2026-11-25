// The Export menu of the players: four choices, greyed out while they hold no song.

import { expect, test } from '@playwright/test'
import { collectErrors, setTempo } from './helpers'

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
