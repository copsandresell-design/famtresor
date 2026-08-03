import type { PointsTransaction } from '../types'

export type LoanStatus = 'active' | 'repaid'

/**
 * Un prêt entre enfants n'est jamais stocké comme une entité séparée — pas de nouvelle table à
 * synchroniser, pas de risque de désynchro entre "l'entité prêt" et "les points réellement
 * transférés". Il est entièrement reconstruit à partir du journal de pointsTransactions : une
 * paire ('points_loan_sent' / 'points_loan_received') liée par relatedTo pour l'origine, puis
 * d'éventuels remboursements ('points_loan_repay_sent' / '_received', même relatedTo).
 */
export interface PointsLoan {
  /** Id de la transaction 'points_loan_sent' d'origine — sert d'identifiant du prêt. */
  id: string
  lenderId: string
  borrowerId: string
  amount: number
  remaining: number
  status: LoanStatus
  createdAt: number
}

export function computeLoans(pointsTransactions: PointsTransaction[]): PointsLoan[] {
  const sent = pointsTransactions.filter((p) => p.type === 'points_loan_sent')
  const loans: PointsLoan[] = []
  for (const s of sent) {
    const received = pointsTransactions.find((p) => p.type === 'points_loan_received' && p.relatedTo === s.id)
    if (!received) continue
    const amount = Math.abs(s.amount)
    const repaid = pointsTransactions
      .filter((p) => p.type === 'points_loan_repay_received' && p.relatedTo === s.id)
      .reduce((sum, p) => sum + p.amount, 0)
    const remaining = Math.max(0, amount - repaid)
    loans.push({
      id: s.id,
      lenderId: s.childId,
      borrowerId: received.childId,
      amount,
      remaining,
      status: remaining <= 0 ? 'repaid' : 'active',
      createdAt: s.createdAt,
    })
  }
  return loans.sort((a, b) => b.createdAt - a.createdAt)
}

/** Prêts où cet enfant est concerné (prêteur ou emprunteur), du plus récent au plus ancien. */
export function loansForChild(pointsTransactions: PointsTransaction[], childId: string): PointsLoan[] {
  return computeLoans(pointsTransactions).filter((l) => l.lenderId === childId || l.borrowerId === childId)
}
