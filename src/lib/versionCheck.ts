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
const SUPPRESS_CONTROLLERCHANGE_KEY = 'kidsup_suppress_controllerchange_reload'

interface VersionPayload {
  version?: string
}

/**
 * Verrou partagé entre CE mécanisme et celui, indépendant, du service worker
 * (voir le handler 'controllerchange' dans main.tsx) : les deux détectent la même mise à
 * jour par des voies différentes (comparaison de version.json vs événement du navigateur) et
 * peuvent donc décider de recharger la page chacun de leur côté, en même temps. Sans
 * coordination, ça produit une cascade de rechargements en chaîne (repro : voir l'historique
 * de session) au lieu d'un seul. Quiconque décide de recharger pose ce flag ; l'autre
 * mécanisme, s'il se déclenche juste après (dans le MÊME chargement de page), le trouve déjà
 * posé et renonce à recharger une seconde fois.
 */
export function consumeJustUpdatedFlag(): boolean {
  const wasSet = sessionStorage.getItem(JUST_UPDATED_KEY) === '1'
  if (wasSet) sessionStorage.removeItem(JUST_UPDATED_KEY)
  return wasSet
}

export function markJustUpdated(): void {
  sessionStorage.setItem(JUST_UPDATED_KEY, '1')
}

/**
 * Second verrou, distinct du précédent : quand checkForNewVersion() nettoie tout et recharge,
 * la page rechargée démarre SANS service worker — enregistrer un nouveau (main.tsx) va donc
 * légitimement déclencher SON PROPRE 'controllerchange' (aucun contrôleur → un contrôleur),
 * sur CE prochain chargement, pas celui-ci. consumeJustUpdatedFlag() aura déjà été consommé
 * par checkForNewVersion() elle-même sur ce chargement suivant (pour ne pas relancer tout son
 * cycle de vérification) — sans un verrou séparé qui survit jusqu'à ce 'controllerchange'
 * précis, celui-ci le trouve absent et recharge une troisième fois inutilement.
 */
export function consumeControllerchangeSuppression(): boolean {
  const wasSet = sessionStorage.getItem(SUPPRESS_CONTROLLERCHANGE_KEY) === '1'
  if (wasSet) sessionStorage.removeItem(SUPPRESS_CONTROLLERCHANGE_KEY)
  return wasSet
}

export function suppressNextControllerchangeReload(): void {
  sessionStorage.setItem(SUPPRESS_CONTROLLERCHANGE_KEY, '1')
}

/**
 * À appeler une fois au démarrage (main.tsx). Asynchrone, jamais bloquant : toute erreur
 * (hors ligne, réseau indisponible…) est avalée silencieusement, l'affichage de l'app ne
 * doit jamais attendre ni dépendre de cette vérification.
 */
export async function checkForNewVersion(): Promise<void> {
  // On vient de recharger (ce mécanisme OU celui du service worker, voir plus haut) : la
  // version stockée est déjà à jour, pas la peine de refaire un cycle complet immédiatement
  // (protection anti-boucle).
  if (consumeJustUpdatedFlag()) return

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

    // Deuxième vérification du flag, ICI et pas seulement en haut de la fonction : entre le
    // check du tout début et ce point, on vient d'attendre deux appels réseau (fetch + json).
    // Le handler 'controllerchange' de main.tsx, lui, est synchrone — il a pu détecter la
    // même mise à jour et déjà recharger PENDANT cette attente. Sans cette seconde
    // vérification juste avant d'agir, les deux mécanismes rechargent chacun de leur côté.
    if (consumeJustUpdatedFlag()) return

    // Nouvelle version détectée. On pose les flags et on met à jour le stockage AVANT de
    // toucher aux service workers/caches : même si le reload échouait, le prochain
    // lancement ne redéclenchera pas indéfiniment le même nettoyage.
    markJustUpdated()
    suppressNextControllerchangeReload()
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
