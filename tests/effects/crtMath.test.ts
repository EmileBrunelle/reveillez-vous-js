import { describe, expect, it } from 'vitest'
import { crtEdgeTerms, RIPPLE, rippleDisplacement } from '../../src/effects/crtMath'

describe('CRT bords lisibles', () => {
  for (const p of [0, 1]) {
    it(`téléphone 390x844 paranoïa ${p}: peu de voile et pas de frange à 15 % et 8 % de la largeur`, () => {
      const a = crtEdgeTerms(390, 844, p, 0.15, 0.5)
      const b = crtEdgeTerms(390, 844, p, 0.08, 0.5)
      expect(a.edge).toBe(0)
      expect(b.edge).toBe(0)
      expect(a.dark).toBeLessThan(0.02)
      expect(b.dark).toBeLessThan(0.08)
    })
    it(`bureau 1280x800 paranoïa ${p}: identique à l’ancien rendu`, () => {
      for (const x of [0.08, 0.15]) expect(crtEdgeTerms(1280, 800, p, x, 0.5)).toEqual(crtEdgeTerms(1280, 800, p, x, 0.5, true))
    })
  }
})

describe('ondulation de coup', () => {
  const ring = (age: number) => RIPPLE.speed * age
  it('nulle à l’âge 0, et hors de l’anneau', () => {
    expect(rippleDisplacement(0, 1, 1, 0)).toBe(0)
    expect(rippleDisplacement(0.3, 1, 1, ring(0.3) + 0.5)).toBeLessThan(1e-6)
    expect(rippleDisplacement(0.3, 1, 1, 0)).toBeLessThan(1e-6)
  })
  it('décroît vers 0 après la durée, y compris âge plafonné', () => {
    expect(rippleDisplacement(RIPPLE.dur, 1, 1, ring(RIPPLE.dur))).toBe(0)
    expect(rippleDisplacement(10, 1, 1, ring(10))).toBe(0)
    expect(rippleDisplacement(0.6, 1, 1, ring(0.6))).toBeLessThan(rippleDisplacement(0.2, 1, 1, ring(0.2)))
  })
  it('nulle si motion = 0 (réduction de mouvement)', () => {
    for (let a = 0; a < 1; a += 0.05) expect(rippleDisplacement(a, 1, 0, ring(a))).toBe(0)
  })
  it('borne : jamais plus de quelques pixels, et amplitude plafonnée à 1', () => {
    let max = 0
    for (let a = 0; a <= 1; a += 0.01) for (let r = 0; r < 1.5; r += 0.005) max = Math.max(max, rippleDisplacement(a, 5, 1, r))
    expect(max).toBeLessThanOrEqual(RIPPLE.px)
    expect(max).toBeGreaterThan(1)
  })
})
