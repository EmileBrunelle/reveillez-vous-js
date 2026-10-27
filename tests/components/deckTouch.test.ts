import { describe, expect, it } from 'vitest'
import { isDrag, nearestIndex, tapOutcome } from '../../src/components/deckTouch'

describe('deckTouch', () => {
  const centers = [-100, 0, 100]
  it('choisit la carte la plus proche en X', () => {
    expect(nearestIndex(-300, centers)).toBe(0)
    expect(nearestIndex(-49, centers)).toBe(1)
    expect(nearestIndex(-51, centers)).toBe(0)
    expect(nearestIndex(60, centers)).toBe(2)
    expect(nearestIndex(0, centers)).toBe(1)
  })
  it('1er tap = aperçu, tap sur l’aperçu = choix', () => {
    expect(tapOutcome(null, 1)).toBe('preview')
    expect(tapOutcome(0, 1)).toBe('preview')
    expect(tapOutcome(1, 1)).toBe('choose')
  })
  it('distingue tap et glissement', () => {
    expect(isDrag(2, 3)).toBe(false)
    expect(isDrag(9, 0)).toBe(true)
  })
})
