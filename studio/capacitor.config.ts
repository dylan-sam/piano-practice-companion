// Capacitor wraps the built web app (dist/) as the iOS and Android apps; see docs/MOBILE.md.
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.eartraining.app',
  appName: 'Ear Training',
  webDir: 'dist',
  // The page pads itself by the system bars (--safe-area-inset-* on Android, env() on iOS; see index.css)
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
  plugins: { SystemBars: { insetsHandling: 'css' } },
}

export default config
