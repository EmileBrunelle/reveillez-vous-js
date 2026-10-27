import { customRef, watch } from 'vue'
import { useAudioStore, VOLUME_KEYS, type VolumeKey } from '../stores/audio'
import { playMotif } from './motif'

/** Sourdine : miroir du store, sans cache (résolu à chaque lecture, jamais à l’import : pinia doit être actif). */
export const muted = customRef<boolean>(() => ({
  get: () => useAudioStore().muted,
  set: (v) => {
    useAudioStore().muted = v
  },
}))

const volumeOf = (k: VolumeKey) => useAudioStore().volumes[k]

type Buses = Record<VolumeKey, GainNode>
const buses = new WeakMap<AudioContext, Buses>()

const rampTo = (c: AudioContext, node: GainNode, v: number) => {
  node.gain.cancelScheduledValues(c.currentTime)
  node.gain.setTargetAtTime(v, c.currentTime, 0.03)
}

/** Bus d’une catégorie pour ce contexte (créé à la demande, au volume courant). `general` mène à la destination. */
const bus = (c: AudioContext, key: VolumeKey): GainNode => {
  let b = buses.get(c)
  if (!b) {
    const general = c.createGain()
    general.gain.value = volumeOf('general')
    // limiteur doux en sortie : seuil -6 dB, ratio élevé, attaque courte, relâche ~150 ms (aucun écrêtage à la somme des bus)
    const limiter = c.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.15
    // le compresseur de Chrome ajoute ~2,3 dB de gain de compensation (non réglable) : on le retire pour ne pas changer le niveau général
    const trim = c.createGain()
    trim.gain.value = 0.77
    general.connect(limiter).connect(trim).connect(c.destination)
    b = { general } as Buses
    for (const k of VOLUME_KEYS) {
      if (k === 'general') continue
      const g = c.createGain()
      g.gain.value = volumeOf(k)
      g.connect(general)
      b[k] = g
    }
    buses.set(c, b)
  }
  return b[key]
}
/** Sortie des sons d’ambiance (lieux, couche de paranoïa). */
export const ambienceOut = (c: AudioContext) => bus(c, 'ambiance')
/** Sortie des effets : à utiliser pour tout nouvel effet (`node.connect(effetsOut(c))`, jamais `c.destination`). */
export const effetsOut = (c: AudioContext) => bus(c, 'effets')
/** Sortie des sons de la finale. */
export const finaleOut = (c: AudioContext) => bus(c, 'finale')

// Les changements de volume du store (curseurs, remise à zéro) se répercutent sur les bus du contexte courant.
let stopVolumeWatch: (() => void) | null = null
const watchVolumes = () => {
  if (stopVolumeWatch) return
  const store = useAudioStore()
  const stops = VOLUME_KEYS.map((k) =>
    watch(
      () => store.volumes[k],
      (v) => {
        if (ctx && ctx.state !== 'closed') rampTo(ctx, bus(ctx, k), v)
      },
      { flush: 'sync' },
    ),
  )
  stopVolumeWatch = () => stops.forEach((stop) => stop())
}

let ctx: AudioContext | null = null
export const ac = (): AudioContext | null => {
  if (ctx?.state === 'closed') ctx = null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
    watchVolumes()
    // bus (et limiteur) créés d’emblée : le DynamicsCompressor de Chrome atténue ses premières ms à froid, autant qu’il chauffe à vide
    bus(ctx, 'general')
  }
  return ctx
}

export const unlock = () => {
  const c = ac()
  if (c && c.state !== 'running') void c.resume()
}

export const noiseBuffer = (c: AudioContext, seconds: number) => {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

const burst = (c: AudioContext, at: number, dur: number, freq: number, gain: number) => {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, dur)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + dur)
  src.connect(f).connect(g).connect(effetsOut(c))
  src.start(at)
  return [src]
}

export interface KnockHandle {
  /** Hit times on the clock `now()` reads (the AudioContext clock when it is running). */
  times: number[]
  now: () => number
  cancel: () => void
}

const thump = (c: AudioContext, at: number, gain: number, mid: number) => {
  // composante médium discrète (triangle ~300 Hz qui chute, très courte) : rend le coup audible sur un petit haut-parleur
  const m = c.createOscillator()
  m.type = 'triangle'
  m.frequency.setValueAtTime(320, at)
  m.frequency.exponentialRampToValueAtTime(220, at + 0.07)
  const mg = c.createGain()
  mg.gain.setValueAtTime(0.0001, at)
  mg.gain.linearRampToValueAtTime(mid, at + 0.004)
  mg.gain.exponentialRampToValueAtTime(0.001, at + 0.09)
  m.connect(mg).connect(effetsOut(c))
  m.start(at)
  m.stop(at + 0.1)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, at)
  o.frequency.exponentialRampToValueAtTime(50, at + 0.1)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.12)
  o.connect(g).connect(effetsOut(c))
  o.start(at)
  o.stop(at + 0.13)
  return [m, o]
}

/** One knock (noise burst + thump) scheduled at audio time `at`; returns the sources so they can be stopped. */
// Intensité 0 (niv. 1) à 1 (niv. 5). Le plafond du limiteur (≈ -3,6 dBFS crête) fixe le niv. 5 ; pour garder ≥ 10 dB d’écart sans
// rendre le niv. 1 inaudible, c’est la composante médium (triangle ~300 Hz, seule audible sur un portable) qui porte le bas de l’échelle :
// elle part haut (0,13) et monte peu, alors que le clac et le corps grave (sous 150 Hz) grimpent de 0,14/0,12 à 0,9/0,7.
const KNOCK = { burst: [0.13, 0.77], thump: [0.12, 0.58], mid: [0.13, 0.1] } as const
const lerp = ([a, b]: readonly [number, number], i: number) => a + b * i
const knockAt = (c: AudioContext, at: number, intensity: number): AudioScheduledSourceNode[] => [
  ...burst(c, at, 0.12, 400, lerp(KNOCK.burst, intensity)),
  ...thump(c, at, lerp(KNOCK.thump, intensity), lerp(KNOCK.mid, intensity)),
]

/** Plays one knock now. Silent when muted or when the audio context is not running (not unlocked yet). */
export const knock = (intensity: number) => {
  if (muted.value || !ctx || ctx.state !== 'running') return
  knockAt(ctx, ctx.currentTime, intensity)
}

/**
 * Schedules knocks at `offsets` (seconds from the first, which plays ~50 ms from now) on the Web Audio clock
 * and calls `onHit` from a rAF loop when the clock reaches each hit (shifted by the output latency), so
 * visuals and sound share one time base. Before audio is unlocked (no running context) the same schedule
 * runs silently on performance.now().
 */
export const scheduleKnocks = (offsets: number[], intensity: number, onHit: (i: number, intensity: number) => void): KnockHandle => {
  const live = ctx !== null && ctx.state === 'running'
  const now = live ? () => ctx!.currentTime : () => performance.now() / 1000
  const t0 = now() + 0.05
  const times = offsets.map((o) => t0 + o)
  const sources: AudioScheduledSourceNode[] = []
  if (live && !muted.value) times.forEach((t) => sources.push(...knockAt(ctx!, t, intensity)))
  const latency = live ? (ctx!.outputLatency || 0) + ctx!.baseLatency : 0
  let i = 0
  let raf = 0
  const tick = () => {
    const n = now()
    while (i < times.length && n >= times[i] + latency) onHit(i++, intensity)
    if (i < times.length) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return {
    times,
    now,
    cancel() {
      cancelAnimationFrame(raf)
      i = times.length
      sources.forEach((s) => {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      })
    },
  }
}

export const creak = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t)
  o.frequency.linearRampToValueAtTime(150, t + 0.25)
  o.frequency.linearRampToValueAtTime(75, t + 0.5)
  o.frequency.linearRampToValueAtTime(190, t + 0.8)
  const lfo = c.createOscillator()
  lfo.frequency.value = 19
  const lg = c.createGain()
  lg.gain.value = 12
  lfo.connect(lg).connect(o.frequency)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 6
  f.frequency.setValueAtTime(600, t)
  f.frequency.linearRampToValueAtTime(1400, t + 0.8)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.48, t + 0.1)
  g.gain.linearRampToValueAtTime(0.0001, t + 0.85)
  o.connect(f).connect(g).connect(effetsOut(c))
  o.start(t)
  lfo.start(t)
  o.stop(t + 0.9)
  lfo.stop(t + 0.9)
}

export const slam = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  burst(c, t, 0.25, 700, 0.7)
  thump(c, t, 0.7, 0.21)
}

/** Hymne de la révélation, en la (tonalité commune). */
export const HYMN_HZ = [220, 277.18, 329.63, 440, 329.63]
/** Le motif ouvre la révélation, l’hymne le suit ~0,9 s plus tard ; chacun baissé pour que la somme reste ≈ -18 dBFS crête. */
export const HYMN_DELAY = 0.9
export const HYMN_GAIN = 0.088
export const REVEAL_MOTIF_DB = -25
export const hymn = () => {
  const c = ac()
  if (!c || muted.value) return
  const notes = HYMN_HZ
  const t = c.currentTime + HYMN_DELAY
  playMotif(c, effetsOut(c), { variant: 'mystere', peakDb: REVEAL_MOTIF_DB })
  notes.forEach((hz, i) => {
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.value = hz
    const g = c.createGain()
    const s = t + i * 0.2
    g.gain.setValueAtTime(0.0001, s)
    g.gain.linearRampToValueAtTime(HYMN_GAIN, s + 0.008)
    g.gain.setValueAtTime(HYMN_GAIN, s + 0.17)
    g.gain.linearRampToValueAtTime(0.0001, s + 0.18)
    o.connect(g).connect(effetsOut(c))
    o.start(s)
    o.stop(s + 0.2)
  })
}

/** Card slides in: a short filtered-noise swish rising in pitch. */
export const cardDeal = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.25)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(3800, t + 0.2)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.22, t + 0.06)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
  src.connect(f).connect(g).connect(effetsOut(c))
  src.start(t)
}

/** Card flips: a papery snap and a small bright blip on the landing. */
export const FLIP_BLIP_HZ = 554.37
export const cardFlip = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  burst(c, t, 0.08, 6000, 0.14)
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(FLIP_BLIP_HZ, t + 0.16)
  o.frequency.exponentialRampToValueAtTime(880, t + 0.26)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.setValueAtTime(0.036, t + 0.16)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  o.connect(g).connect(effetsOut(c))
  o.start(t)
  o.stop(t + 0.32)
}

/** Card lands after the flip: a short, dull paper thud (low-passed noise, no tone). */
export const cardThud = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.14)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 0.8
  f.frequency.setValueAtTime(700, t)
  f.frequency.exponentialRampToValueAtTime(180, t + 0.12)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.4, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
  src.connect(f).connect(g).connect(effetsOut(c))
  src.start(t)
}

const beep = (c: AudioContext, at: number, from: number, to: number, dur: number, gain: number) => {
  const o = c.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(from, at)
  o.frequency.linearRampToValueAtTime(to, at + dur)
  const g = c.createGain()
  // attaque et relâche de 6 ms : pas de saut de gain (clic) aux bords de l’onde carrée
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(gain, at + 0.006)
  g.gain.setValueAtTime(gain, at + dur - 0.006)
  g.gain.linearRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(effetsOut(c))
  o.start(at)
  o.stop(at + dur + 0.01)
}

/** About opens: the leitmotif, short and high, no echo (replaces the old two beeps). */
export const aboutOpen = () => {
  const c = ac()
  if (!c || muted.value) return
  playMotif(c, effetsOut(c), { variant: 'mystere', slow: 0.6, octave: 1, echo: false, peakDb: -24 })
}

/** Aperçu à la sortie du curseur « Effets » : le bip d’ouverture (court, discret). */
export const previewEffects = () => {
  unlock()
  aboutOpen()
}

/** About closes: one short falling blip. */
export const aboutClose = () => {
  const c = ac()
  if (!c || muted.value) return
  beep(c, c.currentTime, 660, 330, 0.1, 0.045)
}
