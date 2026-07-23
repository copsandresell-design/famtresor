import { format, subDays } from 'date-fns'
import type { TaskSubmission } from '../types'

export interface Streak {
  count: number
  doneToday: boolean
  /** Les 7 derniers jours (le plus ancien en premier), true = au moins une tâche signalée. */
  last7: boolean[]
}

const dayKey = (d: Date | number) => format(d, 'yyyy-MM-dd')

/**
 * Série de jours consécutifs avec au moins une tâche signalée (hors refus).
 * Si rien aujourd'hui, la série d'hier tient encore — elle se joue aujourd'hui.
 */
export function computeStreak(
  childId: string,
  submissions: TaskSubmission[],
  now: Date = new Date(),
): Streak {
  const days = new Set(
    submissions
      .filter((s) => s.childId === childId && s.status !== 'rejected')
      .map((s) => dayKey(s.submittedAt)),
  )
  const doneToday = days.has(dayKey(now))
  let count = 0
  let cursor = doneToday ? now : subDays(now, 1)
  while (days.has(dayKey(cursor))) {
    count++
    cursor = subDays(cursor, 1)
  }
  const last7 = Array.from({ length: 7 }, (_, i) => days.has(dayKey(subDays(now, 6 - i))))
  return { count, doneToday, last7 }
}
