import { describe, expect, it } from 'vitest'
import { isNear, nextWaypoint, stepCatch, stepSpring } from '../../src/engine/wisps'
import { mulberry32 } from '../../src/engine/rng'

describe('wisps', () => {
  it('le ressort converge vers sa cible sans exploser', () => {
    let s = { pos: 0, vel: 0 }
    for (let i = 0; i < 600; i++) s = stepSpring(s.pos, s.vel, 100, 1 / 60, 30, 8)
    expect(s.pos).toBeCloseTo(100, 0)
    expect(Math.abs(s.vel)).toBeLessThan(0.5)
  })
  it('un grand dt reste borné', () => {
    const s = stepSpring(0, 0, 100, 5, 30, 8)
    expect(Number.isFinite(s.pos)).toBe(true)
    expect(Math.abs(s.pos)).toBeLessThan(1000)
  })
  it('les points restent dans la scène, avec marge', () => {
    const rng = mulberry32(7)
    let p = { x: 100, y: 100 }
    for (let i = 0; i < 200; i++) {
      p = nextWaypoint(rng, 384, 600, p)
      expect(p.x).toBeGreaterThanOrEqual(56)
      expect(p.x).toBeLessThanOrEqual(384 - 56)
      expect(p.y).toBeGreaterThanOrEqual(56)
      expect(p.y).toBeLessThanOrEqual(600 - 56)
    }
  })
  it('scène minuscule : pas de NaN', () => {
    const p = nextWaypoint(mulberry32(1), 10, 10, { x: 0, y: 0 })
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
  it('capture : ~1 s de proximité, décroissance sinon, bornée', () => {
    let pr = 0
    for (let i = 0; i < 30; i++) pr = stepCatch(pr, true, 1 / 60)
    expect(pr).toBeCloseTo(0.5)
    for (let i = 0; i < 60; i++) pr = stepCatch(pr, true, 1 / 60)
    expect(pr).toBe(1)
    for (let i = 0; i < 600; i++) pr = stepCatch(pr, false, 1 / 60)
    expect(pr).toBe(0)
  })
  it('proximité', () => {
    expect(isNear({ x: 0, y: 0 }, { x: 30, y: 40 }, 50)).toBe(true)
    expect(isNear({ x: 0, y: 0 }, { x: 30, y: 41 }, 50)).toBe(false)
  })
})
