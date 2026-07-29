import type { RankDef } from '../types'

export interface RankState {
  rank: RankDef
  index: number
  next: RankDef | null
  /** Points gagnés depuis le seuil du rang actuel. */
  progress: number
  /** Points nécessaires pour atteindre le rang suivant depuis le rang actuel (0 si rang final). */
  target: number
}

/**
 * Rang courant à partir du total de points gagnés à vie (computeLifetimePoints) — ne dépend
 * jamais du solde dépensable, ne redescend donc jamais tant que lifetimePoints ne redescend pas.
 */
export function computeRank(lifetimePoints: number, rankDefs: RankDef[]): RankState {
  const sorted = [...rankDefs].sort((a, b) => a.threshold - b.threshold)
  let index = 0
  for (let i = 0; i < sorted.length; i++) {
    if (lifetimePoints >= sorted[i].threshold) index = i
  }
  const rank = sorted[index]
  const next = sorted[index + 1] ?? null
  return {
    rank,
    index,
    next,
    progress: lifetimePoints - rank.threshold,
    target: next ? next.threshold - rank.threshold : 0,
  }
}

/** Échelle par défaut — seuils cohérents avec le barème des tâches (8 à 75 pts/tâche) et des bonus de séries/badges. */
export const DEFAULT_RANK_DEFS: RankDef[] = [
  { id: 'debutant', label: 'Débutant', emoji: '🌱', color: '#94A3B8', threshold: 0, createdBy: 'system', createdAt: Date.now() },
  { id: 'apprenti', label: 'Apprenti', emoji: '🔧', color: '#22C55E', threshold: 300, createdBy: 'system', createdAt: Date.now() },
  { id: 'serieux', label: 'Sérieux', emoji: '💪', color: '#0EA5E9', threshold: 800, createdBy: 'system', createdAt: Date.now() },
  { id: 'confirme', label: 'Confirmé', emoji: '🎖️', color: '#8B5CF6', threshold: 2000, createdBy: 'system', createdAt: Date.now() },
  { id: 'expert', label: 'Expert', emoji: '🥇', color: '#F59E0B', threshold: 4000, createdBy: 'system', createdAt: Date.now() },
  { id: 'champion-maison', label: 'Champion de la maison', emoji: '🏅', color: '#F97316', threshold: 8000, createdBy: 'system', createdAt: Date.now() },
  { id: 'legende', label: 'Légende de FamTrésor', emoji: '👑', color: '#EAB308', threshold: 15000, createdBy: 'system', createdAt: Date.now() },
]
