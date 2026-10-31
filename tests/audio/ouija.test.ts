import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeCtx, param } from './fakeAudio'

// VueUse n’a pas de fenêtre en environnement node : sfx.ts n’a besoin que de valeurs inertes.
vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  const original = await importOriginal<typeof import('@vueuse/core')>()
  return { ...original, useDocumentVisibility: () => ref('visible'), useEventListener: () => undefined }
})

const load = async () => {
  vi.resetModules()
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const sfx = await import('@/audio/sfx')
  const ouija = await import('@/audio/ouija')
  return { sfx, ...ouija }
}

beforeEach(() => {
  FakeCtx.instances = []
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sons de la planche', () => {
  it('le tic de bois : triangle bref qui chute, gain de crête OUIJA_PEAK.tick, sur le bus des effets', async () => {
    const { sfx, ouijaTick, OUIJA_PEAK } = await load()
    const c = sfx.ac() as unknown as FakeCtx
    c.currentTime = 2
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // hauteur centrée : 900 Hz
    const avant = c.nodes.length
    ouijaTick()
    const nouveaux = c.nodes.slice(avant)
    const osc = nouveaux.find((n) => n.kind === 'oscillator')!
    expect(osc.type).toBe('triangle')
    expect(param(osc, 'frequency').of('setValueAtTime')[0]).toEqual([900, 2])
    expect(param(osc, 'frequency').of('exponentialRampToValueAtTime')[0][0]).toBeCloseTo(900 * 0.55)
    expect(osc.starts).toEqual([[2]])
    expect(osc.stops).toEqual([[2.08]])
    const gain = nouveaux.find((n) => n.kind === 'gain')!
    expect(param(gain, 'gain').of('setValueAtTime')[0]).toEqual([OUIJA_PEAK.tick, 2])
    expect(param(gain, 'gain').of('exponentialRampToValueAtTime')[0][0]).toBeCloseTo(0.001)
    expect(gain.connections).toContain(sfx.effetsOut(c as unknown as AudioContext))
  })

  it('la hauteur du tic varie de ±8 % autour de 900 Hz', async () => {
    const { sfx, ouijaTick } = await load()
    const c = sfx.ac() as unknown as FakeCtx
    const spy = vi.spyOn(Math, 'random')
    const freqs: number[] = []
    for (const r of [0, 1]) {
      spy.mockReturnValue(r)
      const avant = c.nodes.length
      ouijaTick()
      const osc = c.nodes.slice(avant).find((n) => n.kind === 'oscillator')!
      freqs.push(param(osc, 'frequency').of('setValueAtTime')[0][0])
    }
    expect(freqs[0]).toBeCloseTo(900 * 0.92)
    expect(freqs[1]).toBeCloseTo(900 * 1.08)
  })

  it('l’adieu : deux triangles (220, 225 Hz) et deux sinus (110, 112,5 Hz) qui descendent d’une tierce mineure, fondu en 1,4 s', async () => {
    const { sfx, ouijaFarewell, OUIJA_PEAK } = await load()
    const c = sfx.ac() as unknown as FakeCtx
    c.currentTime = 5
    const avant = c.nodes.length
    ouijaFarewell()
    const nouveaux = c.nodes.slice(avant)
    const oscs = nouveaux.filter((n) => n.kind === 'oscillator')
    expect(oscs.map((o) => [o.type, param(o, 'frequency').of('setValueAtTime')[0][0]])).toEqual([
      ['triangle', 220],
      ['triangle', 225],
      ['sine', 110],
      ['sine', 112.5],
    ])
    for (const o of oscs) {
      const f0 = param(o, 'frequency').of('setValueAtTime')[0][0]
      expect(param(o, 'frequency').of('exponentialRampToValueAtTime')[0][0]).toBeCloseTo(f0 * 0.8)
      expect(o.starts).toEqual([[5]])
      expect(o.stops).toEqual([[6.45]])
    }
    const lp = nouveaux.find((n) => n.kind === 'biquad')!
    expect(lp.type).toBe('lowpass')
    expect(param(lp, 'frequency').value).toBe(500)
    const master = lp.connections[0]
    expect(param(master, 'gain').of('linearRampToValueAtTime')[0]).toEqual([OUIJA_PEAK.farewell, 5.06])
    expect(param(master, 'gain').of('exponentialRampToValueAtTime')[0][1]).toBeCloseTo(6.4)
    expect(master.connections).toContain(sfx.effetsOut(c as unknown as AudioContext))
  })

  it('en sourdine : aucun nœud créé', async () => {
    const { sfx, ouijaTick, ouijaFarewell } = await load()
    const c = sfx.ac() as unknown as FakeCtx
    sfx.muted.value = true
    const avant = c.nodes.length
    ouijaTick()
    ouijaFarewell()
    expect(c.nodes.length).toBe(avant)
  })

  it('sans AudioContext : sans effet et sans erreur', async () => {
    vi.stubGlobal('window', {})
    const { ouijaTick, ouijaFarewell } = await load()
    expect(() => {
      ouijaTick()
      ouijaFarewell()
    }).not.toThrow()
    expect(FakeCtx.instances).toHaveLength(0)
  })
})
