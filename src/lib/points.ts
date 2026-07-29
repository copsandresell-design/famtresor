import type { PointsTransaction } from '../types'

export function computePoints(pointsTransactions: PointsTransaction[], childId: string): number {
  return pointsTransactions.filter((p) => p.childId === childId).reduce((sum, p) => sum + p.amount, 0)
}
