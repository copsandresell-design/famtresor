// Pont entre l'enregistrement du service worker (main.tsx, hors React) et le composant
// React qui affiche le bandeau "Nouvelle version disponible" (voir UpdateBanner.tsx).
//
// Root cause du bug "il faut désinstaller pour avoir la dernière version" : un nouveau
// SW installé reste en état "waiting" tant qu'on ne l'active pas explicitement
// (skipWaiting) — sans onNeedRefresh câblé, ça n'arrivait jamais, et le navigateur ne
// réactive un SW en attente que quand TOUS les onglets du site sont fermés puis rouverts,
// ce qui n'arrive presque jamais sur une PWA installée qu'on laisse en arrière-plan.

type Listener = () => void

let needRefresh = false
let applyUpdateFn: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<Listener>()

export function setNeedRefresh(updateSW: (reload?: boolean) => Promise<void>): void {
  applyUpdateFn = updateSW
  needRefresh = true
  listeners.forEach((l) => l())
}

export function isUpdateAvailable(): boolean {
  return needRefresh
}

export function applyPwaUpdate(): void {
  void applyUpdateFn?.(true)
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
