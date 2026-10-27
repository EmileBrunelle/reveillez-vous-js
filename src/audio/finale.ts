import { watch } from 'vue'
import { ac, finaleOut, muted } from './sfx'
import { ambienceDucked } from './ambience'
import { playMotif } from './motif'
import { runLater } from './runLater'

// Sons de la finale, synthétisés (Web Audio). Un seul bus `master` par finale : muet, « passer » et
// « Recommencer » ramènent ce bus à 0 puis arrêtent et déconnectent toutes les sources (aucun oscillateur orphelin).
export const FINALE_LEVEL = 0.5
const PAD_PEAK = 0.16
const BELL_PEAK = 0.1
const WHINE_PEAK = 0.06
export const PAD_HZ = [110, 138.59, 164.81, 220, 277.18] // la majeur : A2 C♯3 E3 A3 C♯4
/** « Bonjour » : le motif de l’aube (une octave plus haut, sinus pur, tempo ×1,3) précède la cloche de ~0,3 s. Le bus `master` est à FINALE_LEVEL : on compense pour viser ≈ -20 dBFS crête en sortie. */
export const BELL_DELAY = 0.3
export const BONJOUR_MOTIF_DB = -27
export const PAD_RISE = 3.5
export const PAD_FALL = 4

export interface FinaleAudio {
  /** Extinction du téléviseur : sifflement qui tombe + clic, au moment où les barres se ferment. */
  powerDown: () => void
  /** Aube : nappe chaude qui monte en ~3,5 s. */
  dawn: () => void
  /** Le générique arrive : la nappe s’éteint doucement. */
  fadePad: () => void
  /** Une cloche douce sur « Bonjour. ». */
  bell: () => void
  /** Coupe tout en fondu (passer, Recommencer, démontage) ; idempotent. `releaseDuck` à false (saut de séquence) : les ambiances restent étouffées jusqu’au prochain arrêt complet. */
  stop: (releaseDuck?: boolean) => void
}

const noop: FinaleAudio = { powerDown: () => {}, dawn: () => {}, fadePad: () => {}, bell: () => {}, stop: () => {} }

/** `enabled` à false (mouvement réduit) : aucun son, aucun nœud créé. */
export const startFinaleAudio = (enabled = true): FinaleAudio => {
  const c = enabled ? ac() : null
  if (!c) return noop
  const master = c.createGain()
  master.gain.value = muted.value ? 0 : FINALE_LEVEL
  master.connect(finaleOut(c))
  const sources: AudioScheduledSourceNode[] = []
  let padGain: GainNode | null = null
  const padOscs: OscillatorNode[] = []
  let stopped = false
  // La sourdine passe par `master` : les sons démarrent quand même, et réapparaissent si on la retire en cours de finale.
  const live = () => !stopped

  const unwatch = watch(muted, (m) => {
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setTargetAtTime(m ? 0 : FINALE_LEVEL, c.currentTime, 0.05)
  })
  const osc = (type: OscillatorType, hz: number) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = hz
    sources.push(o)
    return o
  }

  return {
    powerDown() {
      if (!live()) return
      ambienceDucked.value = true // le noir est silencieux : les ambiances s’étouffent jusqu’à l’arrêt
      const t = c.currentTime
      const o = osc('sine', 9000)
      o.frequency.setValueAtTime(9000, t)
      o.frequency.exponentialRampToValueAtTime(60, t + 1.0)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(WHINE_PEAK, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 1.05)
      // clic doux en fin de course (la ligne se ferme)
      const k = osc('triangle', 180)
      k.frequency.setValueAtTime(180, t + 1.0)
      k.frequency.exponentialRampToValueAtTime(50, t + 1.12)
      const kg = c.createGain()
      kg.gain.setValueAtTime(0.0001, t + 1.0)
      kg.gain.linearRampToValueAtTime(0.12, t + 1.01)
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 1.12)
      k.connect(kg).connect(master)
      k.start(t + 1.0)
      k.stop(t + 1.15)
    },
    dawn() {
      if (!live() || padGain) return
      const t = c.currentTime
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(300, t)
      lp.frequency.exponentialRampToValueAtTime(1400, t + PAD_RISE)
      padGain = c.createGain()
      padGain.gain.setValueAtTime(0.0001, t)
      padGain.gain.linearRampToValueAtTime(PAD_PEAK, t + PAD_RISE)
      lp.connect(padGain).connect(master)
      PAD_HZ.forEach((hz, i) => {
        for (const d of [-5, 5]) {
          const o = osc('sawtooth', hz)
          padOscs.push(o)
          o.detune.value = d + i // léger désaccord : nappe chaude, sans battement net
          const og = c.createGain()
          og.gain.value = 0.2
          o.connect(og).connect(lp)
          o.start(t)
        }
      })
    },
    fadePad() {
      if (!padGain || stopped) return
      const t = c.currentTime
      padGain.gain.cancelScheduledValues(t)
      padGain.gain.setValueAtTime(Math.max(padGain.gain.value, 0.0001), t)
      padGain.gain.exponentialRampToValueAtTime(0.0001, t + PAD_FALL)
      padOscs.forEach((o) => o.stop(t + PAD_FALL + 0.1)) // nappe inaudible : on libère les oscillateurs
    },
    bell() {
      if (!live()) return
      const t = c.currentTime + BELL_DELAY
      playMotif(c, master, { variant: 'aube', octave: 1, pure: true, slow: 1 / 1.3, peakDb: BONJOUR_MOTIF_DB + 20 * Math.log10(1 / FINALE_LEVEL) })
      // partiels de cloche, chacun avec sa décroissance exponentielle
      const partials: [number, number, number][] = [
        [880, 1, 3.2],
        [2217, 0.35, 2.0],
        [2640, 0.2, 1.4],
        [3520, 0.1, 0.8],
      ]
      partials.forEach(([hz, amp, dur]) => {
        const o = osc('sine', hz)
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.linearRampToValueAtTime(BELL_PEAK * amp, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g).connect(master)
        o.start(t)
        o.stop(t + dur + 0.05)
      })
    },
    stop(releaseDuck = true) {
      if (releaseDuck) ambienceDucked.value = false
      if (stopped) return
      stopped = true
      unwatch()
      const t = c.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setTargetAtTime(0, t, 0.06)
      runLater(() => {
        sources.forEach((s) => {
          try {
            s.stop()
          } catch {
            /* déjà arrêté */
          }
        })
        master.disconnect()
      }, 400)
    },
  }
}
