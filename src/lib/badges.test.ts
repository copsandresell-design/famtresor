import { describe, expect, it } from 'vitest'
import { computeBadges } from './badges'
import { DEFAULT_STREAK_DEFS } from './streak'
import type {
  PointsTransaction,
  Redemption,
  RewardClaim,
  SavingsGoal,
  Task,
  TaskSubmission,
  Transaction,
  User,
} from '../types'

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

function badge(
  id: string,
  ctx: {
    submissions?: TaskSubmission[]
    pointsTransactions?: PointsTransaction[]
    transactions?: Transaction[]
    tasks?: Task[]
    savingsGoals?: SavingsGoal[]
    redemptions?: Redemption[]
    rewardClaims?: RewardClaim[]
  },
) {
  return computeBadges({
    childId: CHILD,
    submissions: ctx.submissions ?? [],
    pointsTransactions: ctx.pointsTransactions ?? [],
    transactions: ctx.transactions ?? [],
    tasks: ctx.tasks ?? [],
    savingsGoals: ctx.savingsGoals ?? [],
    redemptions: ctx.redemptions ?? [],
    rewardClaims: ctx.rewardClaims ?? [],
    streakDefs: DEFAULT_STREAK_DEFS,
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

  it('volume à vie : 10 tâches validées', () => {
    const subs = Array.from({ length: 10 }, (_, i) => approvedSub(`2026-0${(i % 6) + 1}-10T10:00:00`))
    expect(badge('tache-10', { submissions: subs.slice(0, 9) }).unlocked).toBe(false)
    expect(badge('tache-10', { submissions: subs }).unlocked).toBe(true)
  })

  it('spécialiste de catégorie : compte les validations de cette catégorie via les tâches', () => {
    const tasks: Task[] = [
      { id: 't-cuisine', title: 'Cuisiner', points: 10, category: 'cuisine', icon: '🍳', type: 'recurrente', assignedTo: [], difficulty: 'easy', createdBy: 'p', createdAt: 0, isActive: true },
      { id: 't-menage', title: 'Nettoyer', points: 10, category: 'menage', icon: '🧹', type: 'recurrente', assignedTo: [], difficulty: 'easy', createdBy: 'p', createdAt: 0, isActive: true },
    ]
    const subs = [
      ...Array.from({ length: 20 }, (_, i) => approvedSub(`2026-0${(i % 6) + 1}-1${i % 9}T10:00:00`, { taskId: 't-cuisine' })),
      approvedSub('2026-01-01T10:00:00', { taskId: 't-menage' }),
    ]
    expect(badge('specialiste-cuisine', { submissions: subs, tasks }).unlocked).toBe(true)
    expect(badge('specialiste-menage', { submissions: subs, tasks }).unlocked).toBe(false)
  })

  it('badge lié à une série (streak_tier) : verrouillage permanent via rewardClaims', () => {
    // Même si la série en cours est retombée à 0, un claim déjà obtenu reste débloqué.
    const claims: RewardClaim[] = [{ id: 'r1', childId: CHILD, key: 'streak:global:7', createdAt: 0 }]
    expect(badge('streaker', { rewardClaims: claims }).unlocked).toBe(true)
    expect(badge('streaker', { rewardClaims: [] }).unlocked).toBe(false)
  })

  it('points cumulés à vie : ne redescend jamais avec les dépenses', () => {
    const ptxs = [gain(CHILD, 600, '2026-07-01T10:00:00'), { ...gain(CHILD, -550, '2026-07-02T10:00:00'), type: 'shop_redeem' as const }]
    expect(badge('points-500', { pointsTransactions: ptxs }).unlocked).toBe(true)
  })

  it('épargne : débloqué dès qu’un objectif est atteint', () => {
    const goals: SavingsGoal[] = [
      { id: 'g1', childId: CHILD, title: 'Vélo', icon: '🚲', targetAmount: 3000, createdBy: 'p', createdAt: 0, achievedAt: Date.now() },
    ]
    expect(badge('epargne', { savingsGoals: goals }).unlocked).toBe(true)
    expect(badge('epargne', { savingsGoals: [] }).unlocked).toBe(false)
  })

  it('premier échange : débloqué à la première rédemption', () => {
    const redemptions: Redemption[] = [
      { id: 'r1', childId: CHILD, itemId: 'i1', title: 'Lot', icon: '🎁', cost: 100, status: 'fulfilled', requestedAt: 0 },
    ]
    expect(badge('premier-echange', { redemptions }).unlocked).toBe(true)
    expect(badge('premier-echange', { redemptions: [] }).unlocked).toBe(false)
  })

  it('zéro pénalité 30 jours : verrouillé dès qu’une pénalité récente existe', () => {
    const recent: Transaction[] = [
      { id: 'p1', type: 'penalty', childId: CHILD, amount: -100, description: 'x', createdBy: 'p', createdAt: NOW.getTime() - 5 * 24 * 60 * 60 * 1000 },
    ]
    expect(badge('zero-penalite-30', { transactions: recent }).unlocked).toBe(false)
    const old: Transaction[] = [
      { id: 'p2', type: 'penalty', childId: CHILD, amount: -100, description: 'x', createdBy: 'p', createdAt: NOW.getTime() - 40 * 24 * 60 * 60 * 1000 },
    ]
    expect(badge('zero-penalite-30', { transactions: old }).unlocked).toBe(true)
  })

  it('famille complète : un jour où tous les enfants actifs ont validé une tâche', () => {
    const day = '2026-07-15T10:00:00'
    const mine = approvedSub(day)
    const others = { ...approvedSub(day), id: 'sub-other', childId: OTHER }
    expect(badge('famille-complete', { submissions: [mine] }).unlocked).toBe(false)
    expect(badge('famille-complete', { submissions: [mine, others] }).unlocked).toBe(true)
  })
})
