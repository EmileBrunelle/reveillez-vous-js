import { effectScope, ref, watch } from 'vue'
import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import type { PlaceId } from '../effects/places/types'
import { ac, muted, noiseBuffer } from './sfx'

/** Niveau du bus d’ambiance (≈ -27 dBFS) : moins de la moitié de l’ancien 0,1, bien sous les coups et la voix. */
export const MASTER_GAIN = 0.045
/** Constantes de temps (setTargetAtTime) : ≈ 1,5 s à l’entrée, ≈ 0,8 s à la sortie, < 0,3 s pour le mute. */
const TC_IN = 0.4
const TC_OUT = 0.18
const TC_MUTE = 0.07
const STOP_AFTER_MS = 1100
/** Espacement minimal entre deux événements d’un même lieu. */
const MIN_SPACING_MS = 3000

export type EventKind = 'gust' | 'creak' | 'owl' | 'twig' | 'rustle' | 'bell' | 'crow' | 'dog' | 'door' | 'chime' | 'airSwell'
/** Seul lit continu autorisé : un bourdon grave, très doux (jamais de bruit large bande). */
export type BedKind = 'drone'

export interface EventSpec {
  kind: EventKind
  /** Délai min/max (s) entre deux occurrences. */
  min: number
  max: number
}

export interface Recipe {
  beds: BedKind[]
  /** Fréquence fondamentale du bourdon (Hz), si le lieu en a un. */
  droneHz?: number
  events: EventSpec[]
}

/** Peu de son, beaucoup d’atmosphère : événements rares, longs silences entre eux. */
export const RECIPES: Record<PlaceId, Recipe> = {
  perron: {
    beds: [],
    events: [
      { kind: 'gust', min: 9, max: 22 },
      { kind: 'creak', min: 16, max: 34 },
    ],
  },
  foret: {
    beds: [],
    events: [
      { kind: 'owl', min: 14, max: 30 },
      { kind: 'twig', min: 10, max: 24 },
      { kind: 'rustle', min: 9, max: 20 },
    ],
  },
  cimetiere: {
    beds: ['drone'],
    droneHz: 55,
    events: [
      { kind: 'bell', min: 16, max: 32 },
      { kind: 'crow', min: 14, max: 30 },
    ],
  },
  rue: {
    beds: [],
    events: [
      { kind: 'dog', min: 15, max: 32 },
      { kind: 'door', min: 12, max: 26 },
    ],
  },
  nuages: {
    beds: ['drone'],
    droneHz: 110,
    events: [
      { kind: 'chime', min: 8, max: 20 },
      { kind: 'airSwell', min: 10, max: 24 },
    ],
  },
}

/** Délai aléatoire dans [min, max] (rng ∈ [0,1[). */
export const randomDelay = (min: number, max: number, rng: () => number = Math.random) => min + (max - min) * rng()

/** Niveau cible du bus : 0 si coupé, onglet caché ou arrêté. */
export const targetLevel = (s: { muted: boolean; hidden: boolean; stopped: boolean }) => (s.muted || s.hidden || s.stopped ? 0 : MASTER_GAIN)

const rnd = (a: number, b: number) => randomDelay(a, b)

/** Durée du tampon de bruit : couvre la plus longue houle (6 s) avec un décalage de départ ≤ NOISE_OFFSET_MAX. */
export const NOISE_SECONDS = 9
export const NOISE_OFFSET_MAX = 1.5
const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
const sharedNoise = (c: AudioContext) => {
  let b = noiseCache.get(c)
  if (!b) noiseCache.set(c, (b = noiseBuffer(c, NOISE_SECONDS)))
  return b
}

/** Garde la trace de tout ce qui est créé pour pouvoir tout arrêter et déconnecter. */
const createTracker = () => {
  const nodes = new Set<AudioNode>()
  const sources = new Set<AudioScheduledSourceNode>()
  const add = <T extends AudioNode>(n: T): T => {
    nodes.add(n)
    if ('start' in n) sources.add(n as unknown as AudioScheduledSourceNode)
    return n
  }
  /** Libère un son ponctuel (`group`) dès que sa source la plus longue `last` se termine. */
  const release = (last: AudioScheduledSourceNode, group: AudioNode[]) => {
    last.addEventListener('ended', () => {
      for (const n of group) {
        try {
          n.disconnect()
        } catch {
          /* déjà déconnecté */
        }
        nodes.delete(n)
        sources.delete(n as unknown as AudioScheduledSourceNode)
      }
    })
  }
  const dispose = () => {
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        /* jamais démarrée ou déjà arrêtée */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect()
      } catch {
        /* déjà déconnecté */
      }
    }
    nodes.clear()
    sources.clear()
  }
  return { add, release, dispose }
}
type Tracker = ReturnType<typeof createTracker>

interface Env {
  c: AudioContext
  out: AudioNode
  t: Tracker
  /** Programme une fonction répétée ; tout est nettoyé à l’arrêt. */
  every: (min: number, max: number, fn: () => void) => void
}

const filt = (e: Env, type: BiquadFilterType, freq: number, q = 0.7) => {
  const f = e.t.add(e.c.createBiquadFilter())
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}
const gainNode = (e: Env, v: number) => {
  const g = e.t.add(e.c.createGain())
  g.gain.value = v
  return g
}
const osc = (e: Env, type: OscillatorType, freq: number) => {
  const o = e.t.add(e.c.createOscillator())
  o.type = type
  o.frequency.value = freq
  o.start()
  return o
}

/** Bourdon : sinus en quinte, lowpass doux, gain et filtre qui respirent très lentement (aucun battement audible : le seul écart de fréquence est de 0,05 Hz). */
const drone = (e: Env, hz: number) => {
  const lp = filt(e, 'lowpass', 260, 0.5)
  const g = gainNode(e, 0.3)
  lp.connect(g).connect(e.out)
  osc(e, 'sine', hz).connect(lp)
  osc(e, 'sine', hz * 1.5)
    .connect(gainNode(e, 0.5))
    .connect(lp)
  osc(e, 'sine', hz * 2 + 0.05)
    .connect(gainNode(e, 0.25))
    .connect(lp)
  osc(e, 'sine', 0.045).connect(gainNode(e, 0.12)).connect(g.gain)
  osc(e, 'sine', 0.03).connect(gainNode(e, 70)).connect(lp.frequency)
}

const beds: Record<BedKind, (e: Env, r: Recipe) => void> = {
  drone: (e, r) => drone(e, r.droneHz ?? 55),
}

/** Enveloppe douce : monte, redescend exponentiellement. */
const env = (g: GainNode, at: number, peak: number, attack: number, dur: number) => {
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
}

/** Houle de bruit (non bouclée, bornée) : filtre `type` à `freq`, montée `attack`, durée `dur`. */
const swell = (e: Env, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, dur: number, sweepTo = freq) => {
  const t0 = e.c.currentTime + 0.05
  const s = e.t.add(e.c.createBufferSource())
  s.buffer = sharedNoise(e.c)
  const f = filt(e, type, freq, q)
  f.frequency.setValueAtTime(freq, t0)
  f.frequency.linearRampToValueAtTime(sweepTo, t0 + dur)
  const lp = filt(e, 'lowpass', Math.max(freq * 1.6, 600), 0.5)
  const g = gainNode(e, 0)
  env(g, t0, peak, attack, dur)
  s.connect(f).connect(lp).connect(g).connect(e.out)
  s.start(t0, Math.random() * NOISE_OFFSET_MAX)
  s.stop(t0 + dur + 0.1)
  e.t.release(s, [s, f, lp, g])
}

/** Son tonal lointain : un oscillateur et un gain par note (pas de troncature de queue), `notes` = [décalage, Hz, durée]. */
const tones = (e: Env, type: OscillatorType, cutoff: number, peak: number, notes: [number, number, number][], attack = 0.06) => {
  const t0 = e.c.currentTime + 0.05
  const lp = filt(e, 'lowpass', cutoff, 0.6)
  lp.connect(e.out)
  const group: AudioNode[] = [lp]
  let last: OscillatorNode | undefined
  let lastEnd = -1
  for (const [dt, f, dur] of notes) {
    const o = e.t.add(e.c.createOscillator())
    o.type = type
    o.frequency.setValueAtTime(f * 1.05, t0 + dt)
    o.frequency.exponentialRampToValueAtTime(f, t0 + dt + 0.1)
    const g = gainNode(e, 0)
    env(g, t0 + dt, peak, attack, dur)
    o.connect(g).connect(lp)
    o.start(t0 + dt)
    o.stop(t0 + dt + dur + 0.1)
    group.push(o, g)
    if (dt + dur > lastEnd) {
      lastEnd = dt + dur
      last = o
    }
  }
  if (last) e.t.release(last, group)
}

const events: Record<EventKind, (e: Env) => void> = {
  gust: (e) => swell(e, 'bandpass', rnd(380, 520), 0.6, 0.35, 1.8, 4.5, rnd(260, 360)),
  airSwell: (e) => swell(e, 'bandpass', rnd(600, 800), 0.5, 0.2, 2.5, 6, rnd(900, 1100)),
  rustle: (e) => swell(e, 'bandpass', rnd(1800, 2400), 0.8, 0.14, 0.9, 2.4),
  twig: (e) => swell(e, 'bandpass', rnd(1100, 1500), 3, 0.3, 0.004, 0.09),
  owl: (e) =>
    tones(
      e,
      'sine',
      700,
      0.3,
      [
        [0, 400, 0.4],
        [0.55, 340, 0.7],
      ],
      0.1,
    ),
  crow: (e) => {
    const n = 2 + Math.floor(Math.random() * 2)
    const notes = Array.from({ length: n }, (_, i): [number, number, number] => [i * 0.5, rnd(480, 540), 0.34])
    tones(e, 'sawtooth', 800, 0.14, notes, 0.04)
  },
  dog: (e) => {
    const n = 2 + Math.floor(Math.random() * 2)
    const notes = Array.from({ length: n }, (_, i): [number, number, number] => [i * 0.45, rnd(280, 320), 0.22])
    tones(e, 'sawtooth', 520, 0.12, notes, 0.03)
  },
  creak: (e) => {
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t0)
    o.frequency.linearRampToValueAtTime(52, t0 + 1.4)
    const bp = filt(e, 'bandpass', 240, 3)
    const lp = filt(e, 'lowpass', 400)
    const g = gainNode(e, 0)
    env(g, t0, 0.22, 0.5, 1.5)
    o.connect(bp).connect(lp).connect(g).connect(e.out)
    o.start(t0)
    o.stop(t0 + 1.6)
    e.t.release(o, [o, bp, lp, g])
  },
  door: (e) => {
    // porte lointaine : un « toum » sourd qui retombe
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.frequency.setValueAtTime(95, t0)
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.25)
    const g = gainNode(e, 0)
    env(g, t0, 0.35, 0.01, 0.5)
    o.connect(g).connect(e.out)
    o.start(t0)
    o.stop(t0 + 0.6)
    e.t.release(o, [o, g])
  },
  chime: (e) => {
    const base = [523.3, 659.3, 784, 880][Math.floor(Math.random() * 4)] ?? 523.3
    tones(
      e,
      'sine',
      2200,
      0.1,
      [
        [0, base, 3.5],
        [0.4, base * 1.5, 3],
      ],
      0.02,
    )
  },
  bell: (e) => {
    const t0 = e.c.currentTime + 0.05
    const base = 174.6
    const g = gainNode(e, 0.6)
    const lp = filt(e, 'lowpass', 1800, 0.5)
    g.connect(lp).connect(e.out)
    const group: AudioNode[] = [g, lp]
    let longest: OscillatorNode | undefined
    for (const [ratio, amp, dur] of [
      [1, 0.5, 7],
      [2.0, 0.3, 5.5],
      [2.76, 0.22, 4],
      [5.4, 0.08, 2.5],
    ] as const) {
      const o = e.t.add(e.c.createOscillator())
      o.frequency.value = base * ratio
      const pg = gainNode(e, 0)
      env(pg, t0, amp, 0.02, dur)
      o.connect(pg).connect(g)
      o.start(t0)
      o.stop(t0 + dur + 0.1)
      group.push(o, pg)
      longest ??= o
    }
    if (longest) e.t.release(longest, group)
  },
}

/**
 * Ambiance sonore d’un lieu, synthétisée (Web Audio) : événements rares (longs silences) + éventuellement un bourdon très doux.
 * Fondu d’entrée ~1,5 s, de sortie ~0,8 s ; suit `muted` et la visibilité de l’onglet ; attend que le
 * contexte soit déverrouillé. Renvoie la fonction d’arrêt (idempotente).
 */
export const startAmbience = (place: PlaceId): (() => void) => {
  const c = ac()
  if (!c) return () => undefined

  const t = createTracker()
  const scope = effectScope(true)
  let stopped = false
  let hidden = false
  let lastEventAt = -Infinity

  const master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)

  const level = () => targetLevel({ muted: muted.value, hidden, stopped })
  const ramp = (tc: number) => {
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setTargetAtTime(level(), c.currentTime, tc)
  }
  const running = () => c.state === 'running' && level() > 0

  const e: Env = {
    c,
    out: master,
    t,
    // un seul useTimeoutFn par récurrence, ré-armé à chaque tour ; arrêté avec le scope
    every: (min, max, fn) => {
      const interval = ref(0)
      let first = true
      const arm = (s: number) => {
        interval.value = s * 1000
        start()
      }
      const { start } = useTimeoutFn(
        () => {
          if (stopped) return
          if (running()) {
            const now = Date.now()
            // espacement minimal entre événements de natures différentes
            if (now - lastEventAt < MIN_SPACING_MS) return arm(MIN_SPACING_MS / 1000 + Math.random() * 2)
            lastEventAt = now
            fn()
          }
          arm(randomDelay(min, max))
        },
        interval,
        { immediate: false },
      )
      arm(randomDelay(first ? min * 0.3 : min, first ? max * 0.3 : max))
      first = false
    },
  }

  scope.run(() => {
    for (const b of RECIPES[place].beds) beds[b](e, RECIPES[place])
    for (const ev of RECIPES[place].events) e.every(ev.min, ev.max, () => events[ev.kind](e))
  })

  const onState = () => ramp(TC_IN)
  c.addEventListener('statechange', onState)
  ramp(TC_IN)

  scope.run(() => {
    const visibility = useDocumentVisibility()
    watch(
      visibility,
      (v) => {
        hidden = v === 'hidden'
        ramp(hidden ? TC_OUT : TC_IN)
      },
      { immediate: true },
    )
    watch(muted, (m) => ramp(m ? TC_MUTE : TC_IN))
  })

  return () => {
    if (stopped) return
    stopped = true
    scope.stop()
    c.removeEventListener('statechange', onState)
    ramp(TC_OUT)
    const { start } = useTimeoutFn(
      () => {
        t.dispose()
        master.disconnect()
      },
      STOP_AFTER_MS,
      { immediate: false },
    )
    start()
  }
}
