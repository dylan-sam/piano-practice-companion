/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Where error reports go (Sentry). Unset in development and in copies of the app: nothing is sent.
  readonly VITE_SENTRY_DSN?: string
}

// Set from package.json at build time
declare const __APP_VERSION__: string
