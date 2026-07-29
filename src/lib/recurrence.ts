import { getDate, getDay, isSameDay, isSameMonth, isSameWeek } from 'date-fns'
import type { Task, TaskSubmission } from '../types'

export const DAYS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

const WEEK = { weekStartsOn: 1 as const }

/** Index du jour avec 0 = lundi … 6 = dimanche. */
function mondayIndex(date: Date): number {
  return (getDay(date) + 6) % 7
}

function activeSubmissions(task: Task, childId: string, submissions: TaskSubmission[]): TaskSubmission[] {
  return submissions.filter(
    (s) => s.taskId === task.id && s.childId === childId && s.status !== 'rejected',
  )
}

/** Combien de fois cette tâche a déjà été signalée aujourd'hui (hors refus, qui redonnent leur chance). */
export function timesSubmittedToday(
  task: Task,
  childId: string,
  submissions: TaskSubmission[],
  now: Date = new Date(),
): number {
  return activeSubmissions(task, childId, submissions).filter((s) => isSameDay(s.submittedAt, now)).length
}

/**
 * Combien de validations (approuvées) de cette même tâche existent déjà le même jour, avant
 * `submission` — sert de base au rendement dégressif des tâches répétables (voir
 * computeTaskPoints dans lib/points.ts). 0 pour la première validation du jour.
 */
export function approvedOccurrenceIndexToday(
  taskId: string,
  childId: string,
  submission: TaskSubmission,
  submissions: TaskSubmission[],
): number {
  return submissions.filter(
    (s) =>
      s.taskId === taskId &&
      s.childId === childId &&
      s.status === 'approved' &&
      s.id !== submission.id &&
      isSameDay(s.submittedAt, submission.submittedAt) &&
      s.submittedAt < submission.submittedAt,
  ).length
}

/**
 * Une tâche est disponible si l'enfant peut la signaler maintenant :
 * - ponctuelle : jamais signalée (hors refus, qui redonne sa chance)
 * - quotidienne : moins de `dailyLimit` fois aujourd'hui (défaut 1)
 * - 2×/semaine : moins de 2 fois cette semaine, ET moins de `dailyLimit` fois aujourd'hui
 * - hebdomadaire : à partir de son jour, une fois par semaine, ET moins de `dailyLimit` fois aujourd'hui
 * - mensuelle : à partir de son jour, une fois par mois, ET moins de `dailyLimit` fois aujourd'hui
 */
export function isTaskAvailable(
  task: Task,
  childId: string,
  submissions: TaskSubmission[],
  now: Date = new Date(),
): boolean {
  if (!task.isActive || !task.assignedTo.includes(childId)) return false
  const mine = activeSubmissions(task, childId, submissions)

  if (task.type === 'ponctuelle') return mine.length === 0

  const r = task.recurrence
  if (!r) return false
  const dailyLimit = task.dailyLimit ?? 1
  const underDailyLimit = timesSubmittedToday(task, childId, submissions, now) < dailyLimit

  switch (r.frequency) {
    case 'daily':
      return underDailyLimit
    case 'twice-weekly':
      return mine.filter((s) => isSameWeek(s.submittedAt, now, WEEK)).length < 2 && underDailyLimit
    case 'weekly':
      return (
        mondayIndex(now) >= (r.dayOfWeek ?? 0) &&
        !mine.some((s) => isSameWeek(s.submittedAt, now, WEEK)) &&
        underDailyLimit
      )
    case 'monthly':
      return (
        getDate(now) >= (r.dayOfMonth ?? 1) &&
        !mine.some((s) => isSameMonth(s.submittedAt, now)) &&
        underDailyLimit
      )
  }
}

export function describeRecurrence(task: Task): string {
  if (task.type === 'ponctuelle') return 'Une fois'
  const r = task.recurrence
  if (!r) return ''
  switch (r.frequency) {
    case 'daily':
      return 'Chaque jour'
    case 'twice-weekly':
      return '2× par semaine'
    case 'weekly':
      return `Chaque ${DAYS_FR[r.dayOfWeek ?? 0]}`
    case 'monthly':
      return `Le ${r.dayOfMonth ?? 1} du mois`
  }
}
