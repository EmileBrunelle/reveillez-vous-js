import { describe, expect, it } from 'vitest'
import { RARE_KINDS, SUB_GAINS, clampLevel, nextRareDelay, pickRareKind, rareRange, subGain } from '../../src/audio/paranoiaAudio'

describe('sous-bourdon par palier', () => {
  it('absent au niveau 1, puis strictement croissant', () => {
    expect(subGain(1)).toBe(0)
    for (const l of [2, 3, 4, 5]) expect(subGain(l)).toBeGreaterThan(subGain(l - 1))
  })
  it('reste discret (≤ 0,5 du bus d’ambiance)', () => {
    expect(Math.max(...Object.values(SUB_GAINS))).toBeLessThanOrEqual(0.5)
  })
  it('borne les niveaux invalides', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(9)).toBe(5)
    expect(clampLevel(Number.NaN)).toBe(1)
    expect(subGain(42)).toBe(SUB_GAINS[5])
  })
})

describe('sons rares', () => {
  it('aucun avant le niveau 3', () => {
    expect(rareRange(1)).toBeNull()
    expect(rareRange(2)).toBeNull()
    expect(nextRareDelay(2, () => 0.5)).toBeNull()
  })
  it('délais dans 20–60 s et plus fréquents au niveau 5', () => {
    for (const l of [3, 4, 5]) {
      const r = rareRange(l)!
      expect(r.min).toBeGreaterThanOrEqual(20)
      expect(r.max).toBeLessThanOrEqual(60)
    }
    expect(rareRange(5)!.max).toBeLessThan(rareRange(3)!.max)
    expect(rareRange(5)!.min).toBeLessThan(rareRange(3)!.min)
  })
  it('utilise l’aléa injecté', () => {
    expect(nextRareDelay(3, () => 0)).toBe(40)
    expect(nextRareDelay(5, () => 0)).toBe(20)
    expect(nextRareDelay(5, () => 0.999999)!).toBeLessThan(35)
    expect(nextRareDelay(3, () => 0.5)).toBe(50)
  })
  it('ne répète pas deux fois le même son de suite', () => {
    for (const prev of RARE_KINDS) for (const r of [0, 0.3, 0.6, 0.999999]) expect(pickRareKind(prev, () => r)).not.toBe(prev)
    expect(RARE_KINDS).toContain(pickRareKind(null, () => 0.5))
  })
})
