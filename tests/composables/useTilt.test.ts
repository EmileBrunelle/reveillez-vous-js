import { describe, expect, it } from 'vitest'
import { stepBaseline, type Point } from '../../src/../src/composables/useTilt'

const run = (base: Point, reading: Point, steps: number, dt: number) => {
  let b = base
  let last = { dx: 0, dy: 0 }
  for (let i = 0; i < steps; i++) {
    const r = stepBaseline(b, reading, dt)
    b = r.base
    last = r
  }
  return { base: b, ...last }
}

describe('stepBaseline', () => {
  it('revient à plat après ~10 s immobile, même avec une mauvaise référence', () => {
    const r = run({ x: 0, y: 0 }, { x: 40, y: -30 }, 600, 16)
    expect(Math.abs(r.dx)).toBeLessThan(1)
    expect(Math.abs(r.dy)).toBeLessThan(1)
  })

  it('un mouvement rapide de 15° donne un grand écart immédiat', () => {
    const r = stepBaseline({ x: 10, y: 10 }, { x: 25, y: 10 }, 16)
    expect(r.dx).toBe(15)
    expect(r.dy).toBe(0)
  })

  it('un saut absurde réinitialise la référence', () => {
    const r = stepBaseline({ x: 0, y: 170 }, { x: 0, y: -170 }, 16)
    expect(r.base).toEqual({ x: 0, y: -170 })
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
  })

  it('est indépendant de la cadence (2×50 ms ≈ 1×100 ms)', () => {
    const reading = { x: 20, y: -10 }
    const a = run({ x: 0, y: 0 }, reading, 2, 50).base
    const b = stepBaseline({ x: 0, y: 0 }, reading, 100).base
    expect(a.x).toBeCloseTo(b.x, 6)
    expect(a.y).toBeCloseTo(b.y, 6)
  })
})
