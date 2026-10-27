import type { NoteEvent } from './musicPlan'

// Piano de feutre synthétisé : cinq partiels légèrement inharmoniques à décroissance propre, passe-bas selon la vélocité,
// petit bruit de marteau. Fonctionne sur tout BaseAudioContext (donc aussi OfflineAudioContext pour les rendus d’essai).
const PARTIALS: readonly (readonly [k: number, amp: number])[] = [
  [1, 1],
  [2, 0.45],
  [3, 0.28],
  [4, 0.14],
  [5, 0.07],
]
/** Gain par note : la somme des partiels et des chevauchements vise ≈ -25 dBFS crête à l’entrée du bus (mesuré hors ligne : -25 à -31). */
export const NOTE_TRIM = 0.02

export interface PhraseHandle {
  /** Fondu (s) puis arrêt de tous les oscillateurs. */
  stop: (fade?: number) => void
  /** Instant (horloge du contexte) de la fin naturelle. */
  end: number
}

/** Planifie la phrase à `t0` vers `out` ; `wobble` (cents) ajoute un léger flottement de hauteur (niveaux 3–4). */
export const playPhrase = (c: BaseAudioContext, out: AudioNode, t0: number, notes: readonly NoteEvent[], wobble = 0): PhraseHandle => {
  const master = c.createGain()
  master.gain.value = 1
  master.connect(out)
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = []
  let lfo: OscillatorNode | null = null
  let lfoGain: GainNode | null = null
  if (wobble > 0) {
    lfo = c.createOscillator()
    lfo.frequency.value = 0.35 + Math.random() * 0.2
    lfoGain = c.createGain()
    lfoGain.gain.value = wobble
    lfo.connect(lfoGain)
    sources.push(lfo)
  }
  let end = t0
  for (const n of notes) {
    const t = t0 + n.at
    const g = c.createGain()
    g.gain.value = n.velocity * NOTE_TRIM
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800 + n.velocity * 1400
    lp.Q.value = 0.4
    g.connect(lp).connect(master)
    for (const [k, amp] of PARTIALS) {
      const d = n.decay / k ** 0.7
      const o = c.createOscillator()
      o.frequency.value = n.hz * k * Math.sqrt(1 + 0.0005 * k * k)
      o.detune.setValueAtTime(n.cents, t)
      if (n.sag) o.detune.linearRampToValueAtTime(n.cents + n.sag, t + d)
      lfoGain?.connect(o.detune)
      const e = c.createGain()
      e.gain.setValueAtTime(0.0001, t)
      e.gain.linearRampToValueAtTime(amp, t + 0.006)
      e.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(e).connect(g)
      o.start(t)
      o.stop(t + d + 0.05)
      sources.push(o)
      end = Math.max(end, t + d + 0.05)
    }
    // marteau : bruit bref passe-bande (pas pour l’écho)
    if (!n.echo) {
      const len = 2400
      const buf = c.createBuffer(1, len, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
      const s = c.createBufferSource()
      s.buffer = buf
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = Math.min(n.hz * 3, 3000)
      bp.Q.value = 1
      const hg = c.createGain()
      hg.gain.value = 0.25
      s.connect(bp).connect(hg).connect(g)
      s.start(t)
      sources.push(s)
    }
  }
  if (lfo) {
    lfo.start(t0)
    lfo.stop(end)
  }
  let stopped = false
  return {
    end,
    stop: (fade = 0.4) => {
      if (stopped) return
      stopped = true
      const now = c.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setTargetAtTime(0, now, fade / 4)
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
