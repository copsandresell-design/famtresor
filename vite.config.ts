import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enregistrement pilotÃ© manuellement dans main.tsx : on veut forcer la vÃ©rification
      // de mise Ã  jour au retour au premier plan et recharger automatiquement quand un
      // nouveau service worker prend la main (sinon la PWA installÃ©e reste bloquÃ©e sur
      // l'ancienne version tant qu'on ne la dÃ©sinstalle pas).
      injectRegister: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'FamTrÃ©sor',
        short_name: 'FamTrÃ©sor',
        description: "L'app familiale oÃ¹ les tÃ¢ches mÃ©nagÃ¨res rapportent de vrais euros.",
        lang: 'fr',
        theme_color: '#FBBF24',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
