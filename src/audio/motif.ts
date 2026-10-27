import { ref } from 'vue'
import { muted } from './sfx'

// Leitmotif de la voyance, synthétisé (Web Audio) : trois notes legato, timbre d’ocarina lointaine (sinus + triangle à 2f,
// vibrato tardif, passe-bas) et un écho de deux répétitions. Uniquement oscillateurs, gains et filtres biquad.
export type MotifVariant = 'mystere' | 'aube'

/** « mystère » : mi – la – si♭ (quarte juste puis demi-ton : 4/3 puis 16/15). « aube » : mi – la – do♯ (« Bonjour » seulement). */
export const MOTIF: Record<MotifVariant, { hz: readonly number[]; ms: readonly number[] }> = {
  mystere: { hz: [329.63, 440, 466.16], ms: [170, 170, 600] },
  aube: { hz: [329.63, 440, 554.37], ms: [170, 170, 900] },
}

export interface MotifOpts {
  variant?: MotifVariant
  /** Instant de départ (horloge du contexte) ; par défaut maintenant. */
  at?: number
  /** Décalage en octaves (+1 : une octave plus haut, -1 : plus bas). */
  octave?: number
  /** Facteur de durée (2,4 : 2,4 fois plus lent ; l’écho suit). */
  slow?: number
  /** Gain crête visé (dBFS) à la sortie fournie. */
  peakDb?: number
  /** Écho (deux répétitions) ; par défaut oui. */
  echo?: boolean
  /** Fréquence de coupure du passe-bas principal (Hz) ; l’écho est plafonné à 1,5 kHz. */
  lowpass?: number
  /** Sinus pur, sans le triangle à 2f. */
  pure?: boolean
}

export const ATTACK = 0.03
export const RELEASE = 0.35
export const VIBRATO_HZ = 5.2
export const VIBRATO_CENTS = 5
export const HARMONIC_GAIN = 0.15
export const ECHOES: readonly (readonly [delay: number, gain: number])[] = [
  [0, 1],
  [0.23, 0.35],
  [0.46, 0.12],
]
const ECHO_LOWPASS = 1500

/** Gain linéaire pour un pic de `db` dBFS, avec une marge (`headroom`) pour l’harmonique, l’écho et les recouvrements legato. */
export const dbToGain = (db: number, headroom = 1.6) => 10 ** (db / 20) / headroom

/** Horloge (`c.currentTime`) jusqu’à laquelle un motif sonne : une future musique de fond ne démarre pas avant. */
export const motifBusyUntil = ref(0)

/** Réglages de l’avertissement rare des niveaux 3+ : grave, très lent, voilé. */
export const motifWarning = (): MotifOpts => ({ variant: 'mystere', octave: -1, slow: 2.4, lowpass: 900, peakDb: -26 })

/** Joue le motif sur `out` ; renvoie sa durée (s, écho et relâche compris). Muet : rien ne démarre, renvoie 0. */
export const playMotif = (c: AudioContext, out: AudioNode, o: MotifOpts = {}): number => {
  if (muted.value) return 0
  const { hz, ms } = MOTIF[o.variant ?? 'mystere']
  const slow = o.slow ?? 1
  const mult = 2 ** (o.octave ?? 0)
  const peak = dbToGain(o.peakDb ?? -22)
  const lowpass = o.lowpass ?? 2400
  const copies = o.echo === false ? ECHOES.slice(0, 1) : ECHOES
  const t0 = o.at ?? c.currentTime
  let t = t0
  let end = t0
  hz.forEach((f, i) => {
    const d = (ms[i] * slow) / 1000
    const rel = Math.min(RELEASE * slow, d * 0.6)
    for (const [delay, k] of copies) {
      const s = t + delay * slow
      const stopAt = s + d + rel + 0.05
      end = Math.max(end, stopAt)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, s)
      g.gain.linearRampToValueAtTime(peak * k, s + ATTACK)
      g.gain.setValueAtTime(peak * k, s + d)
      g.gain.exponentialRampToValueAtTime(0.0001, s + d + rel)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = delay ? Math.min(ECHO_LOWPASS, lowpass) : lowpass
      lp.Q.value = 0.5
      g.connect(lp)
      lp.connect(out)
      const voice = (type: OscillatorType, ratio: number, amp: number) => {
        const osc = c.createOscillator()
        osc.type = type
        osc.frequency.value = f * mult * ratio
        const a = c.createGain()
        a.gain.value = amp
        osc.connect(a)
        a.connect(g)
        if (ratio === 1) {
          // vibrato qui s’installe sur 80 % de la note
          const lfo = c.createOscillator()
          lfo.frequency.value = VIBRATO_HZ
          const depth = c.createGain()
          depth.gain.setValueAtTime(0, s)
          depth.gain.linearRampToValueAtTime(VIBRATO_CENTS, s + d * 0.8)
          lfo.connect(depth)
          depth.connect(osc.detune)
          lfo.start(s)
          lfo.stop(stopAt)
        }
        osc.start(s)
        osc.stop(stopAt)
      }
      voice('sine', 1, 1)
      if (!o.pure) voice('triangle', 2, HARMONIC_GAIN)
    }
    t += d
  })
  motifBusyUntil.value = Math.max(motifBusyUntil.value, end)
  return end - t0
}
