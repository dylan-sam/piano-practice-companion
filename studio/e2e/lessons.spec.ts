// The Lessons tab: a step's Start button opens its page (what to do, why, the theory), whose
// "Understood, start" opens its screen set up for the step; back leads to the page again.
// Progress is kept on this device. Free Improvisation writes out the keys played (a fake MIDI keyboard).

import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

test('a lesson step opens Lead Sheet Sightreading with its song and left-hand stage', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/lessons')
  await expect(page.getByRole('heading', { name: 'Jazz piano in 46 weeks' })).toBeVisible()
  // Units start closed; a unit shows one week at a time
  await expect(page.locator('details.lesson-unit[open]')).toHaveCount(0)
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await expect(page.getByRole('tab', { name: 'Week 1' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Week 2' }).click()
  await expect(page.locator('#w2-avalon2')).toBeVisible()
  await expect(page.locator('#w1-avalon1')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Week 1' }).click()
  const step = page.locator('#w1-avalon1')
  await step.getByRole('button', { name: 'Mark done' }).click()
  await expect(step.getByRole('button', { name: 'Done' })).toBeVisible()
  await page.reload()
  await expect(page.locator('#w1-avalon1').getByRole('button', { name: 'Done' })).toBeVisible()

  await page.locator('#w1-avalon1').getByRole('button', { name: 'Start' }).click()
  // The step's page: what to do, the theory with its staff, the references
  await expect(page).toHaveURL(/\/lessons\/step\?id=w1-avalon1/)
  await expect(page.getByRole('heading', { level: 1, name: 'Avalon, stage 1, bass' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A song in three stages' })).toBeVisible()
  await expect(page.locator('.theory-staff svg')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'References' })).toBeVisible()
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(page).toHaveURL(/\/sightreading\/lead-sheets\?song=Avalon/)
  // Back once: the step's page
  await expect(page.locator('.readout')).toContainText('Avalon', { timeout: 60_000 })
  await page.goBack()
  await expect(page).toHaveURL(/\/lessons\/step\?id=w1-avalon1/)
  await page.goForward()
  await expect(page.locator('.lead-sheet, .readout').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.readout')).toContainText('Avalon')
  await page.getByRole('button', { name: /Scoring/ }).click()
  await expect(page.getByLabel('Check')).toHaveValue('both')
  await expect(page.getByLabel('Left hand')).toHaveValue('bass')
  await expect(page).toHaveURL(/step=w1-avalon1&goal=90/)
  // The screen's title leads back to the step's page, not to the Sightreading menu; the page's to
  // the Lessons tab, with the step shown
  await expect(page.locator('.wordmark')).toHaveAttribute('aria-label', 'Back to the lesson')
  await page.locator('.wordmark').click()
  await expect(page).toHaveURL(/\/lessons\/step\?id=w1-avalon1/)
  await page.locator('.wordmark').click()
  await expect(page).toHaveURL(/\/lessons$/)
  await expect(page.locator('#w1-avalon1')).toBeVisible()

  // The lesson's checking was for that visit only
  await page.goto('/sightreading/lead-sheets')
  await page.locator('.library-list .tune-title').first().click()
  await page.getByRole('button', { name: /Scoring/ }).click()
  await expect(page.getByLabel('Check')).toHaveValue('melody')
  expect(errors).toEqual([])
})

test('Free Improvisation writes out and colours the keys played', async ({ page }) => {
  await page.addInitScript(() => {
    const input = { name: 'Test keys', state: 'connected', onmidimessage: null as null | ((event: { data: Uint8Array }) => void) }
    Object.assign(window, { testKeys: input })
    Object.assign(navigator, { requestMIDIAccess: async () => ({ inputs: new Map([['1', input]]), onstatechange: null }) })
  })
  await page.goto('/improvisation/free?song=Avalon&bpm=120')
  await page.getByRole('button', { name: /Connect/ }).first().click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.locator('.readout').innerText(), { timeout: 60_000 }).toMatch(/Bar/)
  for (const note of [64, 66, 67, 61]) {
    await page.evaluate((n) => (window as unknown as { testKeys: { onmidimessage: (e: { data: Uint8Array }) => void } }).testKeys.onmidimessage({ data: new Uint8Array([0x90, n, 90]) }), note)
    await page.waitForTimeout(250)
    await page.evaluate((n) => (window as unknown as { testKeys: { onmidimessage: (e: { data: Uint8Array }) => void } }).testKeys.onmidimessage({ data: new Uint8Array([0x80, n, 0]) }), note)
  }
  await expect.poll(() => page.locator('[class*="tone-note-"], .abcjs-note').count()).toBeGreaterThan(0)
  await expect(page.getByRole('status', { name: 'Note colours' })).toContainText('chord tones')
  // Avalon's scale ideas, under the sheet, for the part playing (or all of them)
  const ideas = page.getByRole('region', { name: 'Scale ideas for this song' })
  await expect(ideas).toBeVisible()
  await expect(ideas).not.toContainText('Now:')
  await ideas.getByRole('button', { name: 'Show all' }).click()
  await expect(ideas).toContainText('B (bars 18 to 25)')
  // Tapping a bar opens the chord helper, with the chord's scale first
  await page.locator('.lead-score .abcjs-staff').first().click()
  const helper = page.getByRole('complementary', { name: 'Chord helper' })
  await expect(helper).toBeVisible()
  await expect(helper.getByText('First choice')).toBeVisible()
  await helper.getByRole('button', { name: 'Close the chord helper' }).click()
  await expect(helper).toHaveCount(0)
})

test('Delete all my data asks once more, then forgets everything', async ({ page }) => {
  await page.goto('/lessons')
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await page.locator('#w1-hands1').getByRole('button', { name: 'Mark done' }).click()
  await page.evaluate(() => localStorage.setItem('other-site', 'kept'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Delete all my data' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('deleted forever')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('eartraining:lessons:progress'))).not.toBeNull()

  await page.getByRole('button', { name: 'Delete all my data' }).click()
  await page.getByRole('button', { name: 'Yes, delete everything' }).click()
  await page.waitForLoadState('load')
  await expect(page.getByRole('button', { name: 'Delete all my data' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('eartraining')))).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('other-site'))).toBe('kept')
})

test('a substitution week: the song opens with the band playing the substitute, drawn in blue', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/lessons')
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await page.getByRole('tab', { name: 'Week 5' }).click()
  await page.locator('#sub1-avalon3').getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('heading', { name: 'Adding the ii before a long V7' })).toBeVisible()
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(page).toHaveURL(/subs=addII/)
  await expect(page.locator('text.lead-chord-sub').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text.lead-chord-sub').first()).toHaveText(/G/)
  // The screen's Substitutions menu shows the lesson's substitution ticked
  await page.getByRole('button', { name: 'Substitutions' }).click()
  await expect(page.getByRole('checkbox', { name: /Add the ii before a long V7/ })).toBeChecked()
  await page.keyboard.press('Escape')
  // Free Improvisation: the same, with its own menu
  await page.goto('/lessons')
  // The unit opened above stays open
  await page.getByRole('tab', { name: 'Week 5' }).click()
  await page.locator('#sub1-improvise-avalon').getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(page).toHaveURL(/improvisation.*subs=addII/)
  await expect(page.locator('.lead-chord-sub, .chord-sub').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Substitutions' }).click()
  await expect(page.getByRole('checkbox', { name: /Add the ii before a long V7/ })).toBeChecked()
  expect(errors).toEqual([])
})

test('an intro and ending step opens the song with bars added before and after the head', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/lessons')
  await page.getByText('Unit 1. Time, chords and the first song').click()
  await page.getByRole('tab', { name: 'Week 4' }).click()
  await page.locator('#w4-intro-avalon').getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.lesson-what')).toContainText('Intro, 4 bars')
  await expect(page.getByRole('heading', { name: 'Intros and endings' })).toBeVisible()
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(page).toHaveURL(/frame=avalon/)
  await expect(page.locator('.lead-score').getByText('Intro')).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('a lick step opens Lick Sightreading on its own lick, whatever lick was chosen before', async ({ page }) => {
  // A lick chosen on an earlier visit is kept for the screen, not for the lesson
  await page.goto('/sightreading/licks')
  const lick = page.getByRole('combobox', { name: 'Lick', exact: true })
  await expect(lick.locator('option').first()).toBeAttached({ timeout: 30_000 })
  await lick.selectOption(await lick.locator('option', { hasText: 'Blue third' }).first().getAttribute('value') ?? '')
  await page.goto('/lessons/step?id=w28-licks')
  await expect(page.getByRole('heading', { level: 1, name: /Scale lines licks: The Lick/ })).toBeVisible()
  await page.getByRole('button', { name: 'Understood, start' }).click()
  await expect(lick.locator('option:checked')).toHaveText(/ The Lick$/, { timeout: 60_000 })
})
