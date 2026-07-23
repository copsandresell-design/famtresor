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

/**
 * Une tâche est disponible si l'enfant peut la signaler maintenant :
 * - ponctuelle : jamais signalée (hors refus, qui redonne sa chance)
 * - quotidienne : pas encore signalée aujourd'hui
 * - 2×/semaine : moins de 2 fois cette semaine
 * - hebdomadaire : à partir de son jour, une fois par semaine
 * - mensuelle : à partir de son jour, une fois par mois
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
  switch (r.frequency) {
    case 'daily':
      return !mine.some((s) => isSameDay(s.submittedAt, now))
    case 'twice-weekly':
      return mine.filter((s) => isSameWeek(s.submittedAt, now, WEEK)).length < 2
    case 'weekly':
      return (
        mondayIndex(now) >= (r.dayOfWeek ?? 0) &&
        !mine.some((s) => isSameWeek(s.submittedAt, now, WEEK))
      )
    case 'monthly':
      return (
        getDate(now) >= (r.dayOfMonth ?? 1) &&
        !mine.some((s) => isSameMonth(s.submittedAt, now))
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
