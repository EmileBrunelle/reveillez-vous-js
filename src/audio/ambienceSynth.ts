import type { PlaceId } from '../effects/places/types'
import { noiseBuffer } from './noise'
import type { RareKind } from './paranoiaAudio'

// Synthèse des ambiances : recettes par lieu, lits continus, événements ponctuels, sons rares, suivi des nœuds créés.
// Le cycle de vie (fondus, minuteries, sourdine, visibilité) est dans `ambience.ts`.

/** Gain du bus des événements de lieu (+≈ 11 dB) : ils étaient ≈ -45 dBFS crête, inaudibles sous la voix d’un portable. */
export const EVENT_BOOST = 3.6

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

const rnd = (a: number, b: number) => randomDelay(a, b)

/** Gain du bus des lits : plein au niveau 1, ramené sous la nappe dès le niveau 2 (pas d’empilement qui masque les événements). */
export const bedGain = (level: number) => (level <= 1 ? 0.9 : 0.55)

/** Durée du tampon de bruit : couvre la plus longue houle (6 s) avec un décalage de départ ≤ NOISE_OFFSET_MAX. */
export const NOISE_SECONDS = 9
export const NOISE_OFFSET_MAX = 1.5

/** Garde la trace de tout ce qui est créé pour pouvoir tout arrêter et déconnecter. */
export const createTracker = () => {
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

export interface Env {
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
export const gainNode = (e: Env, v: number) => {
  const g = e.t.add(e.c.createGain())
  g.gain.value = v
  return g
}
export const osc = (e: Env, type: OscillatorType, freq: number) => {
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
  s.buffer = noiseBuffer(e.c, NOISE_SECONDS)
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

export const beds: Record<BedKind, (e: Env, r: Recipe) => void> = {
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
  s.buffer = noiseBuffer(e.c, NOISE_SECONDS)
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

export const events: Record<EventKind, (e: Env) => void> = {
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
export const rareSounds: Record<RareKind, (e: Env) => void> = {
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
