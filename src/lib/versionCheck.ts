// Filet de sécurité indépendant du cycle de vie du service worker (voir main.tsx /
// UpdateBanner.tsx pour le mécanisme nominal skipWaiting/controllerchange).
//
// Root cause visée : bug WebKit historique (bugs.webkit.org #199110) — sur une PWA ajoutée
// à l'écran d'accueil iOS, quand le processus réseau iOS est suspendu (systématique en
// arrière-plan), un nouveau service worker "waiting" peut ne jamais s'activer tout seul,
// même avec skipWaiting(). Partiellement corrigé en iOS 16, mais reste capricieux sur les
// PWA installées en iOS 17/18. Ce module ne dépend d'AUCUN service worker : il compare un
// identifiant de build à chaque lancement et, en cas de différence, nettoie tout
// (service workers + caches) et recharge — donc marche même si le SW n'a jamais atteint
// l'état "waiting" correctement.
const VERSION_KEY = 'kidsup_app_version'
const JUST_UPDATED_KEY = 'kidsup_just_updated'

interface VersionPayload {
  version?: string
}

/**
 * À appeler une fois au démarrage (main.tsx). Asynchrone, jamais bloquant : toute erreur
 * (hors ligne, réseau indisponible…) est avalée silencieusement, l'affichage de l'app ne
 * doit jamais attendre ni dépendre de cette vérification.
 */
export async function checkForNewVersion(): Promise<void> {
  // On vient de recharger suite à une MAJ détectée : la version stockée est déjà à jour,
  // pas la peine de refaire un cycle complet immédiatement (protection anti-boucle).
  if (sessionStorage.getItem(JUST_UPDATED_KEY)) {
    sessionStorage.removeItem(JUST_UPDATED_KEY)
    return
  }

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const payload = (await res.json()) as VersionPayload
    if (!payload.version) return

    const stored = localStorage.getItem(VERSION_KEY)
    if (!stored) {
      // Premier lancement : on mémorise silencieusement, rien à recharger.
      localStorage.setItem(VERSION_KEY, payload.version)
      return
    }
    if (stored === payload.version) return

    // Nouvelle version détectée. On pose le flag et on met à jour le stockage AVANT de
    // toucher aux service workers/caches : même si le reload échouait, le prochain
    // lancement ne redéclenchera pas indéfiniment le même nettoyage.
    sessionStorage.setItem(JUST_UPDATED_KEY, '1')
    localStorage.setItem(VERSION_KEY, payload.version)

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }

    window.location.reload()
  } catch {
    // Hors ligne ou réseau indisponible : on ne bloque jamais l'app pour ça.
  }
}
