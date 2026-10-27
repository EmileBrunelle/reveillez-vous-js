import { describe, expect, it } from 'vitest'
import { isNear, nextWaypoint, stepCatch, stepSpring, stepWisp, wispTuning, type Vec, type WispTuning } from '../../src/engine/wisps'
import { mulberry32, type Rng } from '../../src/engine/rng'

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
  it('capture : maintien paramétrable, décroissance sinon, bornée', () => {
    let pr = 0
    for (let i = 0; i < 30; i++) pr = stepCatch(pr, true, 1 / 60)
    expect(pr).toBeCloseTo(0.5)
    for (let i = 0; i < 60; i++) pr = stepCatch(pr, true, 1 / 60)
    expect(pr).toBe(1)
    expect(stepCatch(1, false, 1, 1, 0.25)).toBeCloseTo(0.75)
    for (let i = 0; i < 600; i++) pr = stepCatch(pr, false, 1 / 60)
    expect(pr).toBe(0)
  })
  it('proximité', () => {
    expect(isNear({ x: 0, y: 0 }, { x: 30, y: 40 }, 50)).toBe(true)
    expect(isNear({ x: 0, y: 0 }, { x: 30, y: 41 }, 50)).toBe(false)
  })
})

/** Simule un joueur : le pointeur suit le feu avec un retard de ~150 ms et une vitesse de main bornée. */
const W = 800
const H = 500
const simulate = (rng: Rng, t: WispTuning, opts: { calm?: boolean } = {}) => {
  const dt = 1 / 60
  const lag = 12 // images (~200 ms : retard de main un peu généreux)
  const maxSpeed = 1500 * dt
  let time = 0
  let pointer: Vec = { x: W / 2, y: H / 2 }
  let maxOutside = 0
  for (let caught = 0; caught < 3; caught++) {
    if (caught > 0) time += 0.7 // pause entre deux feux (useTimeoutFn)
    const start = nextWaypoint(rng, W, H, { x: W / 2, y: H / 2 }, t.margin, 0)
    let st = { pos: start, vel: { x: 0, y: 0 }, target: nextWaypoint(rng, W, H, start, t.margin), untilHop: 0 }
    const seen: Vec[] = []
    let progress = 0
    let reaction = 0.4 + rng() * 0.5 // temps de réaction avant de bouger
    let wobble: Vec = { x: 0, y: 0 } // tremblement de main (marche aléatoire bornée)
    for (let i = 0; i < 60 * 30 && progress < 1; i++) {
      st = stepWisp(st, pointer, dt, rng, W, H, { ...t, calmFactor: opts.calm === false ? 1 : t.calmFactor })
      maxOutside = Math.max(maxOutside, t.margin - st.pos.x, st.pos.x - (W - t.margin), t.margin - st.pos.y, st.pos.y - (H - t.margin))
      seen.push(st.pos)
      time += dt
      reaction -= dt
      if (reaction <= 0 && seen.length > lag) {
        wobble = { x: Math.max(-30, Math.min(30, wobble.x + (rng() - 0.5) * 8)), y: Math.max(-30, Math.min(30, wobble.y + (rng() - 0.5) * 8)) }
        const base = seen[seen.length - 1 - lag]
        const goal = { x: base.x + wobble.x, y: base.y + wobble.y }
        const dx = goal.x - pointer.x
        const dy = goal.y - pointer.y
        const d = Math.hypot(dx, dy)
        const k = d > maxSpeed ? maxSpeed / d : 1
        pointer = { x: pointer.x + dx * k, y: pointer.y + dy * k }
      }
      progress = stepCatch(progress, isNear(pointer, st.pos, t.radius), dt, t.hold, t.decay)
    }
  }
  return { time, maxOutside }
}

describe('feux follets : durée d’une partie simulée', () => {
  for (const level of [1, 2, 3, 4, 5]) {
    it(`niveau ${level} : les trois feux en 4–10 s sur plusieurs graines`, () => {
      const t = wispTuning(level, W, H)
      const times: number[] = []
      for (let seed = 1; seed <= 40; seed++) {
        const r = simulate(mulberry32(seed * 7919 + level), t)
        times.push(r.time)
        expect(r.time).toBeLessThan(10)
        expect(r.maxOutside).toBeLessThanOrEqual(1e-9)
      }
      expect(times.reduce((a, b) => a + b, 0) / times.length).toBeGreaterThan(3)
    })
  }
  it('l’hésitation raccourcit la partie', () => {
    const t = wispTuning(3, W, H)
    let calm = 0
    let wild = 0
    for (let seed = 1; seed <= 20; seed++) {
      calm += simulate(mulberry32(seed), t).time
      wild += simulate(mulberry32(seed), t, { calm: false }).time
    }
    expect(calm).toBeLessThan(wild)
  })
  it('réglages : rayon ≥ 72 px, niveau 2 plus docile que le 5, niveau hors bornes toléré', () => {
    expect(wispTuning(3, 300, 300).radius).toBeGreaterThanOrEqual(72)
    expect(wispTuning(2, W, H).stiffness).toBeLessThan(wispTuning(5, W, H).stiffness)
    expect(Number.isFinite(wispTuning(99, W, H).stiffness)).toBe(true)
  })
  it('le feu reste dans les marges même avec un ressort fou', () => {
    const t = { ...wispTuning(5, W, H), stiffness: 400, damping: 1 }
    const rng = mulberry32(3)
    let st = { pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 }, target: { x: 700, y: 400 }, untilHop: 0 }
    for (let i = 0; i < 2000; i++) {
      st = stepWisp(st, null, 1 / 60, rng, W, H, t)
      expect(st.pos.x).toBeGreaterThanOrEqual(t.margin)
      expect(st.pos.x).toBeLessThanOrEqual(W - t.margin)
      expect(st.pos.y).toBeGreaterThanOrEqual(t.margin)
      expect(st.pos.y).toBeLessThanOrEqual(H - t.margin)
    }
  })
})
