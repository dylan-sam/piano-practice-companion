import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import Root from './Root.tsx'
import { installBackHandler } from './ui/backButton'

// The Android back button closes menus, then goes back to the main menu (see ui/backButton.ts)
installBackHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
