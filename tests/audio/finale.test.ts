import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { muted } from '../../src/audio/sfx'
import { ambienceDucked } from '../../src/audio/ambience'
import { startFinaleAudio } from '../../src/audio/finale'

const stats = { oscStarted: 0, oscStopped: 0, disconnected: 0 }
const param = () => {
  const f = () => undefined
  return { value: 0, setValueAtTime: f, linearRampToValueAtTime: f, exponentialRampToValueAtTime: f, setTargetAtTime: f, cancelScheduledValues: f }
}
const makeNode = (osc = false) => {
  const target: Record<string, unknown> = {
    connect: (n: unknown) => n,
    disconnect: () => void stats.disconnected++,
    start: () => osc && void stats.oscStarted++,
    stop: () => osc && void stats.oscStopped++,
  }
  return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())), set: (t, k: string, v) => ((t[k] = v), true) })
}
class FakeCtx {
  state = 'running'
  currentTime = 0
  destination = makeNode()
  createGain = () => makeNode()
  createBiquadFilter = () => makeNode()
  createOscillator = () => makeNode(true)
  addEventListener() {}
}

describe('startFinaleAudio', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(stats, { oscStarted: 0, oscStopped: 0, disconnected: 0 })
    muted.value = false
    ambienceDucked.value = false
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    muted.value = false
  })

  it('sans AudioContext : tout est sans effet', () => {
    vi.stubGlobal('window', {})
    const a = startFinaleAudio()
    expect(() => {
      a.powerDown()
      a.dawn()
      a.fadePad()
      a.bell()
      a.stop()
    }).not.toThrow()
    expect(ambienceDucked.value).toBe(false)
  })

  it('désactivé (mouvement réduit) : aucun nœud créé', () => {
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    startFinaleAudio(false).powerDown()
    expect(stats.oscStarted).toBe(0)
  })

  it('muet : les sons démarrent quand même (la sourdine passe par le bus maître, pour revenir si on la retire)', () => {
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    muted.value = true
    const a = startFinaleAudio()
    a.powerDown()
    a.dawn()
    a.bell()
    expect(stats.oscStarted).toBeGreaterThan(0)
    a.stop()
  })

  it('stop(false) (saut) garde les ambiances étouffées ; le stop() final les libère', () => {
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    const a = startFinaleAudio()
    a.powerDown()
    a.stop(false)
    expect(ambienceDucked.value).toBe(true)
    a.stop()
    expect(ambienceDucked.value).toBe(false)
  })

  it('séquence complète puis stop() : étouffe les ambiances, arrête et déconnecte tout, idempotent', () => {
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    const a = startFinaleAudio()
    a.powerDown()
    expect(ambienceDucked.value).toBe(true)
    a.dawn()
    a.bell()
    a.fadePad()
    const n = stats.oscStarted
    expect(n).toBeGreaterThan(10)
    a.stop()
    a.stop()
    vi.advanceTimersByTime(1000)
    expect(stats.oscStopped).toBeGreaterThanOrEqual(n)
    expect(stats.disconnected).toBe(1)
    expect(ambienceDucked.value).toBe(false)
    a.dawn() // après stop : sans effet
    a.bell()
    expect(stats.oscStarted).toBe(n)
  })
})
