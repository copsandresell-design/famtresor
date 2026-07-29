import { describe, expect, it } from 'vitest'
import { computeRank } from './ranks'
import type { RankDef } from '../types'

const DEFS: RankDef[] = [
  { id: 'a', label: 'Débutant', emoji: '🌱', color: '#000', threshold: 0, createdBy: 'x', createdAt: 0 },
  { id: 'b', label: 'Apprenti', emoji: '🔧', color: '#111', threshold: 100, createdBy: 'x', createdAt: 0 },
  { id: 'c', label: 'Expert', emoji: '🥇', color: '#222', threshold: 500, createdBy: 'x', createdAt: 0 },
]

describe('computeRank', () => {
  it('commence au premier rang à 0 point', () => {
    const state = computeRank(0, DEFS)
    expect(state.rank.id).toBe('a')
    expect(state.next?.id).toBe('b')
    expect(state.progress).toBe(0)
    expect(state.target).toBe(100)
  })

  it('avance au palier correspondant', () => {
    const state = computeRank(150, DEFS)
    expect(state.rank.id).toBe('b')
    expect(state.progress).toBe(50)
    expect(state.target).toBe(400)
  })

  it('reste au dernier rang sans cible au-delà', () => {
    const state = computeRank(10000, DEFS)
    expect(state.rank.id).toBe('c')
    expect(state.next).toBeNull()
    expect(state.target).toBe(0)
  })
})
