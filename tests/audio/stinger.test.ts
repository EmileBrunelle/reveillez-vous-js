import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  out: { id: 'effets' } as object,
  muted: { value: false },
  edges: [] as [unknown, unknown][],
  oscs: [] as { type: string; hz: number; start: number; stop: number }[],
}))

const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
const node = () => {
  const n: Record<string, unknown> = { gain: param(), frequency: param(), type: '' }
  n.connect = (to: unknown) => (h.edges.push([n, to]), to)
  return n
}
const ctx = {
  currentTime: 2,
  createGain: node,
  createBiquadFilter: node,
  createOscillator: () => {
    const n = node()
    const o = { type: '', hz: 0, start: 0, stop: 0 }
    h.oscs.push(o)
    n.start = (t: number) => (o.start = t)
    n.stop = (t: number) => (o.stop = t)
    ;(n.frequency as { setValueAtTime: (v: number) => void }).setValueAtTime = (v: number) => {
      o.hz ||= v
    }
    Object.defineProperty(n, 'type', { set: (v: string) => (o.type = v), get: () => o.type })
    return n
  },
}

vi.mock('../../src/audio/sfx', () => ({ ac: () => ctx, effetsOut: () => h.out, muted: h.muted }))

const { STINGERS, playStinger, stingerDuration } = await import('../../src/audio/stinger')

describe('stingers d’activité', () => {
  beforeEach(() => {
    h.muted.value = false
    h.edges.length = 0
    h.oscs.length = 0
  })

  it('durent environ 1 s', () => {
    for (const k of ['win', 'fail'] as const) {
      expect(stingerDuration(k), k).toBeGreaterThan(0.9)
      expect(stingerDuration(k), k).toBeLessThanOrEqual(1.1)
    }
  })

  it('la réussite monte en accord de la majeur, finit sur la (A5)', () => {
    const hz = STINGERS.win.map((n) => n.hz)
    expect(hz).toEqual([...hz].sort((a, b) => a - b))
    expect(hz[0]).toBe(440)
    expect(hz.at(-1)).toBe(880)
  })

  it('l’échec descend, avec un glissando final', () => {
    const hz = STINGERS.fail.map((n) => n.hz)
    expect(hz).toEqual([...hz].sort((a, b) => b - a))
    expect(STINGERS.fail.at(-1)?.slideTo).toBeLessThan(hz.at(-1)!)
  })

  it('les notes ne se chevauchent pas', () => {
    for (const notes of Object.values(STINGERS)) notes.slice(1).forEach((n, i) => expect(n.at).toBeGreaterThanOrEqual(notes[i].at + notes[i].dur - 1e-9))
  })

  it('joue une voix par note, sur le bus des effets', () => {
    expect(playStinger('win')).toBeCloseTo(stingerDuration('win'))
    expect(h.oscs).toHaveLength(STINGERS.win.length)
    expect(h.oscs.map((o) => o.hz)).toEqual(STINGERS.win.map((n) => n.hz))
    expect(h.oscs[0].start).toBe(2)
    expect(h.edges.some(([, to]) => to === h.out)).toBe(true)
  })

  it('muet : rien ne démarre', () => {
    h.muted.value = true
    expect(playStinger('fail')).toBe(0)
    expect(h.oscs).toHaveLength(0)
  })
})
