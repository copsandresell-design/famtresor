import { isSameMonth, isSameWeek, startOfWeek, subWeeks } from 'date-fns'
import { computeStreak } from './streak'
import type { PointsTransaction, TaskSubmission, User } from '../types'

const WEEK = { weekStartsOn: 1 as const }
const HOUR = 60 * 60 * 1000

export interface BadgeState {
  id: string
  emoji: string
  label: string
  description: string
  unlocked: boolean
  /** Points gagnés (monnaie séparée de l'argent) au déblocage. */
  points: number
  /** Progression vers le déblocage (absente pour les badges tout-ou-rien). */
  progress?: { current: number; target: number; unit?: string }
}

/** Points crédités une fois par enfant quand le badge se débloque (voir useStore.checkRewards). */
export const BADGE_POINTS: Record<string, number> = {
  demarrage: 20,
  streaker: 30,
  rapidite: 25,
  'initiative-master': 100,
  'golden-week': 80,
  perfectionist: 60,
  teamplayer: 50,
  'month-mvp': 150,
  millionaire: 200,
}

interface BadgeContext {
  childId: string
  submissions: TaskSubmission[]
  pointsTransactions: PointsTransaction[]
  children: User[]
  now?: Date
}

export function computeBadges({
  childId,
  submissions,
  pointsTransactions,
  children,
  now = new Date(),
}: BadgeContext): BadgeState[] {
  const mine = submissions.filter((s) => s.childId === childId)
  const approved = mine.filter((s) => s.status === 'approved')
  const gains = pointsTransactions.filter((p) => p.type === 'task_approval')
  const earnedOf = (id: string, filter?: (p: PointsTransaction) => boolean) =>
    gains.filter((p) => p.childId === id && (!filter || filter(p))).reduce((sum, p) => sum + p.amount, 0)

  const earned = earnedOf(childId)
  const monthEarned = earnedOf(childId, (t) => isSameMonth(t.createdAt, now))
  const initiativeCount = approved.filter((s) => s.isInitiative).length
  const streak = computeStreak(childId, submissions, now)
  const monthApproved = approved.filter((s) => s.reviewedAt && isSameMonth(s.reviewedAt, now)).length
  const monthRejected = mine.filter(
    (s) => s.status === 'rejected' && s.reviewedAt && isSameMonth(s.reviewedAt, now),
  ).length
  const bestWeek = Math.max(
    0,
    ...Array.from({ length: 12 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, i), WEEK)
      return earnedOf(childId, (t) => isSameWeek(t.createdAt, weekStart, WEEK))
    }),
  )
  const familyMonth = children.reduce(
    (sum, c) => sum + earnedOf(c.id, (t) => isSameMonth(t.createdAt, now)),
    0,
  )
  const isMvp =
    monthEarned > 0 &&
    children.every((c) => c.id === childId || earnedOf(c.id, (t) => isSameMonth(t.createdAt, now)) <= monthEarned)

  const entries: Omit<BadgeState, 'points'>[] = [
    {
      id: 'demarrage',
      emoji: '🚀',
      label: 'Démarrage',
      description: 'Première tâche validée',
      unlocked: approved.length >= 1,
    },
    {
      id: 'streaker',
      emoji: '🔥',
      label: 'Streaker',
      description: '5 jours d’affilée avec une tâche',
      unlocked: streak.count >= 5,
      progress: { current: Math.min(streak.count, 5), target: 5, unit: 'jours' },
    },
    {
      id: 'rapidite',
      emoji: '⚡',
      label: 'Rapidité',
      description: 'Tâche validée moins d’une heure après l’envoi',
      unlocked: approved.some((s) => s.reviewedAt !== undefined && s.reviewedAt - s.submittedAt <= HOUR),
    },
    {
      id: 'initiative-master',
      emoji: '⭐',
      label: 'Initiative Master',
      description: '10 tâches faites sans qu’on te le demande',
      unlocked: initiativeCount >= 10,
      progress: { current: Math.min(initiativeCount, 10), target: 10 },
    },
    {
      id: 'golden-week',
      emoji: '🏆',
      label: 'Golden Week',
      description: '150 points ou plus gagnés en une semaine',
      unlocked: bestWeek >= 150,
      progress: { current: Math.min(bestWeek, 150), target: 150, unit: 'pts' },
    },
    {
      id: 'perfectionist',
      emoji: '💎',
      label: 'Perfectionist',
      description: '5 validations et zéro refus ce mois-ci',
      unlocked: monthApproved >= 5 && monthRejected === 0,
      progress: { current: Math.min(monthApproved, 5), target: 5 },
    },
    {
      id: 'teamplayer',
      emoji: '🤝',
      label: 'Teamplayer',
      description: '400 points cumulés par toute la fratrie ce mois-ci',
      unlocked: familyMonth >= 400,
      progress: { current: Math.min(familyMonth, 400), target: 400, unit: 'pts' },
    },
    {
      id: 'month-mvp',
      emoji: '👑',
      label: 'MVP du mois',
      description: 'Meilleur gain de la famille ce mois-ci',
      unlocked: isMvp,
    },
    {
      id: 'millionaire',
      emoji: '💰',
      label: 'Centenaire',
      description: '1000 points gagnés en tout',
      unlocked: earned >= 1000,
      progress: { current: Math.min(earned, 1000), target: 1000, unit: 'pts' },
    },
  ]

  return entries.map((entry) => ({ ...entry, points: BADGE_POINTS[entry.id] ?? 0 }))
}
