import { describe, expect, it } from 'vitest'
import { FAN_SCALE, STOW_SCALE, stowDelay, stowOf } from '@/components/deckFan'

describe('deckFan : pile de rangement', () => {
  it('la pile est en bas de la boîte, plus petite que l’éventail, et chaque carte a son décalage', () => {
    const pts = [0, 1, 2].map((i) => stowOf(i, 300))
    pts.forEach((p) => {
      expect(p.y).toBeGreaterThan(0)
      expect(p.s).toBe(STOW_SCALE)
      expect(p.s).toBeLessThan(FAN_SCALE)
      expect(Math.abs(p.x)).toBeLessThan(10) // une pile, pas un second éventail
    })
    expect(new Set(pts.map((p) => p.x)).size).toBe(3)
    expect(stowOf(1, 300).x).toBe(0)
  })
  it('les cibles suivent la largeur de la boîte', () => {
    expect(stowOf(2, 600).y).toBeCloseTo(stowOf(2, 300).y * 2)
  })
  it('départ échelonné : la carte avant le choix part d’abord, le milieu un demi-pas après', () => {
    expect(stowDelay(0, 2, 90)).toBe(90)
    expect(stowDelay(1, 2, 90)).toBe(90 + 35)
    expect(stowDelay(2, 0, 90)).toBe(90 + 70)
    expect(stowDelay(1, 0, 90)).toBe(90 + 105)
  })
})
