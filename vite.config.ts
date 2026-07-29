import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Filet de secours pour la mise à jour PWA sur iOS (voir src/lib/versionCheck.ts) : un
// fichier /version.json régénéré à CHAQUE build, avec un identifiant unique (SHA du commit
// si connu, sinon horodatage). Écrit directement dans dist/ via writeBundle plutôt que dans
// public/ — rien à committer, rien à oublier de régénérer.
function versionFilePlugin(): Plugin {
  return {
    name: 'famtresor-version-file',
    apply: 'build',
    // Placé après VitePWA dans le tableau de plugins (voir plus bas) : ce writeBundle
    // s'exécute donc après l'injection du manifest de précache Workbox, garantissant que
    // version.json ne peut jamais être capturé dedans, même si globPatterns changeait.
    writeBundle(options) {
      let version: string
      try {
        version = process.env.VERCEL_GIT_COMMIT_SHA || execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
      } catch {
        version = String(Date.now())
      }
      const outDir = options.dir ?? 'dist'
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({ version, builtAt: new Date().toISOString() }),
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enregistrement piloté manuellement dans main.tsx : on veut forcer la vérification
      // de mise à jour au retour au premier plan et recharger automatiquement quand un
      // nouveau service worker prend la main (sinon la PWA installée reste bloquée sur
      // l'ancienne version tant qu'on ne la désinstalle pas).
      injectRegister: false,
      // Service worker custom (src/sw.ts) au lieu du generateSW par défaut : nécessaire
      // pour gérer les vraies notifications push (event 'push' / 'notificationclick'),
      // qui doivent marcher même quand l'app est complètement fermée.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Le fichier de version doit TOUJOURS aller au réseau (voir versionCheck.ts) —
        // jamais servi depuis le precache, même si globPatterns venait à inclure .json.
        globIgnores: ['version.json'],
      },
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'FamTrésor',
        short_name: 'FamTrésor',
        description: "L'app familiale où les tâches ménagères rapportent de vrais euros.",
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
    versionFilePlugin(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
