import { isSameMonth, isSameWeek, startOfWeek, subWeeks } from 'date-fns'
import { computeStreak } from './streak'
import type { TaskSubmission, Transaction, User } from '../types'

const WEEK = { weekStartsOn: 1 as const }
const HOUR = 60 * 60 * 1000

export interface BadgeState {
  id: string
  emoji: string
  label: string
  description: string
  unlocked: boolean
  /** Progression vers le déblocage (absente pour les badges tout-ou-rien). */
  progress?: { current: number; target: number; unit?: string }
}

interface BadgeContext {
  childId: string
  submissions: TaskSubmission[]
  transactions: Transaction[]
  children: User[]
  now?: Date
}

export function computeBadges({ childId, submissions, transactions, children, now = new Date() }: BadgeContext): BadgeState[] {
  const mine = submissions.filter((s) => s.childId === childId)
  const approved = mine.filter((s) => s.status === 'approved')
  const gains = transactions.filter((t) => t.type === 'task_approval')
  const earnedOf = (id: string, filter?: (t: Transaction) => boolean) =>
    gains.filter((t) => t.childId === id && (!filter || filter(t))).reduce((sum, t) => sum + t.amount, 0)

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

  return [
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
      description: '10 € ou plus gagnés en une semaine',
      unlocked: bestWeek >= 1000,
      progress: { current: Math.min(Math.floor(bestWeek / 100), 10), target: 10, unit: '€' },
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
      description: '25 € gagnés par toute la fratrie ce mois-ci',
      unlocked: familyMonth >= 2500,
      progress: { current: Math.min(Math.floor(familyMonth / 100), 25), target: 25, unit: '€' },
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
      description: '100 € gagnés en tout',
      unlocked: earned >= 10000,
      progress: { current: Math.min(Math.floor(earned / 100), 100), target: 100, unit: '€' },
    },
  ]
}
