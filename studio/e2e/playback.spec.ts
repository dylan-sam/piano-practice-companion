// A setting that leaves the sheet as it is never starts the song again (AGENTS.md), and an
// endless line goes from one sheet to the next without stopping.

import { expect, test } from '@playwright/test'
import { barNumber, collectErrors, play, readout, setTempo, waitForBar } from './helpers'

test('the Chord Player goes on from the same bar when the style changes', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await play(page)
  const before = await waitForBar(page)
  for (const style of ['Bossa Nova', 'Blues', 'Swing']) {
    await page.locator('.transport select').first().selectOption({ label: style })
    await page.waitForTimeout(400)
    // No new count-in, and the bar does not go back
    expect(await readout(page)).not.toContain('Count-in')
    expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(before)
  }
  expect(errors).toEqual([])
})

test('Melodic Dictation goes on when the band is turned off and the choruses change', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/ear-training/melodic-dictation')
  await expect(page.locator('.dict-hidden').first()).toBeVisible({ timeout: 60_000 })
  // A new excerpt plays by itself
  await waitForBar(page)
  await page.getByRole('button', { name: 'Options' }).click()
  await page.locator('#dictation-options').getByRole('button', { name: /Play with the band/ }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  expect(await readout(page)).toMatch(/^Bar/)
  await page.getByRole('button', { name: 'More choruses' }).click()
  await page.waitForTimeout(400)
  expect(await readout(page)).toMatch(/^Bar/)
  expect(errors).toEqual([])
})

test('an endless lick line goes on from sheet to sheet', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectErrors(page)
  await page.goto('/sightreading/licks')
  await page.getByRole('button', { name: 'Infinite progressions' }).click()
  const start = page.getByRole('button', { name: 'New infinite line' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await setTempo(page, 300)
  // Follow the bars until the second sheet change: the bar number drops back to 1 twice, and
  // never stays still for long (the band does not stop)
  let sheets = 0
  let last = await waitForBar(page)
  let still = 0
  while (sheets < 2) {
    await page.waitForTimeout(250)
    const bar = await barNumber(page)
    if (bar === null || bar === last) {
      still += 1
      expect(still, 'the bars stopped moving').toBeLessThan(16)
      continue
    }
    if (bar < last) sheets += 1
    last = bar
    still = 0
  }
  expect(errors).toEqual([])
})

test('opening Pick a song over an endless line keeps it playing', async ({ page }) => {
  await page.goto('/sightreading/chords')
  await page.getByRole('button', { name: 'Infinite progressions' }).click()
  const start = page.getByRole('button', { name: 'New infinite line' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect.poll(() => readout(page), { timeout: 60_000 }).toMatch(/^Chord/)
  await page.getByRole('button', { name: 'Pick a song' }).click()
  await expect(page.locator('.library')).toBeVisible()
  const first = await readout(page)
  await expect.poll(() => readout(page), { timeout: 10_000 }).not.toBe(first)
  expect(await readout(page)).toMatch(/^Chord/)
})

test('Pause keeps the place: Play goes on from there, and the start-again button starts over', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await setTempo(page, 240)
  await play(page)
  await expect.poll(() => barNumber(page), { timeout: 60_000 }).toBeGreaterThanOrEqual(4)
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = (await barNumber(page))!
  await page.waitForTimeout(800)
  expect(await barNumber(page)).toBe(paused)
  // Play goes on from the same bar, with no count-in
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(300)
  expect(await readout(page)).not.toContain('Count-in')
  expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(paused)
  // From the beginning: the count-in or the first bars again
  await page.getByRole('button', { name: 'Play from the beginning' }).click()
  await expect.poll(async () => /Count-in/.test(await readout(page)) || ((await barNumber(page)) ?? 99) < paused).toBe(true)
  expect(errors).toEqual([])
})

test('a tapped chord opens the chord helper; Start the band from here plays from it without a count-in', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 60_000 })
  const chord = page.locator('.sheet .bar').nth(5).locator('.chord').first()
  await chord.click()
  const helper = page.getByRole('complementary', { name: 'Chord helper' })
  await expect(helper).toBeVisible()
  await expect(helper.getByText('For this chord')).toBeVisible()
  await expect(helper.getByText('First choice')).toBeVisible()
  // Another scale (the chord's pentatonic) shows its notes on the keyboard
  await helper.locator('.helper-scale').nth(1).click()
  await expect(helper.locator('.helper-scale').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await helper.getByRole('button', { name: 'Start the band from here' }).click()
  await expect(helper).toHaveCount(0)
  await expect(page.locator('.chord-start')).toHaveCount(1)
  expect(await readout(page)).toMatch(/Start from Bar.6/)
  // Asking again for the same chord clears the start point
  await chord.click()
  await helper.getByRole('button', { name: 'Start from the beginning again' }).click()
  await expect(page.locator('.chord-start')).toHaveCount(0)
  await chord.click()
  await helper.getByRole('button', { name: 'Start the band from here' }).click()
  await play(page)
  await page.waitForTimeout(300)
  expect(await readout(page)).not.toContain('Count-in')
  expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(6)
  await expect(page.locator('.chord-start')).toHaveCount(0)
  // While the band plays, a tap opens the helper without Start
  await chord.click()
  await expect(helper).toBeVisible()
  await expect(helper.getByRole('button', { name: /Start/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(helper).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the Chords button opens the chord helper, which follows the chord playing, and shows more scales on demand', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 60_000 })
  // On a phone the Chords button is in the Settings panel
  const settings = page.getByRole('button', { name: 'Settings' })
  if (await settings.isVisible()) await settings.click()
  await page.getByRole('button', { name: 'Chords', exact: true }).click()
  const helper = page.getByRole('complementary', { name: 'Chord helper' })
  await expect(helper).toBeVisible()
  await expect(helper.getByRole('checkbox', { name: 'Follow the chord playing' })).toBeChecked()
  // Only the chord's own scales, until Show more scales
  await expect(helper.getByText('For this chord')).toBeVisible()
  await expect(helper.getByText('From the key')).toHaveCount(0)
  await helper.getByRole('button', { name: 'Show more scales' }).click()
  await expect(helper.getByText('From the key')).toBeVisible()
  await helper.getByRole('button', { name: 'Show fewer scales' }).click()
  await expect(helper.getByText('From the key')).toHaveCount(0)
  // While the band plays, the helper shows the chord sounding, chord after chord
  await setTempo(page, 300)
  await play(page)
  const names = new Set<string>()
  for (let i = 0; i < 12; i++) {
    names.add(await helper.locator('.chord').first().getAttribute('aria-label') ?? '')
    await page.waitForTimeout(400)
  }
  expect(names.size).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Chords', exact: true }).click()
  await expect(helper).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Substitutions: the band plays the chosen substitutes, drawn in a colour on the sheet', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play-along/chords')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 60_000 })
  await expect(page.locator('.chord-sub')).toHaveCount(0)
  await page.getByRole('button', { name: 'Substitutions' }).click()
  await page.getByRole('checkbox', { name: /Tritone substitution/ }).check()
  await page.getByRole('checkbox', { name: /Secondary dominant on the ii/ }).check()
  await expect(page.locator('.chord-sub').first()).toBeVisible()
  // From the second chorus: the first chorus is drawn as written
  await page.getByRole('combobox', { name: 'When' }).selectOption('from')
  await expect(page.locator('.chord-sub')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'When' }).selectOption('always')
  await expect(page.locator('.chord-sub').first()).toBeVisible()
  // The order: the arrow keys on a handle, and dragging one
  const rows = page.locator('.substitutions-list li')
  await expect(rows.first()).toContainText('Add the ii')
  await page.getByRole('button', { name: /Move Tritone substitution/ }).focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp')
  await expect(rows.first()).toContainText('Tritone substitution')
  const handle = await page.getByRole('button', { name: /Move Turnaround with dominants/ }).boundingBox()
  const top = await rows.first().boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle!.x + handle!.width / 2, top!.y + 4, { steps: 8 })
  await page.mouse.up()
  await expect(rows.first()).toContainText('Turnaround with dominants')
  await expect(rows.nth(1)).toContainText('Tritone substitution')
  const panelBottom = (await page.locator('.substitutions .popover-panel').boundingBox())!
  await page.keyboard.press('Escape')
  // The chord helper shows the substitute and the chord written there, its bottom on the menus' bottom
  await page.locator('.chord-sub').first().click()
  const helper = page.getByRole('complementary', { name: 'Chord helper' })
  await expect(helper.getByText(/Played instead of/)).toBeVisible()
  const helperBox = (await helper.boundingBox())!
  expect(Math.abs(helperBox.y + helperBox.height - (panelBottom.y + panelBottom.height))).toBeLessThan(1.5)
  await play(page)
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})

test('Free Improvisation goes on with the same sheet of an infinite line after a pause', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/improvisation/free')
  await page.getByRole('button', { name: 'Infinite progressions' }).click()
  const start = page.getByRole('button', { name: 'New infinite line' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await setTempo(page, 240)
  await expect.poll(() => barNumber(page), { timeout: 60_000 }).toBeGreaterThanOrEqual(3)
  const chords = await page.locator('.lead-sheet, .chart').first().innerText()
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = (await barNumber(page))!
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(300)
  expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(paused)
  expect(await page.locator('.lead-sheet, .chart').first().innerText()).toBe(chords)
  expect(errors).toEqual([])
})

test('Lead Sheet Sightreading goes on from the same bar when the choruses change', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/sightreading/lead-sheets?song=Avalon')
  await play(page)
  const before = await waitForBar(page)
  await page.getByRole('button', { name: 'More choruses' }).click()
  await page.waitForTimeout(400)
  expect(await readout(page)).not.toContain('Count-in')
  expect((await barNumber(page)) ?? 0).toBeGreaterThanOrEqual(before)
  expect(errors).toEqual([])
})
