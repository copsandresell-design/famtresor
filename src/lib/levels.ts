import type { TaskSubmission } from '../types'

// Progression par niveaux : 5 tâches validées = 1 niveau.
export const TASKS_PER_LEVEL = 5

const TITLES = [
  'Petit écureuil 🐿️',
  'Apprenti chasseur',
  'Explorateur',
  'Aventurier',
  'Chasseur de trésor',
  'Champion',
  'Maître du coffre',
  'Légende 🏆',
]

export interface LevelState {
  level: number
  title: string
  /** Tâches validées depuis le dernier niveau (0 à TASKS_PER_LEVEL-1) */
  progress: number
  target: number
  totalApproved: number
}

export function computeLevel(childId: string, submissions: TaskSubmission[]): LevelState {
  const totalApproved = submissions.filter(
    (s) => s.childId === childId && s.status === 'approved',
  ).length
  const level = Math.floor(totalApproved / TASKS_PER_LEVEL) + 1
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    progress: totalApproved % TASKS_PER_LEVEL,
    target: TASKS_PER_LEVEL,
    totalApproved,
  }
}
