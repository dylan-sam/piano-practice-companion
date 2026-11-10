// Shared steps of the browser tests.

import { expect, type Page } from '@playwright/test'

/** Collect the page's errors (uncaught exceptions and console errors), to check none happened. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  return errors
}

/** Whether the page is wider than the window (a horizontal scroll bar on a phone). */
export const overflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

/** The text of the bottom bar's readout ("Bar 3 of 12", "Count-in"...), with plain spaces. */
export const readout = async (page: Page) => (await page.locator('.readout').innerText()).replace(/ /g, ' ')

/** The bar number shown in the readout, or null (count-in, stopped). */
export async function barNumber(page: Page): Promise<number | null> {
  const match = /Bar (\d+)/.exec(await readout(page))
  return match ? Number(match[1]) : null
}

/** Wait until the readout shows a bar being played. */
export async function waitForBar(page: Page): Promise<number> {
  await expect.poll(() => barNumber(page), { timeout: 60_000 }).not.toBeNull()
  return (await barNumber(page))!
}

/** Set the tempo slider of the bottom bar (React listens to the input event). */
export async function setTempo(page: Page, bpm: number): Promise<void> {
  await page.locator('.control-tempo input[type=range]').evaluate((input: HTMLInputElement, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, bpm)
}

/** Press Play (in the bottom bar) once the sounds are loaded. */
export async function play(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Play', exact: true })
  await expect(button).toBeEnabled({ timeout: 60_000 })
  await button.click()
}
