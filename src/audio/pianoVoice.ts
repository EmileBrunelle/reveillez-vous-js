import { phraseGain, type NoteEvent } from './musicPlan'

// Piano de feutre synthétisé, proche du micro et un peu usé (esprit C418) : partiels étirés par inharmonicité, décroissance à deux étages
// par partiel (coup puis résonance), deux cordes légèrement désaccordées pour les trois premiers partiels (battement lent), marteau de
// feutre (attaque douce, bref bruit sourd), passe-bas selon la vélocité, étouffoirs (la note s’éteint au changement de pédale), salle
// discrète (convolution), très lent flottement de ±2 cents, et limiteur doux (tanh) en sortie. Fonctionne sur tout BaseAudioContext (donc
// aussi OfflineAudioContext pour les rendus d’essai).
const PARTIAL_COUNT = 8
/** L’accompagnement garde moins de partiels (plus sombre, moins de nœuds sous la pédale). */
const ACCOMP_PARTIALS = 5
/** Un partiel s’arrête quand son enveloppe passe sous ce seuil (≈ -60 dB), au lieu de courir toute la décroissance. */
const SILENT = 0.01
const PARTIAL_MAX_HZ = 6000
/** Étouffoir : constante de temps (s), plus lente dans le grave (cordes lourdes). */
const damperTau = (midi: number) => (midi < 48 ? 0.08 : 0.05)
/** Inharmonicité B : f_n = n·f0·√(1 + B·n²). Plus grande dans le grave (cordes épaisses). */
const inharmonicity = (hz: number) => 0.0002 + 0.0003 * Math.max(0, Math.min(1, (330 - hz) / 250))
/** Partiels à deux cordes (les autres n’en ont qu’une : budget de nœuds). */
const DOUBLE_STRING_UNTIL = 2
const ATTACK = 0.008
/** Notes qui sonnent en même temps au plus : au-delà, la plus ancienne est étouffée (fondu de l’étouffoir). */
export const MAX_RINGING = 7
/** Gain par note : avec la réserve de `phraseGain`, vise ≈ -25 dBFS crête à l’entrée du bus (mesuré hors ligne). */
export const NOTE_TRIM = 0.03
/** Plafond du limiteur doux (≈ -17 dBFS) : transparent à -25 dBFS, arrondit un éventuel excès. */
const LIMIT_CEIL = 0.14
const LIMIT_SPAN = 4
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

/** Amplitude du partiel n (1-based) : décroît vite avec n (fondamental dominant, timbre sombre), les aigus s’effacent à faible vélocité. */
export const partialAmp = (n: number, velocity: number): number => n ** -1.4 * velocity ** ((n - 1) * 0.4)
/** Fréquence du partiel n d’une corde de fondamentale `hz`. */
export const partialHz = (hz: number, n: number): number => n * hz * Math.sqrt(1 + inharmonicity(hz) * n * n)

/** Un partiel planifié : rang, nombre de cordes, enveloppe (coup puis résonance) et instant d’arrêt (s, relatifs au début de la note). */
export interface PartialPlan {
  k: number
  hz: number
  strings: number
  amp: number
  prompt: number
  aftersound: number
  natural: number
  stop: number
}

/** Partiels d’une note (pur, partagé avec les tests de coût) : `damped` = instant d’extinction par l’étouffoir, relatif au début de la note. */
export const notePartials = (n: Pick<NoteEvent, 'hz' | 'velocity' | 'decay' | 'voice'>, damped: number): PartialPlan[] => {
  const count = n.voice === 'melody' ? PARTIAL_COUNT : ACCOMP_PARTIALS
  const v = Math.min(1, n.velocity / 0.9)
  const out: PartialPlan[] = []
  for (let k = 1; k <= count; k++) {
    const hz = partialHz(n.hz, k)
    if (hz > PARTIAL_MAX_HZ) break
    const natural = n.decay / k ** 0.65
    const prompt = Math.min(natural * 0.6, 0.3 + 1.1 / k ** 0.8)
    const aftersound = 0.32 / Math.sqrt(k)
    const amp = partialAmp(k, v)
    // fin audible : l’enveloppe exponentielle (amp·aftersound -> 0.0001 sur [prompt, natural]) franchit SILENT
    const start = amp * aftersound
    let audible = natural
    if (start <= SILENT) audible = Math.min(natural, prompt)
    else if (start > 0.0001 && SILENT > 0.0001) audible = prompt + ((natural - prompt) * Math.log(SILENT / start)) / Math.log(0.0001 / start)
    out.push({ k, hz, strings: k <= DOUBLE_STRING_UNTIL ? 2 : 1, amp, prompt, aftersound, natural, stop: Math.min(natural, audible, damped) })
  }
  return out
}

/** Instants (s, relatifs à la phrase) où chaque note est étouffée de force : la plus ancienne quand plus de `max` notes sonnent à l’attaque d’une autre. */
export const stealCuts = (notes: readonly NoteEvent[], max = MAX_RINGING): number[] => {
  const cuts = notes.map(() => Infinity)
  const order = notes.map((_, i) => i).sort((a, b) => notes[a].at - notes[b].at)
  const ends = (i: number) => Math.min(notes[i].at + notes[i].decay, cuts[i], Math.max(notes[i].at + ATTACK, notes[i].release) + 6 * damperTau(notes[i].midi))
  for (const i of order) {
    const t = notes[i].at
    const ringing = order.filter((j) => notes[j].at < t && ends(j) > t)
    ringing.sort((a, b) => notes[a].at - notes[b].at)
    // la place de la nouvelle note : on étouffe les plus anciennes jusqu’à revenir sous le plafond
    for (let r = 0; ringing.length - r >= max; r++) cuts[ringing[r]] = Math.min(cuts[ringing[r]], t)
  }
  return cuts
}

/** Intervalles [début, fin] (s) de toutes les sources d’une phrase (oscillateurs de cordes, marteaux, flottement) : sert à compter le pic simultané. */
export const sourceSpans = (notes: readonly NoteEvent[]): [number, number][] => {
  const spans: [number, number][] = []
  let end = 0
  const cuts = stealCuts(notes)
  notes.forEach((n, i) => {
    const rel = Math.min(cuts[i], Math.max(n.at + ATTACK, n.release))
    const damped = rel + 6 * damperTau(n.midi)
    for (const p of notePartials(n, damped - n.at)) {
      for (let s = 0; s < p.strings; s++) spans.push([n.at, n.at + p.stop + 0.05])
      end = Math.max(end, n.at + p.stop + 0.05)
    }
    spans.push([n.at, n.at + 0.06])
  })
  spans.push([0, end])
  return spans
}

/** Pic de sources simultanées d’une phrase (le flottement compte pour une). */
export const peakSources = (notes: readonly NoteEvent[]): number => {
  const ev: [number, number][] = []
  for (const [a, b] of sourceSpans(notes)) ev.push([a, 1], [b, -1])
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1])
  let cur = 0
  let peak = 0
  for (const [, d] of ev) peak = Math.max(peak, (cur += d))
  return peak
}

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

/** Limiteur doux : y = tanh(LIMIT_SPAN·x) sur [-1, 1] ; entouré de gains 1/(plafond·span) et plafond, il donne plafond·tanh(s/plafond). */
const limiterCurve = (): Float32Array<ArrayBuffer> => {
  const n = 2048
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(LIMIT_SPAN * ((i / (n - 1)) * 2 - 1))
  return curve
}

/**
 * Planifie la phrase à `t0` vers `out` ; `wobble` (cents) renforce le flottement de hauteur (niveaux 3–4).
 * Nœuds par note de mélodie : 12 oscillateurs (3 partiels à 2 cordes + 6 à 1 corde), 9 gains d’enveloppe, 1 gain de note, 1 passe-bas,
 * et pour le marteau 1 source, 1 passe-bas, 1 gain, soit ≈ 28 (≈ 23 pour l’accompagnement : 7 partiels). Les oscillateurs s’arrêtent à
 * l’étouffoir, donc seules les notes sous la pédale en cours coûtent.
 */
export const playPhrase = (c: BaseAudioContext, out: AudioNode, t0: number, notes: readonly NoteEvent[], wobble = 0): PhraseHandle => {
  const bus = c.createGain()
  bus.gain.value = 1
  bus.connect(out)
  // réserve de dynamique : sous la pédale les notes s’additionnent, la phrase entière est abaissée d’autant
  const sum = c.createGain()
  sum.gain.value = phraseGain(notes) / (LIMIT_CEIL * LIMIT_SPAN)
  const shaper = c.createWaveShaper()
  shaper.curve = limiterCurve()
  const ceil = c.createGain()
  ceil.gain.value = LIMIT_CEIL
  const conv = c.createConvolver()
  conv.buffer = room(c)
  const wet = c.createGain()
  wet.gain.value = ROOM_WET
  sum.connect(shaper).connect(ceil)
  ceil.connect(bus)
  ceil.connect(conv)
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
  const cuts = stealCuts(notes)
  for (const [i, n] of notes.entries()) {
    const t = t0 + n.at
    // étouffoir : au changement de pédale, la note entière s’éteint (constante damperTau) ; sinon elle sonne jusqu’à sa résonance naturelle
    const rel = t0 + Math.min(cuts[i], Math.max(n.at + ATTACK, n.release))
    const tau = damperTau(n.midi)
    const damped = rel + 6 * tau
    const g = c.createGain()
    g.gain.setValueAtTime(n.velocity * NOTE_TRIM, t)
    if (rel < t + n.decay) {
      g.gain.setValueAtTime(n.velocity * NOTE_TRIM, rel)
      g.gain.exponentialRampToValueAtTime(n.velocity * NOTE_TRIM * 0.002, damped)
    }
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    // vélocité faible : timbre plus sombre
    lp.frequency.value = 650 + n.velocity * 1700
    lp.Q.value = 0.4
    g.connect(lp).connect(sum)
    for (const p of notePartials(n, damped - t)) {
      const { hz, natural, prompt, aftersound, amp: a } = p
      const e = c.createGain()
      e.gain.setValueAtTime(0.0001, t)
      e.gain.linearRampToValueAtTime(a, t + ATTACK)
      e.gain.exponentialRampToValueAtTime(a * aftersound, t + prompt)
      e.gain.exponentialRampToValueAtTime(0.0001, t + natural)
      e.connect(g)
      for (let s = 0; s < p.strings; s++) {
        const o = c.createOscillator()
        o.frequency.value = hz
        // cordes de ±1–3 cents autour de l’accord de la note (battement lent) ; chute de hauteur éventuelle
        const spread = p.strings === 2 ? (s === 0 ? -1 : 1) * (1 + Math.random() * 2) : 0
        o.detune.setValueAtTime(n.cents + spread, t)
        if (n.sag) o.detune.linearRampToValueAtTime(n.cents + spread + n.sag, t + natural)
        lfoGain.connect(o.detune)
        o.connect(e)
        o.start(t)
        o.stop(t + p.stop + 0.05)
        sources.push(o)
      }
      end = Math.max(end, t + p.stop + 0.05)
    }
    // marteau de feutre : bref bruit sourd, passe-bas bas
    {
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
    for (const nd of [bus, sum, shaper, ceil, conv, wet, lfoGain]) nd.disconnect()
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
