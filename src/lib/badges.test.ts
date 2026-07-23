import { describe, expect, it } from 'vitest'
import { computeBadges } from './badges'
import type { TaskSubmission, Transaction, User } from '../types'

const CHILD = 'child-1'
const OTHER = 'child-2'
const NOW = new Date('2026-07-22T18:00:00')

const children = [
  { id: CHILD, role: 'child', name: 'A', isActive: true },
  { id: OTHER, role: 'child', name: 'B', isActive: true },
] as User[]

let seq = 0
function approvedSub(dateIso: string, opts?: Partial<TaskSubmission>): TaskSubmission {
  const ts = new Date(dateIso).getTime()
  return {
    id: `sub-${++seq}`,
    taskId: 'task-1',
    childId: CHILD,
    status: 'approved',
    isInitiative: false,
    submittedAt: ts,
    reviewedAt: ts + 30 * 60 * 1000,
    bonusApplied: false,
    ...opts,
  }
}

function gain(childId: string, amount: number, dateIso: string): Transaction {
  return {
    id: `tx-${++seq}`,
    type: 'task_approval',
    childId,
    amount,
    description: 'test',
    createdBy: 'parent-1',
    createdAt: new Date(dateIso).getTime(),
  }
}

function badge(id: string, ctx: { submissions?: TaskSubmission[]; transactions?: Transaction[] }) {
  return computeBadges({
    childId: CHILD,
    submissions: ctx.submissions ?? [],
    transactions: ctx.transactions ?? [],
    children,
    now: NOW,
  }).find((b) => b.id === id)!
}

describe('computeBadges', () => {
  it('démarrage : débloqué à la première validation', () => {
    expect(badge('demarrage', {}).unlocked).toBe(false)
    expect(badge('demarrage', { submissions: [approvedSub('2026-07-20T10:00:00')] }).unlocked).toBe(true)
  })

  it('rapidité : validation en moins d’une heure', () => {
    const slow = approvedSub('2026-07-20T10:00:00', {
      reviewedAt: new Date('2026-07-20T13:00:00').getTime(),
    })
    expect(badge('rapidite', { submissions: [slow] }).unlocked).toBe(false)
    expect(badge('rapidite', { submissions: [approvedSub('2026-07-20T10:00:00')] }).unlocked).toBe(true)
  })

  it('initiative master : progression puis déblocage à 10', () => {
    const subs = Array.from({ length: 10 }, (_, i) =>
      approvedSub(`2026-07-${String(i + 1).padStart(2, '0')}T10:00:00`, { isInitiative: true }),
    )
    expect(badge('initiative-master', { submissions: subs.slice(0, 4) }).progress).toEqual({
      current: 4,
      target: 10,
    })
    expect(badge('initiative-master', { submissions: subs }).unlocked).toBe(true)
  })

  it('MVP du mois : meilleur gain du mois, jamais à 0 €', () => {
    expect(badge('month-mvp', {}).unlocked).toBe(false)
    const txs = [gain(CHILD, 500, '2026-07-10T10:00:00'), gain(OTHER, 300, '2026-07-11T10:00:00')]
    expect(badge('month-mvp', { transactions: txs }).unlocked).toBe(true)
    const behind = [gain(CHILD, 200, '2026-07-10T10:00:00'), gain(OTHER, 300, '2026-07-11T10:00:00')]
    expect(badge('month-mvp', { transactions: behind }).unlocked).toBe(false)
  })

  it('teamplayer : gains cumulés de la fratrie sur le mois', () => {
    const txs = [gain(CHILD, 1500, '2026-07-10T10:00:00'), gain(OTHER, 1000, '2026-07-11T10:00:00')]
    expect(badge('teamplayer', { transactions: txs }).unlocked).toBe(true)
    expect(badge('teamplayer', { transactions: txs.slice(0, 1) }).unlocked).toBe(false)
  })
})
