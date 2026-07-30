import type { CapacitorConfig } from '@capacitor/cli'

// Scaffolding uniquement (voir docs/mobile-app.md) : enveloppe le build web existant
// (`npm run build:mobile` → vite build + cap sync) dans une coquille native, sans aucun
// plugin natif avancé pour l'instant (push, biométrie…) — ce sera un chantier séparé.
const config: CapacitorConfig = {
  appId: 'app.kidsup.mobile',
  appName: 'KidsUp',
  webDir: 'dist',
}

export default config
