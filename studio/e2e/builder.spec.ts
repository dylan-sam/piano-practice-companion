// The exercise builder of Exercises Sightreading: build an exercise, save it as a preset (listed
// under its category), rename it, delete an example (Restore all default songs brings it back),
// and a lesson step's exercise, whose settings are locked.

import { expect, test, type Page } from '@playwright/test'

/** The titles listed in the song list. */
const titles = (page: Page) => page.locator('.library-list .tune-title').allInnerTexts()

/** Open the song list (on a phone it is a panel) and the builder. */
async function openBuilder(page: Page) {
  const build = page.getByRole('button', { name: 'Build', exact: true })
  if (!(await build.isVisible())) await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await build.click()
  return page.getByRole('region', { name: 'Exercise builder' })
}

test('build an exercise, save it as a preset, rename it, and delete it', async ({ page }) => {
  await page.goto('/sightreading/exercises')
  await expect.poll(async () => (await titles(page)).length).toBeGreaterThan(100)
  // The six examples, one per category
  expect(await titles(page)).toContain('Major triads in fourths: up one, down the next')
  const builder = await openBuilder(page)
  // Opened on an empty stand, the builder writes its first exercise there
  await expect(page.locator('.readout')).toContainText('Major triads in fourths', { timeout: 30_000 })
  await builder.getByRole('combobox', { name: 'Kind', exact: true }).selectOption('scale')
  await builder.getByRole('combobox', { name: 'Scale', exact: true }).selectOption('Dorian')
  await expect(page.locator('.readout')).toContainText('Dorian scale over')
  await builder.getByLabel('Preset name').fill('My Dorian')
  await builder.getByRole('button', { name: 'Save as a new preset' }).click()
  await expect.poll(() => titles(page)).toContain('My Dorian')
  // Renamed: the same preset, a new name
  await builder.getByLabel('Preset name').fill('Dorian every day')
  await builder.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => titles(page)).toContain('Dorian every day')
  expect(await titles(page)).not.toContain('My Dorian')
  // Kept after a reload
  await page.reload()
  await expect.poll(() => titles(page)).toContain('Dorian every day')
  await page.locator('.library-list .tune-title', { hasText: 'Dorian every day' }).click()
  const again = await openBuilder(page)
  await again.getByRole('button', { name: 'Delete preset' }).click()
  await again.getByRole('button', { name: 'Delete Dorian every day?' }).click()
  await expect.poll(() => titles(page)).not.toContain('Dorian every day')
})

test('a deleted example comes back with Restore all default songs', async ({ page }) => {
  await page.goto('/sightreading/exercises')
  const example = 'Mixolydian scale over C7: up and down'
  await expect.poll(() => titles(page)).toContain(example)
  await page.locator('.library-list .tune-title', { hasText: example }).click()
  const builder = await openBuilder(page)
  await builder.getByRole('button', { name: 'Delete preset' }).click()
  await builder.getByRole('button', { name: `Delete ${example}?` }).click()
  await expect.poll(() => titles(page)).not.toContain(example)
  await page.goto('/')
  await page.getByRole('button', { name: 'Restore all default songs' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Recovered 1 example exercise.' })).toBeVisible()
  await page.goto('/sightreading/exercises')
  await expect.poll(() => titles(page)).toContain(example)
})

test('a lesson step builds its exercise, and its settings are locked', async ({ page }) => {
  await page.goto('/lessons/step?id=w2-hands1')
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(page.locator('.readout')).toContainText('Major triads in half steps', { timeout: 60_000 })
  const builder = await openBuilder(page)
  await expect(builder).toContainText('set by the lesson step')
  await expect(builder.getByRole('combobox', { name: 'Kind', exact: true })).toBeDisabled()
  await expect(builder.getByRole('button', { name: 'Save as a new preset' })).toHaveCount(0)
})
