import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ac, ambienceOut, effetsOut, finaleOut } from '../../src/audio/sfx'
import { AUDIO_KEY, DEFAULT_VOLUMES, VOLUME_KEYS, parseVolumes, useAudioStore } from '../../src/stores/audio'
import { createPinia, setActivePinia } from 'pinia'
import { safeStorage } from '../../src/composables/safeStorage'

interface FakeGain {
  gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn>; cancelScheduledValues: () => void }
  connect: ReturnType<typeof vi.fn>
  to?: unknown
}
const makeGain = (): FakeGain => {
  const g: FakeGain = { gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: () => {} }, connect: vi.fn() }
  g.connect.mockImplementation((n: unknown) => ((g.to = n), n))
  return g
}
interface FakeLimiter {
  threshold: { value: number }
  knee: { value: number }
  ratio: { value: number }
  attack: { value: number }
  release: { value: number }
  to?: unknown
  connect: (n: unknown) => unknown
}
class FakeCtx {
  state = 'running'
  currentTime = 1
  destination = { dest: true }
  createGain = () => makeGain()
  createDynamicsCompressor = () => {
    const k: FakeLimiter = { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect: (n) => ((k.to = n), n) }
    return k
  }
}
const asCtx = (c: FakeCtx) => c as unknown as AudioContext
const asGain = (g: GainNode) => g as unknown as FakeGain

let store: ReturnType<typeof useAudioStore>
const setVolume = (...a: Parameters<typeof store.setVolume>) => store.setVolume(...a)
const memStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  setActivePinia(createPinia())
  store = useAudioStore()
})
afterEach(() => vi.unstubAllGlobals())

describe('parseVolumes', () => {
  it('défauts à 1 quand rien n’est stocké', () => {
    expect(parseVolumes(null)).toEqual(DEFAULT_VOLUMES)
    expect(parseVolumes('')).toEqual(DEFAULT_VOLUMES)
  })
  it('lit les valeurs valides et ignore chaque valeur invalide', () => {
    const v = parseVolumes(JSON.stringify({ general: 0.5, ambiance: 2, effets: -1, finale: 'fort' }))
    expect(v).toEqual({ general: 0.5, ambiance: 1, effets: 1, finale: 1 })
  })
  it('JSON illisible ou de mauvaise forme : défauts', () => {
    expect(parseVolumes('{pas du json')).toEqual(DEFAULT_VOLUMES)
    expect(parseVolumes('[1,2]')).toEqual(DEFAULT_VOLUMES)
    expect(parseVolumes('null')).toEqual(DEFAULT_VOLUMES)
  })
})

describe('setVolume', () => {
  it('persiste dans rvj-audio et se relit', () => {
    setVolume('effets', 0.3)
    expect(store.volumes.effets).toBe(0.3)
    expect(parseVolumes(safeStorage().getItem(AUDIO_KEY)).effets).toBe(0.3)
  })
  it('ignore une valeur invalide', () => {
    setVolume('ambiance', 0.4)
    for (const bad of [NaN, Infinity, -0.1, 1.1]) setVolume('ambiance', bad)
    expect(store.volumes.ambiance).toBe(0.4)
  })
  it('resetVolumes remet tout à 1', () => {
    VOLUME_KEYS.forEach((k) => setVolume(k, 0.2))
    store.resetVolumes()
    expect({ ...store.volumes }).toEqual(DEFAULT_VOLUMES)
  })
})

describe('bus par catégorie', () => {
  it('chaque catégorie a son bus, branché sur le général, puis limiteur, puis destination', () => {
    const fake = new FakeCtx()
    const c = asCtx(fake)
    const a = asGain(ambienceOut(c))
    const e = asGain(effetsOut(c))
    const f = asGain(finaleOut(c))
    expect(new Set([a, e, f]).size).toBe(3)
    expect(asGain(effetsOut(c))).toBe(e) // même bus à chaque appel
    expect(a.to).toBe(e.to)
    const limiter = (a.to as FakeGain).to as FakeLimiter // général → limiteur → compensation de gain → destination
    expect((limiter.to as FakeGain).to).toBe(fake.destination)
    expect(limiter.threshold.value).toBeLessThan(0)
    expect(limiter.ratio.value).toBeGreaterThanOrEqual(10)
  })
  it('un volume sauvegardé s’applique à la création des bus', () => {
    setVolume('finale', 0.25)
    setVolume('general', 0.6)
    const f = asGain(finaleOut(asCtx(new FakeCtx())))
    expect(f.gain.value).toBe(0.25)
    expect((f.to as FakeGain).gain.value).toBe(0.6)
  })
  it('setVolume règle le bon bus (et lui seul) sur le contexte courant', () => {
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    const c = ac() as AudioContext
    const e = asGain(effetsOut(c))
    const a = asGain(ambienceOut(c))
    setVolume('effets', 0.5)
    expect(e.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 1, expect.any(Number))
    expect(a.gain.setTargetAtTime).not.toHaveBeenCalled()
  })
})
