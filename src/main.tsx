import '@fontsource-variable/inter'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { setNeedRefresh } from './lib/pwaUpdate'
import { checkForNewVersion } from './lib/versionCheck'

// PWA : sans ça, une app installée sur mobile peut rester bloquée indéfiniment sur une
// vieille version tant qu'on ne la désinstalle pas — le navigateur ne revérifie les mises
// à jour que rarement, ET un nouveau service worker installé reste en attente tant qu'on
// ne l'active pas explicitement (skipWaiting). On force la vérification à chaque retour au
// premier plan, on affiche un bandeau (voir UpdateBanner.tsx) dès qu'une mise à jour est
// prête, et on recharge automatiquement dès que le nouveau service worker prend la main.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setNeedRefresh(updateSW)
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const checkForUpdate = () => void registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
      setInterval(checkForUpdate, 60_000)
    },
  })
}

// Filet de secours indépendant du service worker (voir lib/versionCheck.ts) : nécessaire
// notamment sur iOS, où un SW "waiting" peut ne jamais s'activer tout seul en arrière-plan.
// Fire-and-forget : ne doit jamais retarder l'affichage initial.
void checkForNewVersion()

// Progression simulée de la barre de chargement (voir index.html) : pas de vrai signal de
// chargement à mesurer ici (les modules sont déjà tous chargés quand ce script s'exécute), donc
// on anime rapidement vers ~90% pendant que React se monte, puis on saute à 100% une fois le
// rendu lancé — donne une impression de progression réelle plutôt qu'un remplissage instantané.
const splashBarFill = document.getElementById('app-splash-bar-fill')
let splashProgress = 0
const splashTimer = setInterval(() => {
  splashProgress += (90 - splashProgress) * 0.25
  if (splashBarFill) splashBarFill.style.width = `${splashProgress}%`
  if (splashProgress > 88) clearInterval(splashTimer)
}, 80)

// Durée minimale d'affichage de l'écran de chargement : render() ne bloque pas, donc sans ce
// délai le splash disparaît quasi instantanément (le montage React prend quelques ms, pas les
// 1,5-2s voulues pour que l'animation de la barre soit visible).
const SPLASH_MIN_DURATION = 1600
const splashStart = performance.now()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Retire l'écran de chargement statique (voir index.html) une fois la durée minimale écoulée
// (ou immédiatement si le montage React a lui-même dépassé ce délai).
const remaining = Math.max(0, SPLASH_MIN_DURATION - (performance.now() - splashStart))
setTimeout(() => {
  clearInterval(splashTimer)
  if (splashBarFill) splashBarFill.style.width = '100%'
  setTimeout(() => document.getElementById('app-splash')?.remove(), 200)
}, remaining)
