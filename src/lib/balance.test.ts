import { describe, expect, it } from 'vitest'
import { computeBalance } from './balance'
import type { Transaction } from '../types'

function tx(childId: string, amount: number, type: Transaction['type'] = 'task_approval'): Transaction {
  return {
    id: `${childId}-${amount}-${Math.random()}`,
    type,
    childId,
    amount,
    description: 'test',
    createdBy: 'parent-1',
    createdAt: Date.now(),
  }
}

describe('computeBalance', () => {
  it('additionne uniquement les transactions de l’enfant', () => {
    const transactions = [tx('a', 150), tx('a', 200), tx('b', 500)]
    expect(computeBalance(transactions, 'a')).toBe(350)
    expect(computeBalance(transactions, 'b')).toBe(500)
    expect(computeBalance(transactions, 'c')).toBe(0)
  })

  it('une pénalité annulée est neutre (pénalité + contre-passation)', () => {
    const transactions = [tx('a', 300), tx('a', -100, 'penalty'), tx('a', 100, 'penalty_cancel')]
    expect(computeBalance(transactions, 'a')).toBe(300)
  })
})
