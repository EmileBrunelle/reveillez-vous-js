import type { NoteEvent } from './musicPlan'

// Piano de feutre synthétisé, proche du micro et un peu usé (esprit C418) : partiels étirés par inharmonicité, décroissance à deux étages
// par partiel (coup puis résonance), deux cordes légèrement désaccordées pour les trois premiers partiels (battement lent), marteau de
// feutre (attaque douce, bref bruit sourd), passe-bas selon la vélocité, salle discrète (convolution), chaleur de bande (saturation douce
// et très lent flottement de ±2 cents). Fonctionne sur tout BaseAudioContext (donc aussi OfflineAudioContext pour les rendus d’essai).
const PARTIAL_COUNT = 9
/** Partiels au-delà desquels l’écho (déjà voilé) n’en garde plus. */
const ECHO_PARTIALS = 5
/** Inharmonicité B : f_n = n·f0·√(1 + B·n²). Plus grande dans le grave (cordes épaisses). */
const inharmonicity = (hz: number) => 0.0002 + 0.0003 * Math.max(0, Math.min(1, (330 - hz) / 250))
/** Partiels à deux cordes (les autres n’en ont qu’une : budget de nœuds). */
const DOUBLE_STRING_UNTIL = 3
const ATTACK = 0.008
/** Gain par note : vise ≈ -25 dBFS crête à l’entrée du bus (mesuré hors ligne). */
export const NOTE_TRIM = 0.009
/** Flottement lent de bande (cents) et salle. */
const WOW_CENTS = 2
const ROOM_SECONDS = 2
const ROOM_WET = 0.16

export interface PhraseHandle {
  /** Fondu (s) puis arrêt de tous les oscillateurs. */
  stop: (fade?: number) => void
  /** Instant (horloge du contexte) de la fin naturelle. */
  end: number
}

/** Amplitude du partiel n (1-based) : décroît avec n, et les aigus s’effacent à faible vélocité. */
export const partialAmp = (n: number, velocity: number): number => n ** -1.15 * velocity ** ((n - 1) * 0.35)
/** Fréquence du partiel n d’une corde de fondamentale `hz`. */
export const partialHz = (hz: number, n: number): number => n * hz * Math.sqrt(1 + inharmonicity(hz) * n * n)

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
const roomCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** Bruit blanc de 120 ms, partagé (un seul tableau par contexte) : sert au marteau. */
const noise = (c: BaseAudioContext): AudioBuffer => {
  let b = noiseCache.get(c)
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * 0.12), c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(c, b)
  }
  return b
}

/** Réponse impulsionnelle d’une petite salle : bruit à décroissance exponentielle, assombri (filtre à un pôle) au fil du temps. */
const room = (c: BaseAudioContext): AudioBuffer => {
  let b = roomCache.get(c)
  if (!b) {
    const len = Math.floor(c.sampleRate * ROOM_SECONDS)
    b = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const t = i / len
        const k = 0.55 - 0.45 * t // coefficient du filtre : plus sombre vers la fin
        lp += (Math.random() * 2 - 1 - lp) * k
        d[i] = lp * Math.exp(-5.5 * t) * Math.min(1, i / (0.004 * c.sampleRate))
      }
    }
    roomCache.set(c, b)
  }
  return b
}

/** Courbe de saturation douce (tanh), presque linéaire aux faibles niveaux. */
const saturation = (): Float32Array<ArrayBuffer> => {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6)
  }
  return curve
}

/**
 * Planifie la phrase à `t0` vers `out` ; `wobble` (cents) renforce le flottement de hauteur (niveaux 3–4).
 * Nœuds par note : 12 oscillateurs (3 partiels à 2 cordes + 6 à 1 corde), 9 gains d’enveloppe, 1 gain de note, 1 passe-bas,
 * et pour le marteau 1 source, 1 passe-bas, 1 gain, soit ≈ 28 (≈ 16 pour un écho : 5 partiels, sans marteau).
 */
export const playPhrase = (c: BaseAudioContext, out: AudioNode, t0: number, notes: readonly NoteEvent[], wobble = 0): PhraseHandle => {
  const bus = c.createGain()
  bus.gain.value = 1
  bus.connect(out)
  const sum = c.createGain()
  const shaper = c.createWaveShaper()
  shaper.curve = saturation()
  const conv = c.createConvolver()
  conv.buffer = room(c)
  const wet = c.createGain()
  wet.gain.value = ROOM_WET
  sum.connect(shaper)
  shaper.connect(bus)
  shaper.connect(conv)
  conv.connect(wet).connect(bus)

  const sources: (OscillatorNode | AudioBufferSourceNode)[] = []
  // flottement lent commun à toutes les cordes de la phrase
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.3 + Math.random() * 0.2
  const lfoGain = c.createGain()
  lfoGain.gain.value = Math.max(WOW_CENTS, wobble)
  lfo.connect(lfoGain)
  sources.push(lfo)

  let end = t0
  for (const n of notes) {
    const t = t0 + n.at
    const count = n.echo ? ECHO_PARTIALS : PARTIAL_COUNT
    const g = c.createGain()
    g.gain.value = n.velocity * NOTE_TRIM
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    // vélocité faible : timbre plus sombre ; l’écho est voilé
    lp.frequency.value = n.echo ? 1500 : 900 + n.velocity * 2300
    lp.Q.value = 0.4
    g.connect(lp).connect(sum)
    const v = Math.min(1, n.velocity / 0.9)
    for (let k = 1; k <= count; k++) {
      const hz = partialHz(n.hz, k)
      if (hz > 9000) break
      // deux étages : le coup (court, plus court encore dans l’aigu) puis la résonance (le fondamental sonne longtemps)
      const total = n.decay / k ** 0.65
      const prompt = Math.min(total * 0.6, 0.3 + 1.1 / k ** 0.8)
      const aftersound = 0.32 / Math.sqrt(k)
      const a = partialAmp(k, v)
      const e = c.createGain()
      e.gain.setValueAtTime(0.0001, t)
      e.gain.linearRampToValueAtTime(a, t + ATTACK)
      e.gain.exponentialRampToValueAtTime(a * aftersound, t + prompt)
      e.gain.exponentialRampToValueAtTime(0.0001, t + total)
      e.connect(g)
      const strings = k <= DOUBLE_STRING_UNTIL ? 2 : 1
      for (let s = 0; s < strings; s++) {
        const o = c.createOscillator()
        o.frequency.value = hz
        // cordes de ±1–3 cents autour de l’accord de la note (battement lent) ; chute de hauteur éventuelle
        const spread = strings === 2 ? (s === 0 ? -1 : 1) * (1 + Math.random() * 2) : 0
        o.detune.setValueAtTime(n.cents + spread, t)
        if (n.sag) o.detune.linearRampToValueAtTime(n.cents + spread + n.sag, t + total)
        lfoGain.connect(o.detune)
        o.connect(e)
        o.start(t)
        o.stop(t + total + 0.05)
        sources.push(o)
      }
      end = Math.max(end, t + total + 0.05)
    }
    // marteau de feutre : bref bruit sourd, passe-bas bas (pas pour l’écho)
    if (!n.echo) {
      const s = c.createBufferSource()
      s.buffer = noise(c)
      const hl = c.createBiquadFilter()
      hl.type = 'lowpass'
      hl.frequency.value = Math.min(n.hz * 2, 700)
      hl.Q.value = 0.7
      const hg = c.createGain()
      hg.gain.setValueAtTime(0.0001, t)
      hg.gain.linearRampToValueAtTime(0.5 * n.velocity, t + 0.004)
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
      s.connect(hl).connect(hg).connect(g)
      s.start(t)
      s.stop(t + 0.06)
      sources.push(s)
    }
  }
  lfo.start(t0)
  lfo.stop(end)

  // nettoyage : quand tout s’est tu, on débranche (après la queue de salle)
  let remaining = sources.length
  const cleanup = () => {
    for (const nd of [bus, sum, shaper, conv, wet, lfoGain]) nd.disconnect()
  }
  for (const s of sources) {
    s.onended = () => {
      if (--remaining === 0) setTimeout(cleanup, (ROOM_SECONDS + 0.5) * 1000)
    }
  }
  let stopped = false
  return {
    end: end + ROOM_SECONDS * 0.5,
    stop: (fade = 0.4) => {
      if (stopped) return
      stopped = true
      const now = c.currentTime
      bus.gain.cancelScheduledValues(now)
      bus.gain.setTargetAtTime(0, now, fade / 4)
      for (const s of sources) {
        try {
          s.stop(now + fade + 0.05)
        } catch {
          /* déjà arrêté */
        }
      }
    },
  }
}
