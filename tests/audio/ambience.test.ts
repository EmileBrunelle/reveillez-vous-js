import { ref } from 'vue'
import { muted } from '../../src/audio/sfx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MASTER_GAIN, NOISE_OFFSET_MAX, NOISE_SECONDS, RECIPES, randomDelay, startAmbience, targetLevel } from '../../src/audio/ambience'
import type { PlaceId } from '../../src/effects/places/types'

const PLACES: PlaceId[] = ['perron', 'foret', 'cimetiere', 'rue', 'nuages']

describe('recettes', () => {
  it('couvrent les 5 lieux', () => {
    expect(Object.keys(RECIPES).sort()).toEqual([...PLACES].sort())
    for (const p of PLACES) expect(RECIPES[p].events.length).toBeGreaterThan(0)
  })
  it('aucun lit de bruit : seul un bourdon est permis, et les événements sont rares (≥ 8 s)', () => {
    for (const p of PLACES) {
      for (const b of RECIPES[p].beds) expect(b).toBe('drone')
      for (const e of RECIPES[p].events) expect(e.min).toBeGreaterThanOrEqual(8)
    }
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
const stats = { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [] as string[] }
const param = () => {
  const f = () => void stats.paramCalls++
  return { value: 0, setValueAtTime: f, linearRampToValueAtTime: f, exponentialRampToValueAtTime: f, setTargetAtTime: f, cancelScheduledValues: f }
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
  createBufferSource = makeNode
  createBiquadFilter = makeNode
  createOscillator = makeNode
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
  addEventListener() {}
  removeEventListener = (type: string) => void stats.removed.push(type)
}

describe('startAmbience (contexte factice)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    Object.assign(stats, { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [] })
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
    vi.advanceTimersByTime(2000)
    expect(vi.getTimerCount()).toBe(0)
    expect(stats.disconnected).toBeGreaterThanOrEqual(stats.created - 1) // tout sauf le destination fictif
    const after = stats.created
    vi.advanceTimersByTime(120_000)
    expect(stats.created).toBe(after) // plus aucun événement
  })

  it.each(PLACES)('%s : aucune source de bruit bouclée (pas de lit continu)', (place) => {
    const stop = startAmbience(place)
    vi.advanceTimersByTime(120_000)
    expect(stats.looped).toBe(0)
    stop()
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
    vi.advanceTimersByTime(2000)
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
    vi.advanceTimersByTime(2000)
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

describe('niveau de paranoïa dans startAmbience', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    Object.assign(stats, { created: 0, started: 0, stopped: 0, disconnected: 0, paramCalls: 0, looped: 0, removed: [] })
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
      vi.advanceTimersByTime(2000)
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
    vi.advanceTimersByTime(2000)
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
