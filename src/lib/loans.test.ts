import { describe, expect, it } from 'vitest'
import { computeLoans, loansForChild } from './loans'
import type { PointsTransaction } from '../types'

const LENDER = 'lender-1'
const BORROWER = 'borrower-1'
const OTHER = 'other-1'

let seq = 0
function ptx(patch: Partial<PointsTransaction> & Pick<PointsTransaction, 'childId' | 'type' | 'amount'>): PointsTransaction {
  seq += 1
  return {
    id: `tx-${seq}`,
    description: 'test',
    createdBy: 'parent-1',
    createdAt: Date.now() + seq,
    ...patch,
  }
}

function makeLoan(amount: number, lenderId = LENDER, borrowerId = BORROWER) {
  const sent = ptx({ childId: lenderId, type: 'points_loan_sent', amount: -amount })
  const received = ptx({ childId: borrowerId, type: 'points_loan_received', amount, relatedTo: sent.id })
  return { sent, received }
}

describe('computeLoans', () => {
  it("vaut une liste vide sans transaction de prêt", () => {
    expect(computeLoans([])).toEqual([])
  })

  it('reconstruit un prêt actif depuis la paire sent/received', () => {
    const { sent, received } = makeLoan(50)
    const loans = computeLoans([sent, received])
    expect(loans).toHaveLength(1)
    expect(loans[0]).toMatchObject({
      id: sent.id,
      lenderId: LENDER,
      borrowerId: BORROWER,
      amount: 50,
      remaining: 50,
      status: 'active',
    })
  })

  it("ignore un 'points_loan_sent' sans réception correspondante (jamais censé arriver)", () => {
    const orphan = ptx({ childId: LENDER, type: 'points_loan_sent', amount: -50 })
    expect(computeLoans([orphan])).toEqual([])
  })

  it('réduit le restant dû après un remboursement partiel', () => {
    const { sent, received } = makeLoan(50)
    const repaySent = ptx({ childId: BORROWER, type: 'points_loan_repay_sent', amount: -20, relatedTo: sent.id })
    const repayReceived = ptx({ childId: LENDER, type: 'points_loan_repay_received', amount: 20, relatedTo: sent.id })
    const loans = computeLoans([sent, received, repaySent, repayReceived])
    expect(loans[0].remaining).toBe(30)
    expect(loans[0].status).toBe('active')
  })

  it('passe à "repaid" une fois le solde à zéro', () => {
    const { sent, received } = makeLoan(50)
    const repaySent = ptx({ childId: BORROWER, type: 'points_loan_repay_sent', amount: -50, relatedTo: sent.id })
    const repayReceived = ptx({ childId: LENDER, type: 'points_loan_repay_received', amount: 50, relatedTo: sent.id })
    const loans = computeLoans([sent, received, repaySent, repayReceived])
    expect(loans[0].remaining).toBe(0)
    expect(loans[0].status).toBe('repaid')
  })

  it('ne compte pas les dons (points_gift_*) comme des prêts', () => {
    const sent = ptx({ childId: LENDER, type: 'points_gift_sent', amount: -50 })
    const received = ptx({ childId: BORROWER, type: 'points_gift_received', amount: 50, relatedTo: sent.id })
    expect(computeLoans([sent, received])).toEqual([])
  })

  it('trie du prêt le plus récent au plus ancien', () => {
    const older = makeLoan(10)
    const newer = makeLoan(20)
    const loans = computeLoans([older.sent, older.received, newer.sent, newer.received])
    expect(loans.map((l) => l.amount)).toEqual([20, 10])
  })
})

describe('loansForChild', () => {
  it('renvoie les prêts où l’enfant est prêteur ou emprunteur, pas les autres', () => {
    const { sent, received } = makeLoan(50)
    const unrelated = makeLoan(15, OTHER, BORROWER)
    const all = [sent, received, unrelated.sent, unrelated.received]
    expect(loansForChild(all, LENDER)).toHaveLength(1)
    expect(loansForChild(all, BORROWER)).toHaveLength(2)
    expect(loansForChild(all, OTHER)).toHaveLength(1)
  })
})
