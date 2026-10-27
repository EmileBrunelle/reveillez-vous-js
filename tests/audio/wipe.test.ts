import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { FREQ_MAX, FREQ_MIN, GAIN_MAX, SPEED_MAX, SQUEAK_MAX, startWipeSound, wipeParams } from '../../src/audio/wipe'

describe('wipeParams', () => {
  it('vitesse nulle (ou invalide) : silence', () => {
    for (const v of [0, -3, NaN]) {
      const p = wipeParams(v)
      expect(p.gain).toBe(0)
      expect(p.squeak).toBe(0)
      expect(p.freq).toBe(FREQ_MIN)
    }
  })
  it('borné, même à vitesse extrême', () => {
    for (const v of [0.1, 1, SPEED_MAX, 100, Infinity]) {
      const p = wipeParams(v)
      expect(p.gain).toBeLessThanOrEqual(GAIN_MAX)
      expect(p.freq).toBeGreaterThanOrEqual(FREQ_MIN)
      expect(p.freq).toBeLessThanOrEqual(FREQ_MAX)
      expect(p.squeak).toBeLessThanOrEqual(SQUEAK_MAX)
    }
    expect(wipeParams(1e6).gain).toBe(GAIN_MAX)
  })
  it('monotone croissant', () => {
    let prev = wipeParams(0)
    for (let v = 0.05; v <= SPEED_MAX * 1.5; v += 0.05) {
      const p = wipeParams(v)
      expect(p.gain).toBeGreaterThanOrEqual(prev.gain)
      expect(p.freq).toBeGreaterThanOrEqual(prev.freq)
      expect(p.squeak).toBeGreaterThanOrEqual(prev.squeak)
      prev = p
    }
  })
  it('le couinement reste muet à vitesse modérée', () => {
    expect(wipeParams(SPEED_MAX * 0.5).squeak).toBe(0)
  })
})

const stats = { started: 0, stopped: 0, disconnected: 0, targets: [] as number[] }
const param = () => ({
  value: 0,
  setValueAtTime: () => undefined,
  setTargetAtTime: (v: number) => void stats.targets.push(v),
})
const makeNode = () => {
  const target: Record<string, unknown> = {
    connect: (n: unknown) => n,
    disconnect: () => void stats.disconnected++,
    start: () => void stats.started++,
    stop: () => void stats.stopped++,
  }
  return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())), set: (t, k: string, v) => ((t[k] = v), true) })
}
class FakeCtx {
  state = 'running'
  currentTime = 0
  sampleRate = 8000
  destination = makeNode()
  createGain = () => makeNode()
  createDynamicsCompressor = () => makeNode()
  createBiquadFilter = () => makeNode()
  createOscillator = () => makeNode()
  createBufferSource = () => makeNode()
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
  resume = () => Promise.resolve()
  addEventListener() {}
}

describe('startWipeSound', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    Object.assign(stats, { started: 0, stopped: 0, disconnected: 0, targets: [] })
    vi.stubGlobal('window', { AudioContext: FakeCtx })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sans AudioContext : sans effet', () => {
    vi.stubGlobal('window', {})
    const w = startWipeSound()
    expect(() => {
      w.move(0.1)
      w.rest()
      w.stop()
    }).not.toThrow()
  })

  it('aucun nœud avant le premier mouvement mesurable', () => {
    const w = startWipeSound()
    w.move(0.1)
    expect(stats.started).toBe(0)
    w.stop()
  })

  it('un geste démarre le son, l’arrêt du geste le fait retomber à zéro', () => {
    const w = startWipeSound()
    w.move(0)
    vi.advanceTimersByTime(16)
    w.move(0.05)
    expect(stats.started).toBe(2)
    expect(Math.max(...stats.targets)).toBeGreaterThan(0)
    stats.targets.length = 0
    vi.advanceTimersByTime(200) // minuterie d’inactivité
    expect(stats.targets).toEqual([0, FREQ_MIN, 0])
    w.stop()
  })

  it('stop : sources arrêtées, nœuds déconnectés, idempotent', () => {
    const w = startWipeSound()
    w.move(0)
    vi.advanceTimersByTime(16)
    w.move(0.05)
    w.stop()
    w.stop()
    expect(stats.stopped).toBe(2)
    vi.advanceTimersByTime(500)
    expect(stats.disconnected).toBe(6)
    const before = stats.started
    w.move(0.1)
    expect(stats.started).toBe(before)
  })
})
