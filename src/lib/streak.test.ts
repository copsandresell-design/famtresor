import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'
import type { TaskSubmission } from '../types'

const CHILD = 'child-1'

function sub(dateIso: string, status: TaskSubmission['status'] = 'approved'): TaskSubmission {
  return {
    id: dateIso,
    taskId: 'task-1',
    childId: CHILD,
    status,
    isInitiative: false,
    submittedAt: new Date(dateIso).getTime(),
    bonusApplied: false,
  }
}

const NOW = new Date('2026-07-22T18:00:00')

describe('computeStreak', () => {
  it('compte les jours consécutifs incluant aujourd’hui', () => {
    const subs = [sub('2026-07-22T10:00:00'), sub('2026-07-21T10:00:00'), sub('2026-07-20T10:00:00')]
    const streak = computeStreak(CHILD, subs, NOW)
    expect(streak.count).toBe(3)
    expect(streak.doneToday).toBe(true)
  })

  it('la série d’hier tient encore si rien aujourd’hui', () => {
    const subs = [sub('2026-07-21T10:00:00'), sub('2026-07-20T10:00:00')]
    const streak = computeStreak(CHILD, subs, NOW)
    expect(streak.count).toBe(2)
    expect(streak.doneToday).toBe(false)
  })

  it('un trou casse la série', () => {
    const subs = [sub('2026-07-22T10:00:00'), sub('2026-07-20T10:00:00')]
    expect(computeStreak(CHILD, subs, NOW).count).toBe(1)
  })

  it('les refus ne comptent pas', () => {
    const subs = [sub('2026-07-22T10:00:00', 'rejected')]
    const streak = computeStreak(CHILD, subs, NOW)
    expect(streak.count).toBe(0)
    expect(streak.doneToday).toBe(false)
  })
})
