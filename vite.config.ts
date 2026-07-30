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
    name: 'kidsup-version-file',
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
        // icon-source.png n'est qu'un fichier maître gardé pour régénérer les autres
        // icônes plus tard : l'app ne le charge jamais, inutile de le précacher.
        globIgnores: ['version.json', 'icons/icon-source.png'],
      },
      includeAssets: ['icons/favicon.png'],
      manifest: {
        name: 'KidsUp',
        short_name: 'KidsUp',
        description: 'Les tâches du quotidien rapportent des points, des badges et de belles progressions.',
        lang: 'fr',
        theme_color: '#911DE6',
        background_color: '#0A0118',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-source.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
