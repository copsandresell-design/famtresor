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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Retire l'écran de chargement statique (voir index.html) : le premier rendu React a eu
// le temps d'être peint par-dessus, la transition est donc fluide plutôt qu'un flash.
document.getElementById('app-splash')?.remove()
