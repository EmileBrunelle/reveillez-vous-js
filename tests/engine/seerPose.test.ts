import { describe, expect, it } from 'vitest'
import {
  BREATH_HALF_S,
  FLAME_HALF_S,
  ORB_HALF_S,
  SEER_TINTS,
  armATransform,
  bodyTransform,
  clamp,
  emergePose,
  eyesLevel,
  eyesTransform,
  flameLevel,
  gazeFrom,
  handBTransform,
  headTransform,
  orbLevel,
  ramp,
  rimLevel,
  tintFor,
} from '@/engine/seerPose'
import { places } from '@/content/scenes'

describe('seerPose : boucles lentes (photosensibilité)', () => {
  it('respiration ≤ 0,3 Hz ; flamme et boule ≤ 0,5 Hz (aller-retour = deux demi-périodes)', () => {
    expect(1 / (2 * BREATH_HALF_S)).toBeLessThanOrEqual(0.3)
    expect(1 / (2 * FLAME_HALF_S)).toBeLessThanOrEqual(0.5)
    expect(1 / (2 * ORB_HALF_S)).toBeLessThanOrEqual(0.5)
  })
  it('les lueurs restent dans une petite plage : pas de clignotement (variation ≤ 16 %)', () => {
    const levels = [0, 0.25, 0.5, 0.75, 1]
    expect(Math.max(...levels.map(flameLevel)) - Math.min(...levels.map(flameLevel))).toBeLessThan(0.1601)
    expect(Math.max(...levels.map(orbLevel)) - Math.min(...levels.map(orbLevel))).toBeLessThan(0.1601)
    expect(Math.min(flameLevel(0), orbLevel(0))).toBeGreaterThan(0.8)
  })
})

describe('seerPose : émergence', () => {
  it('ramp est bornée et monotone', () => {
    expect(ramp(-1, 0, 1)).toBe(0)
    expect(ramp(2, 0, 1)).toBe(1)
    const vals = [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => ramp(v, 0, 1))
    expect([...vals].sort((a, b) => a - b)).toEqual(vals)
  })
  it('invisible porte fermée, pleinement là porte ouverte', () => {
    const closed = emergePose(0)
    const open = emergePose(1)
    expect(closed.opacity).toBe(0)
    expect(open).toEqual({ opacity: 1, y: 0, scale: 1 })
    expect(closed.scale).toBeCloseTo(0.86)
    expect(closed.y).toBeGreaterThan(0)
  })
  it('avance (échelle) et monte (y) de façon continue avec la progression', () => {
    const ps = Array.from({ length: 21 }, (_, i) => emergePose(i / 20))
    for (let i = 1; i < ps.length; i++) {
      expect(ps[i]!.scale).toBeGreaterThanOrEqual(ps[i - 1]!.scale)
      expect(ps[i]!.y).toBeLessThanOrEqual(ps[i - 1]!.y)
      expect(ps[i]!.opacity).toBeGreaterThanOrEqual(ps[i - 1]!.opacity)
    }
  })
  it('mouvement réduit : fondu seul, ni déplacement ni changement d’échelle', () => {
    for (const p of [0, 0.3, 0.7, 1]) {
      const r = emergePose(p, true)
      expect(r.y).toBe(0)
      expect(r.scale).toBe(1)
    }
    expect(emergePose(0.5, true).opacity).toBeGreaterThan(0)
    expect(emergePose(1, true).opacity).toBe(1)
  })
  it('le liseré s’allume avant les yeux, qui luisent en dernier', () => {
    expect(rimLevel(0.5)).toBeGreaterThan(eyesLevel(0.5))
    expect(eyesLevel(0.6)).toBe(0)
    expect(eyesLevel(1)).toBe(1)
    expect(rimLevel(1)).toBe(1)
  })
})

describe('seerPose : regard et transforms', () => {
  it('le regard est ramené à −1..1 et centré sur le personnage', () => {
    expect(gazeFrom(100, 100, 100, 100, 1000, 800)).toEqual({ x: 0, y: 0 })
    expect(gazeFrom(5000, -5000, 100, 100, 1000, 800)).toEqual({ x: 1, y: -1 })
    expect(gazeFrom(350, 100, 100, 100, 1000, 800).x).toBeCloseTo(0.5)
  })
  it('clamp borne', () => {
    expect(clamp(5, -1, 1)).toBe(1)
    expect(clamp(-5, -1, 1)).toBe(-1)
  })
  it('au repos, les transforms sont neutres', () => {
    expect(bodyTransform(0)).toBe('translate(0 120) scale(1 1) translate(0 -120)')
    expect(headTransform(0, 0, 0)).toBe('translate(0 0) rotate(0 41 54)')
    expect(eyesTransform(0, 0)).toBe('translate(0 0)')
    expect(handBTransform(0)).toBe('translate(0 0) rotate(0 66 76)')
    expect(armATransform(0)).toBe('translate(0 0)')
  })
  it('amplitudes bornées : tête ≤ 3,2°, yeux ≤ 1,4 / 0,7, respiration ≤ 0,8 %', () => {
    expect(headTransform(1, 0, 0)).toContain('rotate(3.2 ')
    expect(eyesTransform(-1, 1)).toBe('translate(-1.4 0.7)')
    expect(bodyTransform(1)).toContain('scale(1 1.008)')
  })
  it('le geste lève la main et la fait pivoter', () => {
    expect(handBTransform(1)).toBe('translate(0 -2) rotate(12 66 76)')
  })
})

describe('seerPose : teintes par lieu', () => {
  it('chaque lieu du jeu a sa teinte, au bon format', () => {
    for (const place of places) {
      const t = SEER_TINTS[place.id]
      expect(t, place.id).toBeDefined()
      for (const c of [t.rim, t.moon, t.orb]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('sans lieu (portes comiques rares) : teinte neutre', () => {
    expect(tintFor(undefined).rim).toMatch(/^#/)
    expect(tintFor('rue')).toBe(SEER_TINTS.rue)
  })
})
