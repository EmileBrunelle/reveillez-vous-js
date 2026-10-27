import { ref } from 'vue'
import { muted } from '../../src/audio/sfx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { FADE_IN, FADE_MUTE, FADE_OUT, FADE_XFADE, fadeParam, startAmbience, targetLevel } from '../../src/audio/ambience'
import { EVENT_BOOST, MASTER_GAIN, NOISE_OFFSET_MAX, RECIPES, bedGain, randomDelay } from '../../src/audio/ambienceSynth'
import { NOISE_SECONDS } from '../../src/audio/noise'
import type { PlaceId } from '../../src/effects/places/types'

const PLACES: PlaceId[] = ['perron', 'foret', 'cimetiere', 'rue', 'nuages']

describe('recettes', () => {
  it('couvrent les 5 lieux', () => {
    expect(Object.keys(RECIPES).sort()).toEqual([...PLACES].sort())
    for (const p of PLACES) expect(RECIPES[p].events.length).toBeGreaterThan(0)
  })
  it('chaque lieu a un lit continu (jamais de silence total) et ses événements sont rares (≥ 8 s)', () => {
    for (const p of PLACES) {
      expect(RECIPES[p].beds.length).toBeGreaterThan(0)
      for (const e of RECIPES[p].events) expect(e.min).toBeGreaterThanOrEqual(8)
    }
  })
  it('lits par lieu : rue = bourdon électrique, forêt = souffle, perron = vent, cimetière et nuages = bourdon + médium', () => {
    expect(RECIPES.rue.beds).toEqual(['hum'])
    expect(RECIPES.foret.beds).toEqual(['breath'])
    expect(RECIPES.perron.beds).toEqual(['wind'])
    for (const p of ['cimetiere', 'nuages'] as const) {
      expect(RECIPES[p].beds).toEqual(['drone', 'mid'])
      expect(RECIPES[p].midHz).toBeGreaterThanOrEqual(200)
      expect(RECIPES[p].midHz).toBeLessThanOrEqual(500)
    }
  })
  it('les lits baissent sous la nappe dès le niveau 2, les événements sont surélevés', () => {
    expect(bedGain(1)).toBeGreaterThan(bedGain(2))
    expect(bedGain(2)).toBe(bedGain(5))
    expect(EVENT_BOOST).toBeGreaterThanOrEqual(2.5) // ≈ +8 dB
    expect(EVENT_BOOST).toBeLessThanOrEqual(3.8) // ≈ +11,5 dB
  })
  it('durées de fondu : entrée 2–3 s, fondu enchaîné ≈ 2 s, départ 1,5–2 s, sourdine 0,2–0,3 s', () => {
    expect(FADE_IN).toBeGreaterThanOrEqual(2)
    expect(FADE_IN).toBeLessThanOrEqual(3)
    expect(FADE_XFADE).toBe(2)
    expect(FADE_OUT).toBeGreaterThanOrEqual(1.5)
    expect(FADE_OUT).toBeLessThanOrEqual(2)
    expect(FADE_MUTE).toBeGreaterThanOrEqual(0.2)
    expect(FADE_MUTE).toBeLessThanOrEqual(0.3)
  })
  it('le bus est nettement plus bas qu’avant (0,1)', () => {
    expect(MASTER_GAIN).toBeLessThanOrEqual(0.05)
  })
  it('ont des plages de délais valides', () => {
    for (const p of PLACES)
      for (const e of RECIPES[p].events) {
        expect(e.min).toBeGreaterThan(0)
        expect(e.max).toBeGreaterThan(e.min)
      }
  })
  it('la cloche du cimetière sonne toutes les 16–32 s', () => {
    expect(RECIPES.cimetiere.events.find((e) => e.kind === 'bell')).toMatchObject({ min: 16, max: 32 })
  })
})

describe('randomDelay / targetLevel', () => {
  it('reste dans [min, max]', () => {
    expect(randomDelay(20, 40, () => 0)).toBe(20)
    expect(randomDelay(20, 40, () => 0.999999)).toBeLessThan(40)
    for (let i = 0; i < 200; i++) {
      const d = randomDelay(3, 9)
      expect(d).toBeGreaterThanOrEqual(3)
      expect(d).toBeLessThanOrEqual(9)
    }
  })
  it('coupe le bus si muet, caché ou arrêté', () => {
    expect(targetLevel({ muted: false, hidden: false, stopped: false })).toBe(MASTER_GAIN)
    for (const k of ['muted', 'hidden', 'stopped'] as const) expect(targetLevel({ muted: false, hidden: false, stopped: false, [k]: true })).toBe(0)
  })
})

/** Contexte factice minimal : tout nœud accepte n’importe quelle propriété/méthode, on compte start/stop/disconnect. */
const stats = { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [] as string[], times: [] as number[] }
const param = () => {
  const f = () => void stats.paramCalls++
  // fondus : on garde l’instant de chaque rampe / palier (le contexte factice reste à currentTime = 0)
  const timed = (_v: number, t: number) => {
    stats.paramCalls++
    stats.times.push(t)
  }
  return { value: 0, setValueAtTime: timed, linearRampToValueAtTime: timed, exponentialRampToValueAtTime: f, setTargetAtTime: f, cancelScheduledValues: f }
}
const makeNode = () => {
  stats.created++
  const ended: (() => void)[] = []
  const target: Record<string, unknown> = {
    connect: (n: unknown) => n,
    disconnect: () => void stats.disconnected++,
    start: () => void stats.started++,
    // une source arrêtée déclenche « ended » (asynchrone, comme le vrai AudioNode)
    stop: () => {
      stats.stopped++
      setTimeout(() => ended.splice(0).forEach((f) => f()), 0)
    },
    addEventListener: (type: string, f: () => void) => type === 'ended' && ended.push(f),
    removeEventListener: () => undefined,
  }
  return new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : (t[k] = param())),
    set: (t, k: string, v) => {
      if (k === 'loop' && v === true) stats.looped++
      t[k] = v
      return true
    },
  })
}
class FakeCtx {
  state = 'running'
  currentTime = 0
  sampleRate = 8000
  destination = makeNode()
  createGain = makeNode
  createDynamicsCompressor = makeNode
  createBufferSource = makeNode
  createBiquadFilter = makeNode
  createOscillator = makeNode
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
  addEventListener() {}
  removeEventListener = (type: string) => void stats.removed.push(type)
}

describe('startAmbience (contexte factice)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    Object.assign(stats, { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [], times: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(PLACES)('%s : démarre sans erreur, arrête et déconnecte tout, stop() idempotent', (place) => {
    const stop = startAmbience(place)
    vi.advanceTimersByTime(90_000) // laisse passer des événements
    expect(stats.started).toBeGreaterThan(0)
    stop()
    stop()
    vi.advanceTimersByTime(2500)
    expect(vi.getTimerCount()).toBe(0)
    expect(stats.disconnected).toBeGreaterThanOrEqual(stats.created - 7) // tout sauf le destination fictif, le limiteur, sa compensation et les 4 bus de catégorie (persistants, partagés par tout le contexte)
    const after = stats.created
    vi.advanceTimersByTime(120_000)
    expect(stats.created).toBe(after) // plus aucun événement
  })

  it.each(PLACES)('%s : seuls les lits de bruit filtré bouclent, une source bouclée par lit de bruit', (place) => {
    const stop = startAmbience(place)
    vi.advanceTimersByTime(120_000)
    expect(stats.looped).toBe(RECIPES[place].beds.filter((b) => b === 'breath' || b === 'wind' || b === 'mid').length)
    stop()
    vi.advanceTimersByTime(2500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('les événements sont programmés avec de longs silences, puis plus rien après stop()', () => {
    const stop = startAmbience('foret')
    const base = stats.created
    const startedBase = stats.started
    vi.advanceTimersByTime(5000)
    vi.advanceTimersByTime(115_000)
    expect(stats.created).toBeGreaterThan(base) // des événements ont eu lieu
    expect(stats.started - startedBase).toBeLessThan(30) // et pas un flot continu
    stop()
    vi.advanceTimersByTime(2500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('à l’arrêt, toutes les minuteries de la portée sont annulées d’un coup : il ne reste que la libération différée', () => {
    const stop = startAmbience('cimetiere')
    vi.advanceTimersByTime(60_000)
    expect(vi.getTimerCount()).toBeGreaterThan(1) // événements, sons rares, avertissement
    stop()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(2500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('muet : aucun événement n’est déclenché', () => {
    muted.value = true
    const stop = startAmbience('perron')
    const base = stats.created
    vi.advanceTimersByTime(120_000)
    expect(stats.created).toBe(base)
    stop()
    muted.value = false
  })

  it('les sons ponctuels sont déconnectés à leur fin, avant stop()', () => {
    const stop = startAmbience('foret')
    vi.advanceTimersByTime(30_000)
    expect(stats.disconnected).toBeGreaterThan(0)
    stop()
  })

  it('après stop : toutes les sources arrêtées, écouteur retiré, muted ne touche plus le master', () => {
    const stop = startAmbience('cimetiere')
    vi.advanceTimersByTime(60_000)
    stop()
    vi.advanceTimersByTime(2500)
    expect(stats.stopped).toBeGreaterThanOrEqual(stats.started)
    expect(stats.removed).toContain('statechange')
    const calls = stats.paramCalls
    muted.value = true
    muted.value = false
    expect(stats.paramCalls).toBe(calls)
  })

  it('sans AudioContext : renvoie un stop inoffensif', () => {
    vi.stubGlobal('window', {})
    expect(() => startAmbience('perron')()).not.toThrow()
  })
})

describe('fondus de startAmbience (contexte factice)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000) // hors de la fenêtre de fondu enchaîné d’un arrêt précédent
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    Object.assign(stats, { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [], times: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    muted.value = false
  })
  const lastFade = () => Math.max(...stats.times)

  it('entrée d’un lieu : montée de 2,5 s', () => {
    const stop = startAmbience('rue')
    expect(lastFade()).toBeCloseTo(FADE_IN, 5)
    stop()
    vi.advanceTimersByTime(2500)
  })

  it('changement de lieu (arrêt puis démarrage aussitôt) : le nouveau lieu monte en 2 s, symétrique de la descente de l’ancien', () => {
    const first = startAmbience('perron')
    stats.times = []
    first()
    expect(lastFade()).toBeCloseTo(FADE_OUT, 5)
    stats.times = []
    const second = startAmbience('foret')
    expect(lastFade()).toBeCloseTo(FADE_XFADE, 5)
    expect(FADE_XFADE).toBe(FADE_OUT)
    second()
    vi.advanceTimersByTime(2500)
  })

  it('entrée longtemps après un arrêt : retour à la montée de 2,5 s', () => {
    startAmbience('perron')()
    vi.advanceTimersByTime(2500)
    stats.times = []
    const stop = startAmbience('foret')
    expect(lastFade()).toBeCloseTo(FADE_IN, 5)
    stop()
    vi.advanceTimersByTime(2500)
  })

  it('départ : descente de 2 s, puis sources arrêtées et déconnectées (pas de coupure avant la fin du fondu)', () => {
    const stop = startAmbience('cimetiere')
    vi.advanceTimersByTime(5000)
    stats.times = []
    const stoppedBefore = stats.stopped
    stop()
    expect(lastFade()).toBeCloseTo(FADE_OUT, 5)
    vi.advanceTimersByTime(FADE_OUT * 1000 - 100)
    expect(stats.stopped).toBe(stoppedBefore) // le fondu n’est pas coupé
    vi.advanceTimersByTime(400)
    expect(stats.stopped).toBeGreaterThan(stoppedBefore)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sourdine : fondu de 0,25 s', async () => {
    const stop = startAmbience('rue')
    vi.advanceTimersByTime(5000)
    stats.times = []
    muted.value = true
    await nextTick()
    expect(lastFade()).toBeCloseTo(FADE_MUTE, 5)
    stop()
    vi.advanceTimersByTime(2500)
  })

  it('un statechange du contexte n’écrase pas un fondu en cours', async () => {
    const listeners: (() => void)[] = []
    const ctx = new FakeCtx()
    ctx.addEventListener = ((_t: string, f: () => void) => void listeners.push(f)) as typeof ctx.addEventListener
    vi.stubGlobal('window', {
      AudioContext: class extends FakeCtx {
        constructor() {
          super()
          return ctx
        }
      },
    })
    // contexte déjà partagé par les tests précédents : on repart d’un contexte neuf via un module propre
    vi.resetModules()
    const { createPinia: newPinia, setActivePinia: setPinia } = await import('pinia')
    setPinia(newPinia())
    const sfx = await import('../../src/audio/sfx')
    const amb = await import('../../src/audio/ambience')
    const stop = amb.startAmbience('rue')
    vi.advanceTimersByTime(3000)
    sfx.muted.value = true
    await nextTick()
    stats.times = []
    listeners.forEach((f) => f())
    expect(stats.times).toEqual([]) // même cible : rien de reprogrammé
    sfx.muted.value = false
    stop()
    vi.advanceTimersByTime(2500)
  })
})

describe('fadeParam (rampes planifiées)', () => {
  /** AudioParam factice qui enregistre ses événements ; `value` est réglable pour simuler un fondu en cours. */
  const mockParam = (value: number) => {
    const events: { kind: string; v?: number; t: number }[] = []
    const p = {
      value,
      cancelScheduledValues: (t: number) => void events.push({ kind: 'cancel', t }),
      setValueAtTime: (v: number, t: number) => void events.push({ kind: 'set', v, t }),
      linearRampToValueAtTime: (v: number, t: number) => void events.push({ kind: 'ramp', v, t }),
    }
    return { p: p as unknown as AudioParam, events }
  }
  const ramps = (events: ReturnType<typeof mockParam>['events']) => events.filter((e) => e.kind === 'ramp')

  it('annule le planifié, ancre la valeur courante, puis monte jusqu’à la cible à now + dur', () => {
    const { p, events } = mockParam(0)
    fadeParam(p, 10, 0.045, 2.5)
    expect(events[0]).toEqual({ kind: 'cancel', t: 10 })
    expect(events[1]).toEqual({ kind: 'set', v: 0, t: 10 })
    const r = ramps(events)
    expect(r.at(-1)).toEqual({ kind: 'ramp', v: 0.045, t: 12.5 })
    for (let i = 1; i < r.length; i++) {
      expect(r[i].v!).toBeGreaterThanOrEqual(r[i - 1].v!)
      expect(r[i].t).toBeGreaterThan(r[i - 1].t)
    }
  })

  it('puissance constante : une montée (sinus) et une descente (cosinus) de même durée somment à 1 en puissance', () => {
    const up = mockParam(0)
    const down = mockParam(1)
    fadeParam(up.p, 0, 1, 2)
    fadeParam(down.p, 0, 0, 2)
    const u = ramps(up.events)
    const d = ramps(down.events)
    expect(u.length).toBe(d.length)
    for (let i = 0; i < u.length; i++) {
      expect(u[i].t).toBeCloseTo(d[i].t, 9)
      expect(u[i].v! ** 2 + d[i].v! ** 2).toBeCloseTo(1, 1) // les rampes linéaires approchent le quart de cercle (écart < 0,05)
    }
  })

  it('changement en plein fondu : repart de la valeur courante, sans saut', () => {
    const { p, events } = mockParam(0.02) // fondu d’entrée interrompu à 0,02
    fadeParam(p, 5, 0, 0.25)
    expect(events[0]).toEqual({ kind: 'cancel', t: 5 })
    expect(events[1]).toEqual({ kind: 'set', v: 0.02, t: 5 })
    const r = ramps(events)
    expect(r[0].v!).toBeLessThanOrEqual(0.02)
    for (let i = 1; i < r.length; i++) expect(r[i].v!).toBeLessThanOrEqual(r[i - 1].v!)
    expect(r.at(-1)).toEqual({ kind: 'ramp', v: 0, t: 5.25 })
  })

  it('même cible : pas de rampe, simple palier', () => {
    const { p, events } = mockParam(0.045)
    fadeParam(p, 3, 0.045, 2)
    expect(ramps(events)).toEqual([])
  })
})

describe('niveau de paranoïa dans startAmbience', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    Object.assign(stats, { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [], times: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('niveau 5 : plus de sources démarrées qu’au niveau 1 (sons rares), et tout s’arrête proprement', () => {
    const run = (level: number) => {
      stats.started = 0
      const stop = startAmbience('cimetiere', () => level)
      vi.advanceTimersByTime(600_000)
      const n = stats.started
      stop()
      vi.advanceTimersByTime(2500)
      expect(vi.getTimerCount()).toBe(0)
      return n
    }
    const low = run(1)
    const high = run(5)
    expect(high).toBeGreaterThan(low)
  })

  it('le changement de niveau en cours de route ré-arme sans fuite de minuterie', () => {
    const lvl = ref(1)
    const stop = startAmbience('perron', () => lvl.value)
    lvl.value = 4
    vi.advanceTimersByTime(60_000)
    lvl.value = 2
    vi.advanceTimersByTime(60_000)
    stop()
    vi.advanceTimersByTime(2500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('muet : aucun son créé au niveau 5', () => {
    muted.value = true
    const stop = startAmbience('perron', () => 5)
    const base = stats.created
    vi.advanceTimersByTime(300_000)
    expect(stats.created).toBe(base)
    stop()
    muted.value = false
  })
})

describe('tampon de bruit', () => {
  it('couvre la plus longue houle malgré le décalage de départ', () => {
    expect(NOISE_SECONDS - NOISE_OFFSET_MAX).toBeGreaterThanOrEqual(6.1) // airSwell : 6 s + marge de stop
  })
})
