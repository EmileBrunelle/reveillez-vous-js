import { effectScope, ref, watch } from 'vue'
import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import type { PlaceId } from '../effects/places/types'
import { ac, ambienceOut, muted, noiseBuffer } from './sfx'
import { BASS_PARTIALS, PAD_DEPTH, PAD_VOICES, RARE_BOOST, nextRareDelay, padGain, pickRareKind, subGain, type RareKind } from './paranoiaAudio'

/** Niveau du bus d’ambiance (≈ -27 dBFS) : moins de la moitié de l’ancien 0,1, bien sous les coups et la voix. */
export const MASTER_GAIN = 0.045
/** Durées des fondus (s) : entrée d’un lieu, fondu enchaîné d’un lieu à l’autre, départ (porte fermée, finale), sourdine. */
export const FADE_IN = 2.5
export const FADE_XFADE = 2
export const FADE_OUT = 2
export const FADE_MUTE = 0.25
/** Fondu bref quand l’onglet se cache ou revient. */
const FADE_HIDDEN = 0.5
/** Nombre de segments d’un fondu (rampes linéaires approchant le quart de cosinus / sinus). */
const FADE_STEPS = 24
/** Gain du bus des événements de lieu (+≈ 11 dB) : ils étaient ≈ -45 dBFS crête, inaudibles sous la voix d’un portable. */
export const EVENT_BOOST = 3.6
/** Montée/descente de la basse et de la nappe entre deux niveaux : très lente. */
const TC_SUB = 2
const STOP_AFTER_MS = FADE_OUT * 1000 + 150
/** Espacement minimal entre deux événements d’un même lieu. */
const MIN_SPACING_MS = 3000

export type EventKind = 'gust' | 'creak' | 'owl' | 'twig' | 'rustle' | 'bell' | 'crow' | 'dog' | 'door' | 'chime' | 'airSwell'
/**
 * Lits continus, très bas (≈ -42 dBFS RMS au niveau 1) : bourdon grave, bourdon électrique, souffle étroit, vent, médium discret.
 * Décision d’Émile (2026-10-26) : le bruit large bande reste banni, mais un bruit est permis s’il est filtré étroit (passe-bande à Q élevé)
 * et bas (< 600 Hz), modulé très lentement (aucune modulation ≥ 3 Hz).
 */
export type BedKind = 'drone' | 'hum' | 'breath' | 'wind' | 'mid'

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
  /** Gain relatif du bourdon (1 par défaut) : le baisser laisse la composante médium porter le lit sur un portable. */
  droneGain?: number
  /** Centre (Hz) du souffle médium discret (lit `mid`). */
  midHz?: number
  events: EventSpec[]
}

/** Peu de son, beaucoup d’atmosphère : événements rares, longs silences entre eux. */
export const RECIPES: Record<PlaceId, Recipe> = {
  perron: {
    beds: ['wind'],
    events: [
      { kind: 'gust', min: 9, max: 22 },
      { kind: 'creak', min: 16, max: 34 },
    ],
  },
  foret: {
    beds: ['breath'],
    events: [
      { kind: 'owl', min: 14, max: 30 },
      { kind: 'twig', min: 10, max: 24 },
      { kind: 'rustle', min: 9, max: 20 },
    ],
  },
  cimetiere: {
    beds: ['drone', 'mid'],
    droneHz: 55,
    midHz: 280,
    droneGain: 0.45,
    events: [
      { kind: 'bell', min: 16, max: 32 },
      { kind: 'crow', min: 14, max: 30 },
    ],
  },
  rue: {
    beds: ['hum'],
    events: [
      { kind: 'dog', min: 15, max: 32 },
      { kind: 'door', min: 12, max: 26 },
    ],
  },
  nuages: {
    beds: ['drone', 'mid'],
    droneHz: 110,
    midHz: 420,
    droneGain: 0.3,
    events: [
      { kind: 'chime', min: 8, max: 20 },
      { kind: 'airSwell', min: 10, max: 24 },
    ],
  },
}

/** Délai aléatoire dans [min, max] (rng ∈ [0,1[). */
export const randomDelay = (min: number, max: number, rng: () => number = Math.random) => min + (max - min) * rng()

/** Mis à `true` par la finale : toutes les ambiances (y compris celles qui démarrent pendant la finale) se taisent. */
export const ambienceDucked = ref(false)

/** Niveau cible du bus : 0 si coupé, onglet caché, arrêté ou étouffé par la finale. */
export const targetLevel = (s: { muted: boolean; hidden: boolean; stopped: boolean; ducked?: boolean }) => (s.muted || s.hidden || s.stopped || s.ducked ? 0 : MASTER_GAIN)

/** Gain du bus des lits : plein au niveau 1, ramené sous la nappe dès le niveau 2 (pas d’empilement qui masque les événements). */
export const bedGain = (level: number) => (level <= 1 ? 0.9 : 0.55)

/**
 * Programme un fondu à puissance constante vers `target` en `dur` s : part de la valeur courante (annule les rampes en cours,
 * donc aucun saut si l’on change d’avis en plein fondu), montée en sinus (quart d’onde), descente en cosinus.
 */
export const fadeParam = (param: AudioParam, now: number, target: number, dur: number) => {
  const v0 = param.value
  param.cancelScheduledValues(now)
  param.setValueAtTime(v0, now)
  if (v0 === target || dur <= 0) {
    param.setValueAtTime(target, now + Math.max(dur, 0))
    return
  }
  const up = target > v0
  for (let i = 1; i <= FADE_STEPS; i++) {
    const x = i / FADE_STEPS
    const shape = up ? Math.sin((Math.PI / 2) * x) : 1 - Math.cos((Math.PI / 2) * x)
    param.linearRampToValueAtTime(i === FADE_STEPS ? target : v0 + (target - v0) * shape, now + dur * x)
  }
}

/** Horodatage du dernier arrêt : un lieu qui démarre juste après un arrêt est un changement de lieu (fondu enchaîné). */
let lastStopAt = -Infinity
const XFADE_WINDOW_MS = 250

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
const drone = (e: Env, hz: number, k = 1) => {
  const lp = filt(e, 'lowpass', 260, 0.5)
  const g = gainNode(e, 0.3 * k)
  lp.connect(g).connect(e.out)
  osc(e, 'sine', hz).connect(lp)
  osc(e, 'sine', hz * 1.5)
    .connect(gainNode(e, 0.5))
    .connect(lp)
  osc(e, 'sine', hz * 2 + 0.05)
    .connect(gainNode(e, 0.25))
    .connect(lp)
  osc(e, 'sine', 0.045)
    .connect(gainNode(e, 0.12 * k))
    .connect(g.gain)
  osc(e, 'sine', 0.03).connect(gainNode(e, 70)).connect(lp.frequency)
}

/** Bourdon électrique de lampadaire : 100 Hz + harmoniques 200 et 300 Hz légères, respiration très lente (0,07 Hz). */
const hum = (e: Env) => {
  const lp = filt(e, 'lowpass', 500, 0.5)
  const g = gainNode(e, BED_HUM_GAIN)
  lp.connect(g).connect(e.out)
  for (const [hz, amp] of [
    [100, 1],
    [200, 0.5],
    [300, 0.35],
  ] as const)
    osc(e, 'sine', hz).connect(gainNode(e, amp)).connect(lp)
  osc(e, 'sine', 0.07)
    .connect(gainNode(e, BED_HUM_GAIN * 0.15))
    .connect(g.gain)
}

/** Souffle de bruit filtré étroit et bas : passe-bande `hz` / `q`, gain qui respire à `breathHz` (≤ 0,1 Hz), centre qui dérive de ± `sweep` Hz à `sweepHz`. */
const noiseBand = (e: Env, o: { hz: number; q: number; gain: number; breathHz: number; depth: number; sweep?: number; sweepHz?: number }) => {
  const s = e.t.add(e.c.createBufferSource())
  s.buffer = sharedNoise(e.c)
  s.loop = true
  const bp = filt(e, 'bandpass', o.hz, o.q)
  const g = gainNode(e, o.gain)
  s.connect(bp).connect(g).connect(e.out)
  s.start(0, Math.random() * NOISE_OFFSET_MAX)
  osc(e, 'sine', o.breathHz)
    .connect(gainNode(e, o.gain * o.depth))
    .connect(g.gain)
  if (o.sweep)
    osc(e, 'sine', o.sweepHz ?? 0.05)
      .connect(gainNode(e, o.sweep))
      .connect(bp.frequency)
}

/** Gains d’étalonnage des lits (le passe-bande étroit laisse passer très peu d’énergie ; réglés sur des rendus hors ligne, cible ≈ -42 dBFS RMS en sortie). */
export const BED_NOISE_GAIN = { breath: 5.3, wind: 3, mid: 4.5 }
export const BED_HUM_GAIN = 0.185

const beds: Record<BedKind, (e: Env, r: Recipe) => void> = {
  drone: (e, r) => drone(e, r.droneHz ?? 55, r.droneGain),
  hum: (e) => hum(e),
  // forêt : souffle étroit (Q élevé), respiration très lente
  breath: (e) => noiseBand(e, { hz: 420, q: 9, gain: BED_NOISE_GAIN.breath, breathHz: 0.07, depth: 0.3, sweep: 40, sweepHz: 0.05 }),
  // perron : vent bas-médium, lente modulation de gain et de centre
  wind: (e) => noiseBand(e, { hz: 320, q: 1.6, gain: BED_NOISE_GAIN.wind, breathHz: 0.09, depth: 0.3, sweep: 70, sweepHz: 0.06 }),
  // cimetière, nuages : composante médium discrète à côté du bourdon
  mid: (e, r) => noiseBand(e, { hz: r.midHz ?? 300, q: 5, gain: BED_NOISE_GAIN.mid, breathHz: 0.05, depth: 0.3, sweep: 20, sweepHz: 0.04 }),
}

/** Enveloppe douce : monte, redescend exponentiellement. */
const env = (g: GainNode, at: number, peak: number, attack: number, dur: number) => {
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
}

/** Houle de bruit (non bouclée, bornée) : filtre `type` à `freq`, montée `attack`, durée `dur`. */
const swell = (e: Env, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, dur: number, sweepTo = freq, delay = 0) => {
  const t0 = e.c.currentTime + 0.05 + delay
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
  twig: (e) => swell(e, 'bandpass', rnd(1100, 1500), 3, 0.6, 0.004, 0.09),
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
    // composante médium discrète (claquement du battant, triangle ~300 Hz) pour les petits haut-parleurs
    const m = e.t.add(e.c.createOscillator())
    m.type = 'triangle'
    m.frequency.setValueAtTime(300, t0)
    m.frequency.exponentialRampToValueAtTime(210, t0 + 0.12)
    const mlp = filt(e, 'lowpass', 600)
    const mg = gainNode(e, 0)
    env(mg, t0, 0.4, 0.006, 0.2)
    m.connect(mlp).connect(mg).connect(e.out)
    m.start(t0)
    m.stop(t0 + 0.25)
    e.t.release(m, [m, mlp, mg])
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

/** Sons « qui ne vont pas » (niveaux 3+) : un coup lointain, un souffle, un craquement. Tous < 4 s, enveloppes lentes ou isolées (aucune modulation périodique). */
const rareSounds: Record<RareKind, (e: Env) => void> = {
  thud: (e) => {
    // coup lointain : corps grave, corps médium (audible sur un portable) et clic d’attaque
    const t0 = e.c.currentTime + 0.05
    const o = e.t.add(e.c.createOscillator())
    o.frequency.setValueAtTime(62, t0)
    o.frequency.exponentialRampToValueAtTime(34, t0 + 0.7)
    const lp = filt(e, 'lowpass', 180, 0.5)
    const g = gainNode(e, 0)
    env(g, t0, 0.55, 0.02, 1.2)
    o.connect(lp).connect(g).connect(e.out)
    o.start(t0)
    o.stop(t0 + 1.3)
    e.t.release(o, [o, lp, g])
    const m = e.t.add(e.c.createOscillator())
    m.type = 'triangle'
    m.frequency.setValueAtTime(150, t0)
    m.frequency.exponentialRampToValueAtTime(70, t0 + 0.45)
    const mlp = filt(e, 'lowpass', 420, 0.5)
    const mg = gainNode(e, 0)
    env(mg, t0, 0.35, 0.012, 0.6)
    m.connect(mlp).connect(mg).connect(e.out)
    m.start(t0)
    m.stop(t0 + 0.7)
    e.t.release(m, [m, mlp, mg])
    // second corps médium (triangle ~320 Hz, très bref) : le coup reste audible sur un portable
    const h = e.t.add(e.c.createOscillator())
    h.type = 'triangle'
    h.frequency.setValueAtTime(320, t0)
    h.frequency.exponentialRampToValueAtTime(220, t0 + 0.2)
    const hlp = filt(e, 'lowpass', 600)
    const hg = gainNode(e, 0)
    env(hg, t0, 0.6, 0.008, 0.5)
    h.connect(hlp).connect(hg).connect(e.out)
    h.start(t0)
    h.stop(t0 + 0.55)
    e.t.release(h, [h, hlp, hg])
    swell(e, 'bandpass', 1400, 1, 0.4, 0.002, 0.05)
  },
  breath: (e) => swell(e, 'bandpass', rnd(1200, 1800), 0.8, 0.35, 1.4, 3.4, rnd(1900, 2600)),
  crackle: (e) => {
    const n = 3 + Math.floor(Math.random() * 3)
    let at = 0
    for (let i = 0; i < n; i++) {
      swell(e, 'bandpass', rnd(1200, 3000), 2.5, 0.3, 0.004, 0.08, undefined, at)
      at += 0.12 + Math.random() * 0.35
    }
  },
}

/**
 * Ambiance sonore d’un lieu, synthétisée (Web Audio) : un lit continu très bas + événements rares (longs silences).
 * Fondu d’entrée 2,5 s (2 s si le lieu en remplace un autre : fondu enchaîné à puissance constante), de sortie 2 s ; suit `muted` et la visibilité de l’onglet ; attend que le
 * contexte soit déverrouillé. Renvoie la fonction d’arrêt (idempotente).
 */
export const startAmbience = (place: PlaceId, getLevel: () => number = () => 1): (() => void) => {
  const c = ac()
  if (!c) return () => undefined

  const t = createTracker()
  const scope = effectScope(true)
  let stopped = false
  let hidden = false
  let lastEventAt = -Infinity
  const crossfade = Date.now() - lastStopAt < XFADE_WINDOW_MS

  const master = c.createGain()
  master.gain.value = 0
  master.connect(ambienceOut(c))

  const level = () => targetLevel({ muted: muted.value, hidden, stopped, ducked: ambienceDucked.value })
  // un fondu n’est relancé que si la cible change : un `statechange` du contexte ne doit pas écraser un fondu en cours (sourdine, départ)
  let lastTarget = Number.NaN
  const ramp = (dur: number) => {
    const target = level()
    if (target === lastTarget) return
    lastTarget = target
    fadeParam(master.gain, c.currentTime, target, dur)
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

  // Basse fantôme (fondamentale + harmoniques) et nappe tonale médium : toujours construites, gains par paliers (changement lent, ≈ 6 s)
  const sub = e.t.add(c.createGain())
  sub.gain.value = 0
  sub.connect(master)
  for (const [hz, amp] of BASS_PARTIALS) osc(e, 'sine', hz).connect(gainNode(e, amp)).connect(sub)
  const pad = e.t.add(c.createGain())
  pad.gain.value = 0
  pad.connect(master)
  for (const v of PAD_VOICES) {
    // enflure lente propre à chaque voix : gain = amp × (1 + PAD_DEPTH × sinus de période ≥ 9 s)
    const vg = gainNode(e, v.amp)
    osc(e, 'sine', v.hz).connect(vg).connect(pad)
    osc(e, 'sine', 1 / v.period)
      .connect(gainNode(e, v.amp * PAD_DEPTH))
      .connect(vg.gain)
  }
  // lits : un bus à part, ramené sous la nappe aux niveaux 2+
  const bedBus = gainNode(e, bedGain(getLevel()))
  bedBus.connect(master)
  const bedEnv: Env = { ...e, out: bedBus }
  // événements de lieu : un bus à part, surélevé pour dépasser le lit
  const eventBus = gainNode(e, EVENT_BOOST)
  eventBus.connect(master)
  const eventEnv: Env = { ...e, out: eventBus }
  const slow = (param: AudioParam, v: number) => {
    param.cancelScheduledValues(c.currentTime)
    param.setTargetAtTime(v, c.currentTime, TC_SUB)
  }
  const rampSub = () => {
    slow(sub.gain, subGain(getLevel()))
    slow(pad.gain, padGain(getLevel()))
    slow(bedBus.gain, bedGain(getLevel()))
  }
  rampSub()

  // Sons rares : un bus à part, plus fort que les événements du lieu
  const rareBus = gainNode(e, RARE_BOOST)
  rareBus.connect(master)
  const rareEnv: Env = { ...e, out: rareBus }
  // une seule minuterie, ré-armée à chaque tour, un son à la fois
  let lastRare: RareKind | null = null
  const rareInterval = ref(0)
  const { start: startRare, stop: stopRare } = useTimeoutFn(
    () => {
      if (stopped) return
      if (running()) {
        const now = Date.now()
        if (now - lastEventAt < MIN_SPACING_MS) return armRare(MIN_SPACING_MS / 1000 + Math.random() * 2)
        lastEventAt = now
        lastRare = pickRareKind(lastRare)
        rareSounds[lastRare](rareEnv)
      }
      armRare()
    },
    rareInterval,
    { immediate: false },
  )
  const armRare = (override?: number) => {
    stopRare()
    const d = override ?? nextRareDelay(getLevel())
    if (d === null) return
    rareInterval.value = d * 1000
    startRare()
  }
  armRare()

  scope.run(() => {
    for (const b of RECIPES[place].beds) beds[b](bedEnv, RECIPES[place])
    for (const ev of RECIPES[place].events) e.every(ev.min, ev.max, () => events[ev.kind](eventEnv))
  })

  const onState = () => ramp(FADE_IN)
  c.addEventListener('statechange', onState)
  ramp(crossfade ? FADE_XFADE : FADE_IN)

  scope.run(() => {
    const visibility = useDocumentVisibility()
    watch(
      visibility,
      (v, old) => {
        hidden = v === 'hidden'
        // premier appel : l’entrée (ou le fondu enchaîné) déjà programmée prime, sauf si l’onglet est caché d’emblée
        if (old !== undefined || hidden) ramp(FADE_HIDDEN)
      },
      { immediate: true },
    )
    watch(getLevel, () => {
      rampSub()
      armRare()
    })
    watch(muted, () => ramp(FADE_MUTE))
    watch(ambienceDucked, (d) => ramp(d ? FADE_OUT : FADE_IN))
  })

  return () => {
    if (stopped) return
    stopped = true
    stopRare()
    scope.stop()
    c.removeEventListener('statechange', onState)
    lastStopAt = Date.now()
    ramp(FADE_OUT)
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
