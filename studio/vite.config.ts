import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Served from the site root, or from a folder given by BASE_PATH (GitHub Pages: /piano-practice-companion/)
  base: process.env.BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // The Weimar test solos are served only by local builds that have them (they are not in git)
    __WEIMAR_SOLOS__: JSON.stringify(existsSync('public/leadsheets/weimar_solos.json')),
  },
  plugins: [react()],
})
