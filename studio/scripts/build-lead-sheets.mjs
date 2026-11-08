// Build studio/public/leadsheets/catalog.json and data/lead_sheets.log from the public domain
// collections in the project root (see scripts/leadSheetCatalog.ts). The app's TypeScript readers
// are loaded through Vite, so the catalog is built with exactly the code that reads imports.
//
// Usage: pnpm run leadsheets
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const studio = resolve(fileURLToPath(import.meta.url), '../..')
const root = resolve(studio, '..')
const server = await createServer({ root: studio, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { buildCatalog } = await server.ssrLoadModule('/scripts/leadSheetCatalog.ts')
  const summary = await buildCatalog({
    openewld: resolve(root, 'openewld-ec03cbd.zip'),
    nottingham: resolve(root, 'choco-nottingham-raw-5fe168f.zip'),
    out: resolve(studio, 'public/leadsheets/catalog.json'),
    log: resolve(root, 'data/lead_sheets.log'),
  })
  console.log(summary)
} finally {
  await server.close()
}
