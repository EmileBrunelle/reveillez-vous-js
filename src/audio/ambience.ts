import { effectScope, watch } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import type { PlaceId } from '../effects/places/types'
import { ac, muted, noiseBuffer } from './sfx'

/** Niveau du bus d’ambiance (≈ -20 dBFS (les sources filtrées sortent bien plus bas)) : un lit sous les coups et la voix, jamais par-dessus. */
export const MASTER_GAIN = 0.1
/** Constantes de temps (setTargetAtTime) : ≈ 1,5 s à l’entrée, ≈ 0,8 s à la sortie, < 0,3 s pour le mute. */
const TC_IN = 0.4
const TC_OUT = 0.18
const TC_MUTE = 0.07
const STOP_AFTER_MS = 1100

export type EventKind = 'dog' | 'creak' | 'cricket' | 'owl' | 'crow' | 'bell' | 'car'
export type BedKind = 'wind' | 'branches' | 'lowWind' | 'hum' | 'rain' | 'pad' | 'softWind'

export interface EventSpec {
  kind: EventKind
  /** Délai min/max (s) entre deux occurrences. */
  min: number
  max: number
}

export interface Recipe {
  beds: BedKind[]
  events: EventSpec[]
}

export const RECIPES: Record<PlaceId, Recipe> = {
  perron: {
    beds: ['wind'],
    events: [
      { kind: 'dog', min: 25, max: 60 },
      { kind: 'creak', min: 18, max: 45 },
    ],
  },
  foret: {
    beds: ['branches'],
    events: [
      { kind: 'cricket', min: 0.4, max: 2.2 },
      { kind: 'owl', min: 14, max: 35 },
    ],
  },
  cimetiere: {
    beds: ['lowWind'],
    events: [
      { kind: 'crow', min: 20, max: 50 },
      { kind: 'bell', min: 20, max: 40 },
    ],
  },
  rue: {
    beds: ['hum', 'rain'],
    events: [
      { kind: 'car', min: 12, max: 30 },
      { kind: 'dog', min: 35, max: 80 },
    ],
  },
  nuages: { beds: ['pad', 'softWind'], events: [] },
}

/** Délai aléatoire dans [min, max] (rng ∈ [0,1[). */
export const randomDelay = (min: number, max: number, rng: () => number = Math.random) => min + (max - min) * rng()

/** Niveau cible du bus : 0 si coupé, onglet caché ou arrêté. */
export const targetLevel = (s: { muted: boolean; hidden: boolean; stopped: boolean }) => (s.muted || s.hidden || s.stopped ? 0 : MASTER_GAIN)

const rnd = (a: number, b: number) => randomDelay(a, b)

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
const sharedNoise = (c: AudioContext) => {
  let b = noiseCache.get(c)
  if (!b) noiseCache.set(c, (b = noiseBuffer(c, 4)))
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

const noiseSrc = (e: Env) => {
  const s = e.t.add(e.c.createBufferSource())
  s.buffer = sharedNoise(e.c)
  s.loop = true
  s.start(0, Math.random() * 2)
  return s
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

/** Bruit filtré dont le gain dérive au hasard : rafales. */
const gusts = (e: Env, type: BiquadFilterType, freq: number, q: number, lo: number, hi: number, every: [number, number]) => {
  const g = gainNode(e, lo)
  noiseSrc(e)
    .connect(filt(e, type, freq, q))
    .connect(g)
    .connect(e.out)
  e.every(every[0], every[1], () => g.gain.setTargetAtTime(rnd(lo, hi), e.c.currentTime, 1.4))
}

const beds: Record<BedKind, (e: Env) => void> = {
  wind: (e) => gusts(e, 'bandpass', 520, 0.5, 0.05, 0.5, [2, 6]),
  branches: (e) => gusts(e, 'bandpass', 1400, 0.6, 0.04, 0.3, [2, 5]),
  lowWind: (e) => gusts(e, 'lowpass', 300, 0.7, 0.12, 0.6, [3, 8]),
  softWind: (e) => gusts(e, 'bandpass', 700, 0.4, 0.02, 0.12, [4, 9]),
  hum: (e) => {
    noiseSrc(e)
      .connect(filt(e, 'lowpass', 220))
      .connect(gainNode(e, 0.35))
      .connect(e.out)
    osc(e, 'sine', 55).connect(gainNode(e, 0.05)).connect(e.out)
    osc(e, 'sine', 110.7).connect(gainNode(e, 0.025)).connect(e.out)
  },
  rain: (e) => {
    noiseSrc(e)
      .connect(filt(e, 'highpass', 3500))
      .connect(gainNode(e, 0.05))
      .connect(e.out)
  },
  pad: (e) => {
    const lp = filt(e, 'lowpass', 500, 0.8)
    lp.connect(gainNode(e, 0.16)).connect(e.out)
    for (const [f, d] of [
      [110, -6],
      [110, 5],
      [165, -4],
      [220.5, 7],
      [277.2, -8],
    ] as const) {
      const o = osc(e, 'sine', f)
      o.detune.value = d
      o.connect(lp)
    }
    osc(e, 'sine', 0.06).connect(gainNode(e, 280)).connect(lp.frequency)
  },
}

/** Enveloppe courte : monte vite, redescend exponentiellement. */
const env = (g: GainNode, at: number, peak: number, attack: number, dur: number) => {
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
}

const events: Record<EventKind, (e: Env) => void> = {
  cricket: (e) => {
    const t0 = e.c.currentTime + 0.02
    const f = rnd(4000, 4700)
    const pulses = 3 + Math.floor(Math.random() * 3)
    const o = e.t.add(e.c.createOscillator())
    o.frequency.value = f
    const mod = e.t.add(e.c.createOscillator())
    mod.frequency.value = f * 0.5
    const modG = gainNode(e, 160)
    mod.connect(modG).connect(o.frequency)
    const g = gainNode(e, 0)
    for (let i = 0; i < pulses; i++) env(g, t0 + i * 0.07, 0.07, 0.01, 0.05)
    o.connect(g).connect(e.out)
    const end = t0 + pulses * 0.07 + 0.1
    o.start(t0)
    mod.start(t0)
    o.stop(end)
    mod.stop(end)
    e.t.release(o, [o, mod, modG, g])
  },
  owl: (e) => {
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    const g = gainNode(e, 0)
    const vib = e.t.add(e.c.createOscillator())
    vib.frequency.value = 6
    const vibG = gainNode(e, 5)
    vib.connect(vibG).connect(o.frequency)
    const hoots: [number, number, number][] = [
      [0, 0.28, 400],
      [0.5, 0.55, 340],
    ]
    for (const [dt, dur, f] of hoots) {
      o.frequency.setValueAtTime(f * 1.06, t0 + dt)
      o.frequency.exponentialRampToValueAtTime(f, t0 + dt + 0.08)
      env(g, t0 + dt, 0.5, 0.06, dur)
    }
    o.connect(g).connect(e.out)
    o.start(t0)
    vib.start(t0)
    o.stop(t0 + 1.2)
    vib.stop(t0 + 1.2)
    e.t.release(o, [o, vib, vibG, g])
  },
  crow: (e) => {
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.type = 'sawtooth'
    const bp = filt(e, 'bandpass', 1000, 2)
    const g = gainNode(e, 0)
    const n = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      const at = t0 + i * 0.42
      o.frequency.setValueAtTime(rnd(520, 600), at)
      o.frequency.exponentialRampToValueAtTime(330, at + 0.28)
      env(g, at, 0.45, 0.03, 0.3)
    }
    o.connect(bp).connect(g).connect(e.out)
    o.start(t0)
    o.stop(t0 + n * 0.42 + 0.1)
    e.t.release(o, [o, bp, g])
  },
  bell: (e) => {
    const t0 = e.c.currentTime + 0.05
    const base = 174.6
    const g = gainNode(e, 1)
    g.connect(e.out)
    const group: AudioNode[] = [g]
    let longest: OscillatorNode | undefined
    for (const [ratio, amp, dur] of [
      [1, 0.5, 7],
      [2.0, 0.3, 5.5],
      [2.76, 0.22, 4],
      [5.4, 0.1, 2.5],
      [8.93, 0.05, 1.5],
    ] as const) {
      const o = e.t.add(e.c.createOscillator())
      o.frequency.value = base * ratio
      const pg = gainNode(e, 0)
      env(pg, t0, amp, 0.01, dur)
      o.connect(pg).connect(g)
      o.start(t0)
      o.stop(t0 + dur + 0.1)
      group.push(o, pg)
      longest ??= o
    }
    if (longest) e.t.release(longest, group)
  },
  dog: (e) => {
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.type = 'sawtooth'
    const bp = filt(e, 'bandpass', 700, 1.5)
    const lp = filt(e, 'lowpass', 900)
    const g = gainNode(e, 0)
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const at = t0 + i * 0.38
      o.frequency.setValueAtTime(rnd(300, 360), at)
      o.frequency.exponentialRampToValueAtTime(190, at + 0.15)
      env(g, at, 0.3, 0.015, 0.17)
    }
    o.connect(bp).connect(lp).connect(g).connect(e.out)
    o.start(t0)
    o.stop(t0 + n * 0.38 + 0.1)
    e.t.release(o, [o, bp, lp, g])
  },
  creak: (e) => {
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t0)
    o.frequency.linearRampToValueAtTime(48, t0 + 1.3)
    const lfo = e.t.add(e.c.createOscillator())
    lfo.frequency.value = 23
    const lfoG = gainNode(e, 9)
    lfo.connect(lfoG).connect(o.frequency)
    const bp = filt(e, 'bandpass', 260, 4)
    const g = gainNode(e, 0)
    env(g, t0, 0.35, 0.4, 1.4)
    o.connect(bp).connect(g).connect(e.out)
    o.start(t0)
    lfo.start(t0)
    o.stop(t0 + 1.5)
    lfo.stop(t0 + 1.5)
    e.t.release(o, [o, lfo, lfoG, bp, g])
  },
  car: (e) => {
    const t0 = e.c.currentTime + 0.05
    const s = e.t.add(e.c.createBufferSource())
    s.buffer = sharedNoise(e.c)
    const bp = filt(e, 'bandpass', 300, 1.2)
    bp.frequency.setValueAtTime(260, t0)
    bp.frequency.linearRampToValueAtTime(620, t0 + 2.2)
    bp.frequency.linearRampToValueAtTime(300, t0 + 4.4)
    const g = gainNode(e, 0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.35, t0 + 2.2)
    g.gain.linearRampToValueAtTime(0.0001, t0 + 4.4)
    s.connect(bp).connect(g).connect(e.out)
    s.start(t0)
    s.stop(t0 + 4.5)
    e.t.release(s, [s, bp, g])
  },
}

/**
 * Ambiance sonore d’un lieu, synthétisée (Web Audio) : un lit continu + quelques événements rares.
 * Fondu d’entrée ~1,5 s, de sortie ~0,8 s ; suit `muted` et la visibilité de l’onglet ; attend que le
 * contexte soit déverrouillé. Renvoie la fonction d’arrêt (idempotente).
 */
export const startAmbience = (place: PlaceId): (() => void) => {
  const c = ac()
  if (!c) return () => undefined

  const t = createTracker()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  let hidden = false

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
    every: (min, max, fn) => {
      const loop = (first: boolean) => {
        const id = setTimeout(
          () => {
            timers.delete(id)
            if (stopped) return
            if (running()) fn()
            loop(false)
          },
          randomDelay(first ? min * 0.3 : min, first ? max * 0.3 : max) * 1000,
        )
        timers.add(id)
      }
      loop(true)
    },
  }

  for (const b of RECIPES[place].beds) beds[b](e)
  for (const ev of RECIPES[place].events) e.every(ev.min, ev.max, () => events[ev.kind](e))

  const onState = () => ramp(TC_IN)
  c.addEventListener('statechange', onState)
  ramp(TC_IN)

  const scope = effectScope(true)
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
    for (const id of timers) clearTimeout(id)
    timers.clear()
    c.removeEventListener('statechange', onState)
    ramp(TC_OUT)
    setTimeout(() => {
      t.dispose()
      master.disconnect()
    }, STOP_AFTER_MS)
  }
}
