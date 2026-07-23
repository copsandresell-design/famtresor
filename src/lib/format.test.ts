import { describe, expect, it } from 'vitest'
import { euroToCents, formatEuro } from './format'

describe('euroToCents', () => {
  it('accepte virgule et point', () => {
    expect(euroToCents('1,50')).toBe(150)
    expect(euroToCents('2.00')).toBe(200)
    expect(euroToCents(0.5)).toBe(50)
  })

  it('retourne 0 pour une entrée invalide', () => {
    expect(euroToCents('abc')).toBe(0)
    expect(euroToCents('')).toBe(0)
  })
})

describe('formatEuro', () => {
  it('formate en euros français', () => {
    expect(formatEuro(150)).toContain('1,50')
    expect(formatEuro(-100)).toContain('-1,00')
  })

  it('ajoute le + explicite en mode signé', () => {
    expect(formatEuro(150, { signed: true }).startsWith('+')).toBe(true)
    expect(formatEuro(-150, { signed: true }).startsWith('+')).toBe(false)
  })
})
