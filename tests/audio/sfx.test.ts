import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { FakeCtx, param, type FakeNode } from './fakeAudio'

// Capte la boucle rAF, la visibilité et les écouteurs de geste que sfx.ts demande à VueUse (pas de fenêtre en node).
const h = vi.hoisted(() => ({
  raf: null as null | (() => void),
  pause: null as null | (() => void),
  visibility: { value: 'visible' } as { value: string },
  listeners: new Map<string, () => void>(),
  playMotif: null as null | ((...a: unknown[]) => void),
}))
vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  const original = await importOriginal<typeof import('@vueuse/core')>()
  h.visibility = ref('visible')
  return {
    ...original,
    useDocumentVisibility: () => h.visibility,
    useEventListener: (types: string | string[], fn: () => void) => void [types].flat().forEach((t) => h.listeners.set(t, fn)),
    useRafFn: (fn: () => void) => {
      h.raf = fn
      h.pause = vi.fn()
      return { pause: h.pause }
    },
  }
})
vi.mock('@/audio/motif', () => {
  h.playMotif = vi.fn()
  return { playMotif: h.playMotif }
})

const load = async () => {
  vi.resetModules()
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const sfx = await import('@/audio/sfx')
  const { useAudioStore } = await import('@/stores/audio')
  const c = sfx.ac() as unknown as FakeCtx
  return { sfx, store: useAudioStore(), c, actx: c as unknown as AudioContext }
}

beforeEach(() => {
  FakeCtx.instances = []
  h.listeners.clear()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Nœuds créés par `fn`. */
const created = (c: FakeCtx, fn: () => void): FakeNode[] => {
  const avant = c.nodes.length
  fn()
  return c.nodes.slice(avant)
}
const gainPeaks = (n: FakeNode) =>
  param(n, 'gain')
    .of('setValueAtTime')
    .map((a) => a[0])

describe('contexte et bus', () => {
  it('sans AudioContext (ni webkit) : ac() renvoie null, unlock() ne plante pas', async () => {
    vi.stubGlobal('window', {})
    vi.resetModules()
    const sfx = await import('@/audio/sfx')
    expect(sfx.ac()).toBeNull()
    expect(() => sfx.unlock()).not.toThrow()
  })

  it('replie sur webkitAudioContext', async () => {
    vi.stubGlobal('window', { webkitAudioContext: FakeCtx })
    const { c } = await load()
    expect(c).toBeInstanceOf(FakeCtx)
  })

  it('un seul contexte réutilisé ; un contexte fermé est recréé', async () => {
    const { sfx, c } = await load()
    expect(sfx.ac()).toBe(c)
    c.state = 'closed'
    const c2 = sfx.ac() as unknown as FakeCtx
    expect(c2).not.toBe(c)
    expect(c2.state).toBe('running')
  })

  it('chaîne de sortie : général -> limiteur (-6 dB, ratio 20) -> gain 0,77 -> destination', async () => {
    const { c } = await load()
    const limiter = c.all('compressor')[0]
    expect(param(limiter, 'threshold').value).toBe(-6)
    expect(param(limiter, 'ratio').value).toBe(20)
    expect(param(limiter, 'attack').value).toBeCloseTo(0.003)
    expect(param(limiter, 'release').value).toBeCloseTo(0.15)
    const general = c.all('gain')[0]
    expect(general.connections).toEqual([limiter])
    const trim = limiter.connections[0]
    expect(param(trim, 'gain').value).toBe(0.77)
    expect(trim.connections).toEqual([c.destination])
  })

  it('les trois catégories passent par le général, au volume du store, et le bus est mémorisé', async () => {
    const { sfx, c, actx } = await load()
    const general = c.all('gain')[0]
    for (const out of [sfx.ambienceOut, sfx.effetsOut, sfx.finaleOut]) {
      const b = out(actx) as unknown as FakeNode
      expect(b.connections).toEqual([general])
      expect(param(b, 'gain').value).toBe(1)
      expect(out(actx)).toBe(b as unknown as GainNode)
    }
    expect(sfx.ambienceOut(actx)).not.toBe(sfx.effetsOut(actx))
  })

  it('un volume du store déjà réglé initialise le bus', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ general: 0.5, ambiance: 0.4, effets: 0.3, finale: 0.2 }), setItem: () => undefined, removeItem: () => undefined })
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
    const sfx = await import('@/audio/sfx')
    const c = sfx.ac() as unknown as FakeCtx
    expect(param(c.all('gain')[0], 'gain').value).toBe(0.5)
    expect(param(sfx.effetsOut(c as unknown as AudioContext) as unknown as FakeNode, 'gain').value).toBe(0.3)
  })

  it('un changement de volume rampe le bus (annule l’ancienne rampe, constante 30 ms)', async () => {
    const { sfx, store, c, actx } = await load()
    c.currentTime = 4
    const eff = sfx.effetsOut(actx) as unknown as FakeNode
    store.setVolume('effets', 0.25)
    expect(param(eff, 'gain').of('cancelScheduledValues')).toEqual([[4]])
    expect(param(eff, 'gain').of('setTargetAtTime')).toEqual([[0.25, 4, 0.03]])
    // les autres bus ne bougent pas
    expect(param(sfx.finaleOut(actx) as unknown as FakeNode, 'gain').of('setTargetAtTime')).toEqual([])
    store.setVolume('general', 0.5)
    expect(param(c.all('gain')[0], 'gain').of('setTargetAtTime')).toEqual([[0.5, 4, 0.03]])
  })

  it('la remise à zéro des volumes rampe chaque bus vers 1', async () => {
    const { sfx, store, c, actx } = await load()
    store.setVolume('ambiance', 0.1)
    store.resetVolumes()
    const amb = sfx.ambienceOut(actx) as unknown as FakeNode
    expect(
      param(amb, 'gain')
        .of('setTargetAtTime')
        .map((a) => a[0]),
    ).toEqual([0.1, 1])
    expect(c.state).toBe('running')
  })

  it('un contexte fermé ne reçoit plus de rampes', async () => {
    const { sfx, store, c, actx } = await load()
    const eff = sfx.effetsOut(actx) as unknown as FakeNode
    c.state = 'closed'
    store.setVolume('effets', 0.2)
    expect(param(eff, 'gain').of('setTargetAtTime')).toEqual([])
  })

  it('sourdine : miroir du store dans les deux sens', async () => {
    const { sfx, store } = await load()
    expect(sfx.muted.value).toBe(false)
    sfx.muted.value = true
    expect(store.muted).toBe(true)
    store.muted = false
    expect(sfx.muted.value).toBe(false)
  })

  it('un nouveau store (pinia neuf) reprend l’observation des volumes', async () => {
    const { sfx, c, actx } = await load()
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
    sfx.ac()
    const { useAudioStore } = await import('@/stores/audio')
    useAudioStore().setVolume('finale', 0.6)
    expect(param(sfx.finaleOut(actx) as unknown as FakeNode, 'gain').of('setTargetAtTime')).toEqual([[0.6, c.currentTime, 0.03]])
  })
})

describe('reprise du contexte', () => {
  it('unlock() reprend un contexte suspendu ; pas un contexte qui tourne', async () => {
    const { sfx, c } = await load()
    const resume = vi.spyOn(c, 'resume')
    sfx.unlock()
    expect(resume).not.toHaveBeenCalled()
    c.state = 'suspended'
    sfx.unlock()
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('un geste ou le retour de l’onglet reprend le contexte interrompu, seulement après un premier geste', async () => {
    const { c } = await load()
    const resume = vi.spyOn(c, 'resume')
    c.state = 'interrupted'
    h.visibility.value = 'hidden'
    await nextTick()
    h.visibility.value = 'visible'
    await nextTick()
    expect(resume).not.toHaveBeenCalled()
    h.listeners.get('pointerup')?.()
    expect(resume).toHaveBeenCalledTimes(1)
    h.visibility.value = 'hidden'
    await nextTick()
    h.visibility.value = 'visible'
    await nextTick()
    expect(resume).toHaveBeenCalledTimes(2)
  })
})

describe('coups (knock)', () => {
  it('un coup : bruit + choc grave + médium, gains interpolés selon l’intensité', async () => {
    const { sfx, c } = await load()
    c.currentTime = 3
    const lo = created(c, () => sfx.knock(0))
    expect(lo.filter((n) => n.kind === 'oscillator')).toHaveLength(2)
    expect(lo.filter((n) => n.kind === 'bufferSource')).toHaveLength(1)
    const peaksLo = lo.filter((n) => n.kind === 'gain').map((n) => gainPeaks(n)[0])
    expect(peaksLo).toEqual(expect.arrayContaining([0.13, 0.12]))
    const hi = created(c, () => sfx.knock(1))
    const peaksHi = hi.filter((n) => n.kind === 'gain').map((n) => gainPeaks(n)[0])
    expect(peaksHi.some((p) => Math.abs(p - 0.9) < 1e-9)).toBe(true) // clac
    expect(peaksHi.some((p) => Math.abs(p - 0.7) < 1e-9)).toBe(true) // corps grave
    const mid = hi.find((n) => n.kind === 'oscillator' && n.type === 'triangle')!
    expect(param(mid, 'frequency').of('setValueAtTime')[0]).toEqual([320, 3])
    expect(mid.starts).toEqual([[3]])
  })

  it('silencieux en sourdine ou quand le contexte ne tourne pas', async () => {
    const { sfx, c } = await load()
    sfx.muted.value = true
    expect(created(c, () => sfx.knock(0.5))).toHaveLength(0)
    sfx.muted.value = false
    c.state = 'suspended'
    expect(created(c, () => sfx.knock(0.5))).toHaveLength(0)
  })

  it('scheduleKnocks (contexte actif) : planifie un coup par décalage, premier ~50 ms plus tard', async () => {
    const { sfx, c } = await load()
    c.currentTime = 10
    const hits: [number, number][] = []
    let handle!: ReturnType<typeof sfx.scheduleKnocks>
    const nodes = created(c, () => {
      handle = sfx.scheduleKnocks([0, 0.5, 1], 0.4, (i, k) => hits.push([i, k]))
    })
    expect(handle.times).toEqual([10.05, 10.55, 11.05])
    expect(nodes.filter((n) => n.kind === 'oscillator')).toHaveLength(6) // 2 par coup
    const starts = nodes.filter((n) => n.kind === 'oscillator' && n.type === 'triangle').map((n) => n.starts[0][0])
    expect(starts).toEqual([10.05, 10.55, 11.05])
    expect(handle.now()).toBe(10)
  })

  it('onHit part à chaque coup quand l’horloge (moins la latence) l’atteint, puis la boucle se met en pause', async () => {
    const { sfx, c } = await load()
    c.currentTime = 0
    c.outputLatency = 0.04
    c.baseLatency = 0.01 // latence 0,05
    const hits: [number, number][] = []
    sfx.scheduleKnocks([0, 0.5], 0.7, (i, k) => hits.push([i, k]))
    h.raf!()
    expect(hits).toEqual([])
    c.currentTime = 0.1 // 0,05 + 0,05 de latence : le premier coup est entendu
    h.raf!()
    expect(hits).toEqual([[0, 0.7]])
    expect(h.pause).not.toHaveBeenCalled()
    c.currentTime = 0.7
    h.raf!()
    expect(hits).toEqual([
      [0, 0.7],
      [1, 0.7],
    ])
    expect(h.pause).toHaveBeenCalled()
  })

  it('en sourdine : horloge Web Audio mais aucun son planifié, les rappels restent appelés', async () => {
    const { sfx, c } = await load()
    sfx.muted.value = true
    const hits: number[] = []
    const nodes = created(c, () => void sfx.scheduleKnocks([0], 1, (i) => hits.push(i)))
    expect(nodes).toHaveLength(0)
    c.currentTime = 1
    h.raf!()
    expect(hits).toEqual([0])
  })

  it('avant le déverrouillage (contexte suspendu) : même calendrier en silence sur performance.now()', async () => {
    const { sfx, c } = await load()
    c.state = 'suspended'
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const hits: number[] = []
    let handle!: ReturnType<typeof sfx.scheduleKnocks>
    const nodes = created(c, () => {
      handle = sfx.scheduleKnocks([0, 1], 0.5, (i) => hits.push(i))
    })
    expect(nodes).toHaveLength(0)
    expect(handle.times).toEqual([2.05, 3.05])
    expect(handle.now()).toBe(2)
    vi.spyOn(performance, 'now').mockReturnValue(2100)
    h.raf!()
    expect(hits).toEqual([0]) // aucune latence en mode silencieux
  })

  it('cancel() : arrête les sources (même déjà arrêtées), coupe la boucle et supprime les coups restants', async () => {
    const { sfx, c } = await load()
    const hits: number[] = []
    let handle!: ReturnType<typeof sfx.scheduleKnocks>
    const nodes = created(c, () => {
      handle = sfx.scheduleKnocks([0, 1], 0.5, (i) => hits.push(i))
    })
    const sources = nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'bufferSource')
    sources[0].stopThrows = true
    handle.cancel()
    expect(h.pause).toHaveBeenCalled()
    expect(sources.slice(1).every((s) => s.stops.length >= 1)).toBe(true)
    c.currentTime = 5
    h.raf!()
    expect(hits).toEqual([])
  })
})

describe('effets ponctuels', () => {
  it('chaque effet est muet en sourdine', async () => {
    const { sfx, c } = await load()
    sfx.muted.value = true
    for (const fn of [sfx.creak, sfx.slam, sfx.hymn, sfx.cardDeal, sfx.cardFlip, sfx.cardThud, sfx.aboutOpen, sfx.aboutClose]) expect(created(c, fn)).toHaveLength(0)
    expect(h.playMotif).not.toHaveBeenCalled()
  })

  it('creak : dent de scie 90 -> 190 Hz sur 0,8 s, modulée à 19 Hz, enveloppe 0,48 de crête', async () => {
    const { sfx, c } = await load()
    c.currentTime = 1
    const nodes = created(c, sfx.creak)
    const saw = nodes.find((n) => n.type === 'sawtooth')!
    expect(param(saw, 'frequency').of('setValueAtTime')[0]).toEqual([90, 1])
    expect(
      param(saw, 'frequency')
        .of('linearRampToValueAtTime')
        .map((a) => a[0]),
    ).toEqual([150, 75, 190])
    expect(saw.stops).toEqual([[1.9]])
    const lfo = nodes.find((n) => n.kind === 'oscillator' && n !== saw)!
    expect(param(lfo, 'frequency').value).toBe(19)
    const env = nodes.find(
      (n) =>
        n.kind === 'gain' &&
        param(n, 'gain')
          .of('linearRampToValueAtTime')
          .some((a) => a[0] === 0.48),
    )!
    expect(param(env, 'gain').of('linearRampToValueAtTime')).toEqual([
      [0.48, 1.1],
      [0.0001, 1.85],
    ])
  })

  it('slam : rafale de 0,25 s à 0,7 et choc grave à 0,7', async () => {
    const { sfx, c } = await load()
    const nodes = created(c, sfx.slam)
    expect(nodes.filter((n) => n.kind === 'bufferSource')).toHaveLength(1)
    expect(nodes.filter((n) => n.kind === 'oscillator')).toHaveLength(2)
    const peaks = nodes.filter((n) => n.kind === 'gain').map((n) => gainPeaks(n)[0])
    expect(peaks.filter((p) => p === 0.7)).toHaveLength(2)
    expect(nodes.find((n) => n.kind === 'biquad')!.type).toBe('lowpass')
  })

  it('hymn : le leitmotif d’abord, puis cinq carrés (la, do♯, mi, la aigu, mi) espacés de 0,2 s après 0,9 s', async () => {
    const { sfx, c, actx } = await load()
    c.currentTime = 2
    const nodes = created(c, sfx.hymn)
    expect(h.playMotif).toHaveBeenCalledWith(actx, sfx.effetsOut(actx), { variant: 'mystere', peakDb: sfx.REVEAL_MOTIF_DB })
    const osc = nodes.filter((n) => n.kind === 'oscillator')
    expect(osc.map((o) => param(o, 'frequency').value)).toEqual(sfx.HYMN_HZ)
    expect(osc.every((o) => o.type === 'square')).toBe(true)
    osc.forEach((o, i) => {
      const s = 2 + sfx.HYMN_DELAY + i * 0.2
      expect(o.starts[0][0]).toBeCloseTo(s)
      expect(o.stops[0][0]).toBeCloseTo(s + 0.2)
    })
    const g = nodes.find((n) => n.kind === 'gain')!
    expect(param(g, 'gain').of('linearRampToValueAtTime')[0][0]).toBe(sfx.HYMN_GAIN)
  })

  it('cardDeal : bruit passe-bande dont la hauteur monte de 900 à 3800 Hz', async () => {
    const { sfx, c } = await load()
    const nodes = created(c, sfx.cardDeal)
    const f = nodes.find((n) => n.kind === 'biquad')!
    expect(f.type).toBe('bandpass')
    expect(param(f, 'frequency').of('setValueAtTime')[0][0]).toBe(900)
    expect(param(f, 'frequency').of('exponentialRampToValueAtTime')[0][0]).toBe(3800)
    expect(nodes.find((n) => n.kind === 'bufferSource')!.starts).toHaveLength(1)
  })

  it('cardFlip : claquement aigu puis bip triangle de FLIP_BLIP_HZ à 880 Hz', async () => {
    const { sfx, c } = await load()
    c.currentTime = 1
    const nodes = created(c, sfx.cardFlip)
    const blip = nodes.find((n) => n.type === 'triangle')!
    expect(param(blip, 'frequency').of('setValueAtTime')[0]).toEqual([sfx.FLIP_BLIP_HZ, 1.16])
    expect(param(blip, 'frequency').of('exponentialRampToValueAtTime')[0][0]).toBe(880)
    expect(blip.stops).toEqual([[1.32]])
    expect(nodes.filter((n) => n.kind === 'bufferSource')).toHaveLength(1)
  })

  it('cardThud : bruit passe-bas qui s’assombrit (700 -> 180 Hz), sans oscillateur', async () => {
    const { sfx, c } = await load()
    const nodes = created(c, sfx.cardThud)
    expect(nodes.filter((n) => n.kind === 'oscillator')).toHaveLength(0)
    const f = nodes.find((n) => n.kind === 'biquad')!
    expect(f.type).toBe('lowpass')
    expect(param(f, 'frequency').of('exponentialRampToValueAtTime')[0][0]).toBe(180)
  })

  it('aboutOpen : leitmotif court, aigu, sans écho ; aboutClose : bip carré descendant 660 -> 330 Hz', async () => {
    const { sfx, c, actx } = await load()
    sfx.aboutOpen()
    expect(h.playMotif).toHaveBeenCalledWith(actx, sfx.effetsOut(actx), { variant: 'mystere', slow: 0.6, octave: 1, echo: false, peakDb: -24 })
    c.currentTime = 2
    const nodes = created(c, sfx.aboutClose)
    const o = nodes.find((n) => n.kind === 'oscillator')!
    expect(o.type).toBe('square')
    expect(param(o, 'frequency').of('setValueAtTime')[0]).toEqual([660, 2])
    expect(param(o, 'frequency').of('linearRampToValueAtTime')[0][0]).toBe(330)
    expect(o.stops[0][0]).toBeCloseTo(2.11)
    const g = nodes.find((n) => n.kind === 'gain')!
    // attaque et relâche de 6 ms : jamais de saut brutal de gain
    expect(param(g, 'gain').of('linearRampToValueAtTime')[0]).toEqual([0.045, 2.006])
  })

  it('previewEffects : déverrouille puis joue le bip d’ouverture', async () => {
    const { sfx, c } = await load()
    c.state = 'suspended'
    const resume = vi.spyOn(c, 'resume')
    sfx.previewEffects()
    expect(resume).toHaveBeenCalled()
    expect(h.playMotif).toHaveBeenCalled()
  })
})
