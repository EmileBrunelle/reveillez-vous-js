import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  out: { id: 'effets' } as object,
  dest: { id: 'dest' } as object,
  muted: { value: false },
  edges: [] as [unknown, unknown][],
  peaks: [] as number[],
  durs: [] as number[],
}))

const node = (): Record<string, unknown> => {
  const target: Record<string, unknown> = {}
  target.connect = (n: unknown) => (h.edges.push([target, n]), n)
  target.start = () => undefined
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: (v: number) => void h.peaks.push(v),
    exponentialRampToValueAtTime: () => undefined,
  })
  return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())), set: (t, k: string, v) => ((t[k] = v), true) })
}
const ctx = { currentTime: 1, destination: h.dest, createGain: node, createBiquadFilter: node, createBufferSource: node }

vi.mock('../../src/audio/sfx', () => ({
  ac: () => ctx,
  effetsOut: () => h.out,
  muted: h.muted,
}))
vi.mock('../../src/audio/noise', () => ({
  startNoise: (_c: unknown, _src: unknown, _at: number, dur: number) => void h.durs.push(dur),
}))

import { cardCollect, cardHover, cardPick, cardPickStill, createGate, ENV_MAX, ENV_MIN, HOVER_MIN_INTERVAL, jitter, PEAK, WHOOSH_DUR } from '../../src/audio/cards'

const THUD = 0.4
const at = (ms: number) => vi.spyOn(performance, 'now').mockReturnValue(ms)

beforeEach(() => {
  h.muted.value = false
  h.edges.length = 0
  h.peaks.length = 0
  h.durs.length = 0
})

describe('jitter', () => {
  it('reste entre 1 et 6 kHz, quel que soit l’aléa', () => {
    for (const base of [800, 2000, 4200, 9000]) {
      for (const r of [0, 0.5, 1]) {
        expect(jitter(base, () => r)).toBeGreaterThanOrEqual(1000)
        expect(jitter(base, () => r)).toBeLessThanOrEqual(6000)
      }
    }
  })
  it('varie avec l’aléa', () => {
    expect(jitter(3000, () => 0)).not.toBe(jitter(3000, () => 1))
  })
})

describe('createGate', () => {
  it('refuse deux sons trop rapprochés puis réaccepte', () => {
    const ok = createGate(100)
    expect(ok(0)).toBe(true)
    expect(ok(50)).toBe(false)
    expect(ok(99)).toBe(false)
    expect(ok(150)).toBe(true)
  })
})

describe('enveloppes et gains', () => {
  it('frôlements entre 30 et 150 ms, souffle borné, crêtes bien sous cardThud', () => {
    at(1_000_000)
    for (const f of [cardHover, cardPick, cardPickStill, () => cardCollect(true)]) f()
    expect(h.durs.length).toBeGreaterThan(0)
    for (const d of h.durs) {
      expect(d).toBeGreaterThanOrEqual(ENV_MIN)
      expect(d).toBeLessThanOrEqual(Math.max(ENV_MAX, WHOOSH_DUR))
    }
    expect(h.durs.filter((d) => d > ENV_MAX)).toEqual([WHOOSH_DUR])
    for (const p of [...Object.values(PEAK), ...h.peaks]) expect(p).toBeLessThan(THUD / 3)
  })
})

describe('limitation du survol', () => {
  it('un seul son si on survole plusieurs cartes en rafale', () => {
    at(2_000_000)
    cardHover()
    const n = h.edges.length
    expect(n).toBeGreaterThan(0)
    at(2_000_000 + HOVER_MIN_INTERVAL - 1)
    cardHover()
    expect(h.edges.length).toBe(n)
    at(2_000_000 + HOVER_MIN_INTERVAL + 1)
    cardHover()
    expect(h.edges.length).toBe(2 * n)
  })
})

describe('sortie', () => {
  it('tout passe par le bus des effets, jamais par destination', () => {
    at(3_000_000)
    cardHover()
    cardPick()
    cardPickStill()
    cardCollect(true)
    expect(h.edges.some(([, to]) => to === h.dest)).toBe(false)
    // une chaîne par son : survol 1 + choix 3 + tape 1 + collection 2
    expect(h.edges.filter(([, to]) => to === h.out).length).toBe(7)
  })
  it('muet : aucun nœud', () => {
    h.muted.value = true
    cardPick()
    cardCollect(true)
    expect(h.edges.length).toBe(0)
  })
})
