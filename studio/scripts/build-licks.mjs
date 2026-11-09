// Build the lick and exercise database (studio/public/licks/) and data/licks.log; see
// scripts/lickCatalog.ts. The app's TypeScript is loaded through Vite, so the database is built
// and checked with exactly the code that plays it.
//
// Usage: pnpm run licks
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const studio = resolve(fileURLToPath(import.meta.url), '../..')
const root = resolve(studio, '..')
const server = await createServer({ root: studio, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { buildLickCatalog } = await server.ssrLoadModule('/scripts/lickCatalog.ts')
  console.log(buildLickCatalog({
    leadSheets: resolve(studio, 'public/leadsheets/catalog.json'),
    weimar: resolve(root, 'data/weimar_solos.json'),
    out: resolve(studio, 'public/licks/licks.json'),
    outWeimar: resolve(studio, 'public/licks/licks_weimar.json'),
    log: resolve(root, 'data/licks.log'),
  }))
} finally {
  await server.close()
}
