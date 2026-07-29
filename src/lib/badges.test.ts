import { describe, expect, it } from 'vitest'
import { computeBadges } from './badges'
import type { PointsTransaction, TaskSubmission, User } from '../types'

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

function gain(childId: string, points: number, dateIso: string): PointsTransaction {
  return {
    id: `ptx-${++seq}`,
    type: 'task_approval',
    childId,
    amount: points,
    description: 'test',
    createdBy: 'parent-1',
    createdAt: new Date(dateIso).getTime(),
  }
}

function badge(id: string, ctx: { submissions?: TaskSubmission[]; pointsTransactions?: PointsTransaction[] }) {
  return computeBadges({
    childId: CHILD,
    submissions: ctx.submissions ?? [],
    pointsTransactions: ctx.pointsTransactions ?? [],
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

  it('MVP du mois : meilleur gain du mois, jamais à 0 point', () => {
    expect(badge('month-mvp', {}).unlocked).toBe(false)
    const ptxs = [gain(CHILD, 50, '2026-07-10T10:00:00'), gain(OTHER, 30, '2026-07-11T10:00:00')]
    expect(badge('month-mvp', { pointsTransactions: ptxs }).unlocked).toBe(true)
    const behind = [gain(CHILD, 20, '2026-07-10T10:00:00'), gain(OTHER, 30, '2026-07-11T10:00:00')]
    expect(badge('month-mvp', { pointsTransactions: behind }).unlocked).toBe(false)
  })

  it('teamplayer : points cumulés de la fratrie sur le mois (seuil 400)', () => {
    const ptxs = [gain(CHILD, 250, '2026-07-10T10:00:00'), gain(OTHER, 200, '2026-07-11T10:00:00')]
    expect(badge('teamplayer', { pointsTransactions: ptxs }).unlocked).toBe(true)
    expect(badge('teamplayer', { pointsTransactions: ptxs.slice(0, 1) }).unlocked).toBe(false)
  })
})
