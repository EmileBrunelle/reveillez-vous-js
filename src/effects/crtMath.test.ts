import { describe, expect, it } from 'vitest'
import { crtEdgeTerms } from './crtMath'

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
