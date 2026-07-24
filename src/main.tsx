import '@fontsource-variable/inter'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

// PWA : sans Ã§a, une app installÃ©e sur mobile peut rester bloquÃ©e indÃ©finiment sur une
// vieille version tant qu'on ne la dÃ©sinstalle pas â le navigateur ne revÃ©rifie les mises
// Ã  jour que rarement. On force la vÃ©rification Ã  chaque retour au premier plan et on
// recharge automatiquement dÃ¨s qu'un nouveau service worker prend la main.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  const updateSW = registerSW({
    immediate: true,
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
  void updateSW
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
