// Melodic Dictation: a note is placed by tapping the staff, and Check judges the notes.

import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

test('a tap above a slash places its note, and Check judges every note', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/ear-training/melodic-dictation')
  const slash = page.locator('.dict-hidden').first()
  await expect(slash).toBeVisible({ timeout: 60_000 })
  const count = page.locator('.dictation-count')
  await expect(count).toHaveText(/^0\//)

  // Tap the staff one space above the top line, over the first hidden note
  const note = (await slash.boundingBox())!
  const staff = await page.locator('.abcjs-staff').evaluateAll((lines, y) =>
    lines.map((line) => line.getBoundingClientRect()).sort((a, b) =>
      Math.abs(a.top + a.height / 2 - (y as number)) - Math.abs(b.top + b.height / 2 - (y as number)))[0], note.y + note.height / 2)
  await page.mouse.click(note.x + 4, staff.top - staff.height / 4)
  await expect(count).toHaveText(/^1\//)

  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.feedback')).toBeVisible()
  await expect(page.locator('.lead-note-correct, .lead-note-wrong, .lead-note-missed').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the computer keys hint is left out on touch screens', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true })
  const page = await phone.newPage()
  await page.goto('/ear-training/melodic-dictation')
  await expect(page.locator('.dictation-hint')).toBeVisible({ timeout: 60_000 })
  // The text as shown (the hint about computer keys is hidden, not removed)
  expect(await page.locator('.dictation-hint').innerText()).not.toContain('Keys:')
  await phone.close()
})
