import { describe, expect, it } from 'vitest'
import { BASS_PARTIALS, PAD_GAINS, PAD_VOICES, RARE_KINDS, SUB_GAINS, clampLevel, estimatedDbfs, nextRareDelay, pickRareKind, rareRange, subGain } from '../../src/audio/paranoiaAudio'

describe('sous-bourdon par palier', () => {
  it('absent au niveau 1, puis strictement croissant', () => {
    expect(subGain(1)).toBe(0)
    for (const l of [2, 3, 4, 5]) expect(subGain(l)).toBeGreaterThan(subGain(l - 1))
  })
  it('la nappe médium : zéro au niveau 1, strictement croissante', () => {
    expect(PAD_GAINS[1]).toBe(0)
    for (const l of [2, 3, 4, 5] as const) expect(PAD_GAINS[l]).toBeGreaterThan(PAD_GAINS[(l - 1) as 1 | 2 | 3 | 4])
  })
  it('niveau RMS estimé au bus maître : silence au niveau 1, ≈ -30 dBFS au 3, ≈ -22 dBFS au 5, croissant', () => {
    expect(estimatedDbfs(1)).toBe(-Infinity)
    expect(estimatedDbfs(3)).toBeCloseTo(-30, 0)
    expect(estimatedDbfs(5)).toBeCloseTo(-22, 0)
    for (const l of [2, 3, 4, 5]) expect(estimatedDbfs(l)).toBeGreaterThan(estimatedDbfs(l - 1))
  })
  it('basse fantôme : fondamentale 41 Hz + harmoniques 82–205 Hz d’amplitude décroissante', () => {
    expect(BASS_PARTIALS.map(([hz]) => hz)).toEqual([41, 82, 123, 164, 205])
    for (let i = 1; i < BASS_PARTIALS.length; i++) expect(BASS_PARTIALS[i][1]).toBeLessThan(BASS_PARTIALS[i - 1][1])
  })
  it('nappe : voix entre 200 et 350 Hz, enflures de période ≥ 6 s, battement ≤ 1 Hz', () => {
    for (const v of PAD_VOICES) {
      expect(v.hz).toBeGreaterThanOrEqual(200)
      expect(v.hz).toBeLessThanOrEqual(350)
      expect(v.period).toBeGreaterThanOrEqual(6)
    }
    const hz = PAD_VOICES.map((v) => v.hz)
    for (const a of hz) for (const b of hz) if (a !== b && Math.abs(a - b) < 5) expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
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
