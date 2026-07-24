import { describe, expect, it } from 'vitest'
import { computeLevel, TASKS_PER_LEVEL } from './levels'
import type { TaskSubmission } from '../types'

const CHILD = 'child-1'

let seq = 0
function sub(status: TaskSubmission['status'], childId = CHILD): TaskSubmission {
  return {
    id: `sub-${++seq}`,
    taskId: 'task-1',
    childId,
    status,
    isInitiative: false,
    submittedAt: Date.now(),
    bonusApplied: false,
  }
}

describe('computeLevel', () => {
  it('démarre au niveau 1 sans tâche validée', () => {
    const state = computeLevel(CHILD, [])
    expect(state.level).toBe(1)
    expect(state.progress).toBe(0)
    expect(state.totalApproved).toBe(0)
  })

  it('monte de niveau toutes les TASKS_PER_LEVEL tâches validées', () => {
    const subs = Array.from({ length: TASKS_PER_LEVEL }, () => sub('approved'))
    expect(computeLevel(CHILD, subs).level).toBe(2)
    expect(computeLevel(CHILD, subs).progress).toBe(0)

    const subsPlus = [...subs, sub('approved'), sub('approved')]
    expect(computeLevel(CHILD, subsPlus).level).toBe(2)
    expect(computeLevel(CHILD, subsPlus).progress).toBe(2)
  })

  it("ignore les tâches en attente, refusées et celles des autres enfants", () => {
    const subs = [sub('pending'), sub('rejected'), sub('approved', 'other-child')]
    const state = computeLevel(CHILD, subs)
    expect(state.totalApproved).toBe(0)
    expect(state.level).toBe(1)
  })
})
