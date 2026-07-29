import { describe, expect, it } from 'vitest'
import { computeLifetimePoints, computePoints } from './points'
import type { PointsTransaction } from '../types'

const CHILD = 'child-1'

function ptx(amount: number, childId = CHILD): PointsTransaction {
  return {
    id: `${childId}-${amount}-${Math.random()}`,
    childId,
    type: 'badge',
    amount,
    description: 'test',
    createdBy: 'parent-1',
    createdAt: Date.now(),
  }
}

describe('computePoints', () => {
  it('additionne les gains et dépenses d’un enfant', () => {
    const points = [ptx(20), ptx(-5), ptx(15)]
    expect(computePoints(points, CHILD)).toBe(30)
  })

  it('ignore les points des autres enfants', () => {
    const points = [ptx(20), ptx(50, 'other-child')]
    expect(computePoints(points, CHILD)).toBe(20)
  })

  it('vaut 0 sans transaction', () => {
    expect(computePoints([], CHILD)).toBe(0)
  })
})

describe('computeLifetimePoints', () => {
  it('ne compte que les gains, jamais les dépenses', () => {
    const points = [ptx(20), ptx(-15), ptx(50)]
    expect(computeLifetimePoints(points, CHILD)).toBe(70)
  })

  it('ne redescend jamais même après une grosse dépense', () => {
    const points = [ptx(100), ptx(-90)]
    expect(computeLifetimePoints(points, CHILD)).toBe(100)
    expect(computePoints(points, CHILD)).toBe(10)
  })
})
