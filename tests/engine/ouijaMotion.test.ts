import { describe, expect, it } from 'vitest'
import { LIFT_MAX, TILT_MAX, TREMOR_MAX, WANDER_MAX, approach, liftFromSpeed, tiltFromVelocity, tremorOffset, wanderAmp, wanderOffset } from '../../src/engine/ouijaMotion'

describe('ouijaMotion', () => {
  it('incline dans le sens du mouvement, borné', () => {
    expect(tiltFromVelocity(3)).toBeGreaterThan(0)
    expect(tiltFromVelocity(-3)).toBeLessThan(0)
    expect(tiltFromVelocity(0)).toBe(0)
    expect(tiltFromVelocity(1000)).toBe(TILT_MAX)
    expect(tiltFromVelocity(-1000)).toBe(-TILT_MAX)
  })
  it('la résistance réduit l’inclinaison dans le sens du mouvement', () => {
    expect(tiltFromVelocity(5, 1)).toBeLessThan(tiltFromVelocity(5))
  })
  it('lift : 1 à l’arrêt, plafonné à 1,04', () => {
    expect(liftFromSpeed(0, 0)).toBe(1)
    expect(liftFromSpeed(100, 100)).toBeCloseTo(LIFT_MAX)
  })
  it('vagabondage : croît avec le niveau, ≤ 2 px', () => {
    expect(wanderAmp(5)).toBeGreaterThan(wanderAmp(1))
    expect(wanderAmp(5)).toBeLessThanOrEqual(WANDER_MAX)
    for (let t = 0; t < 20000; t += 137) {
      const o = wanderOffset(t, 5)
      expect(Math.abs(o.x)).toBeLessThanOrEqual(WANDER_MAX)
      expect(Math.abs(o.y)).toBeLessThanOrEqual(WANDER_MAX)
    }
  })
  it('tremblement ≤ 1,5 px, nul sans force', () => {
    expect(Math.abs(tremorOffset(1234, 0).x)).toBe(0)
    for (let t = 0; t < 5000; t += 53) expect(Math.abs(tremorOffset(t, 1).x)).toBeLessThanOrEqual(TREMOR_MAX)
  })
  it('approach converge sans dépasser', () => {
    const v = approach(1, 0, 100, 100)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  })
})
