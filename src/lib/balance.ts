import type { Transaction } from '../types'

export function computeBalance(transactions: Transaction[], childId: string): number {
  return transactions
    .filter((t) => t.childId === childId)
    .reduce((sum, t) => sum + t.amount, 0)
}
