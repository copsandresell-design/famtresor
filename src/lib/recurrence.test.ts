import { describe, expect, it } from 'vitest'
import { isTaskAvailable } from './recurrence'
import type { Task, TaskSubmission } from '../types'

const CHILD = 'child-1'

function makeTask(partial: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Test',
    amount: 150,
    category: 'menage',
    icon: '🧹',
    type: 'recurrente',
    assignedTo: [CHILD],
    difficulty: 'easy',
    createdBy: 'parent-1',
    createdAt: 0,
    isActive: true,
    ...partial,
  }
}

function makeSub(submittedAt: Date, status: TaskSubmission['status'] = 'pending'): TaskSubmission {
  return {
    id: `sub-${submittedAt.getTime()}`,
    taskId: 'task-1',
    childId: CHILD,
    status,
    isInitiative: false,
    submittedAt: submittedAt.getTime(),
    bonusApplied: false,
  }
}

// Mercredi 22 juillet 2026, 10 h.
const NOW = new Date('2026-07-22T10:00:00')

describe('isTaskAvailable', () => {
  it('refuse une tâche inactive ou non assignée', () => {
    expect(isTaskAvailable(makeTask({ isActive: false }), CHILD, [], NOW)).toBe(false)
    expect(isTaskAvailable(makeTask({ assignedTo: ['autre'] }), CHILD, [], NOW)).toBe(false)
  })

  it('ponctuelle : une seule fois, mais un refus redonne sa chance', () => {
    const task = makeTask({ type: 'ponctuelle', recurrence: undefined })
    expect(isTaskAvailable(task, CHILD, [], NOW)).toBe(true)
    expect(isTaskAvailable(task, CHILD, [makeSub(new Date('2026-07-20T09:00:00'))], NOW)).toBe(false)
    expect(
      isTaskAvailable(task, CHILD, [makeSub(new Date('2026-07-20T09:00:00'), 'rejected')], NOW),
    ).toBe(true)
  })

  it('quotidienne : une fois par jour', () => {
    const task = makeTask({ recurrence: { frequency: 'daily' } })
    expect(isTaskAvailable(task, CHILD, [makeSub(new Date('2026-07-22T08:00:00'))], NOW)).toBe(false)
    expect(isTaskAvailable(task, CHILD, [makeSub(new Date('2026-07-21T08:00:00'))], NOW)).toBe(true)
  })

  it('2×/semaine : plafond de deux par semaine', () => {
    const task = makeTask({ recurrence: { frequency: 'twice-weekly' } })
    const one = [makeSub(new Date('2026-07-20T08:00:00'))]
    const two = [...one, makeSub(new Date('2026-07-21T08:00:00'))]
    expect(isTaskAvailable(task, CHILD, one, NOW)).toBe(true)
    expect(isTaskAvailable(task, CHILD, two, NOW)).toBe(false)
  })

  it('hebdomadaire : à partir de son jour, une fois par semaine', () => {
    const task = makeTask({ recurrence: { frequency: 'weekly', dayOfWeek: 5 } })
    const saturday = new Date('2026-07-25T10:00:00')
    expect(isTaskAvailable(task, CHILD, [], NOW)).toBe(false)
    expect(isTaskAvailable(task, CHILD, [], saturday)).toBe(true)
    expect(isTaskAvailable(task, CHILD, [makeSub(saturday)], new Date('2026-07-26T10:00:00'))).toBe(false)
  })

  it('mensuelle : à partir de son jour, une fois par mois', () => {
    const task = makeTask({ recurrence: { frequency: 'monthly', dayOfMonth: 15 } })
    expect(isTaskAvailable(task, CHILD, [], new Date('2026-07-10T10:00:00'))).toBe(false)
    expect(isTaskAvailable(task, CHILD, [], NOW)).toBe(true)
    expect(isTaskAvailable(task, CHILD, [makeSub(new Date('2026-07-16T10:00:00'))], NOW)).toBe(false)
  })
})
