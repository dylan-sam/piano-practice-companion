// Keep errors on the device; the Studio does not send diagnostics upstream.
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0]
}

// Log an error with where it happened, without stopping the app
export function reportError(error: unknown, where?: string): void {
  console.error(where ?? 'Studio', error)
}
