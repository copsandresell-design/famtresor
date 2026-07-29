import type { PointsTransaction } from '../types'

export function computePoints(pointsTransactions: PointsTransaction[], childId: string): number {
  return pointsTransactions.filter((p) => p.childId === childId).reduce((sum, p) => sum + p.amount, 0)
}

/**
 * Total des points gagnés à vie (somme des gains uniquement, jamais des dépenses) : sert de
 * base au système de rangs — contrairement à computePoints (solde dépensable), ne redescend
 * jamais quand l'enfant dépense ses points en boutique.
 */
export function computeLifetimePoints(pointsTransactions: PointsTransaction[], childId: string): number {
  return pointsTransactions
    .filter((p) => p.childId === childId && p.amount > 0)
    .reduce((sum, p) => sum + p.amount, 0)
}
