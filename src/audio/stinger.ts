import { ac, effetsOut, muted } from './sfx'
import type { Outcome } from '../engine/activityTiming'

// Jingles d’environ 1 s qui concluent une activité, accordés sur le leitmotif (la) : réussite = montée de la (A4-C♯5-E5-A5,
// accord de la majeur, résolution), échec = descente comique en trombone (B♭4, la, sol, fa♯ glissant vers mi).
export interface StingerNote {
  hz: number
  /** Départ (s) depuis le début du jingle. */
  at: number
  dur: number
  /** Fréquence d’arrivée d’un glissando sur la durée de la note. */
  slideTo?: number
}

export const STINGERS: Record<Outcome, readonly StingerNote[]> = {
  win: [
    { hz: 440, at: 0, dur: 0.14 },
    { hz: 554.37, at: 0.14, dur: 0.14 },
    { hz: 659.25, at: 0.28, dur: 0.14 },
    { hz: 880, at: 0.42, dur: 0.55 },
  ],
  fail: [
    { hz: 466.16, at: 0, dur: 0.2 },
    { hz: 440, at: 0.22, dur: 0.2 },
    { hz: 392, at: 0.44, dur: 0.2 },
    { hz: 370, at: 0.66, dur: 0.4, slideTo: 329.63 },
  ],
}

/** Durée totale (s) d’un jingle : fin de la dernière note. */
export const stingerDuration = (o: Outcome): number => Math.max(...STINGERS[o].map((n) => n.at + n.dur))

const PEAK = 0.09

const NOOP = () => {}

/** Joue le jingle sur le bus des effets (donc le bus général et son limiteur). Renvoie une fonction d’arrêt (fondu de 30 ms, sans clic) ; muet : rien ne démarre et l’arrêt ne fait rien. */
export const playStinger = (o: Outcome, delay = 0): (() => void) => {
  const c = ac()
  if (!c || muted.value) return NOOP
  const stops: (() => void)[] = []
  const t0 = c.currentTime + delay
  const out = effetsOut(c)
  for (const n of STINGERS[o]) {
    const s = t0 + n.at
    const e = s + n.dur
    const osc = c.createOscillator()
    osc.type = o === 'win' ? 'triangle' : 'sawtooth'
    osc.frequency.setValueAtTime(n.hz, s)
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, e)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = o === 'win' ? 3200 : 1100
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, s)
    g.gain.linearRampToValueAtTime(PEAK, s + 0.015)
    g.gain.setValueAtTime(PEAK, e - 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, e + 0.04)
    osc.connect(lp).connect(g).connect(out)
    osc.start(s)
    osc.stop(e + 0.06)
    stops.push(() => {
      const t = c.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(0, t, 0.01)
      osc.stop(t + 0.04)
    })
  }
  return () => stops.forEach((f) => f())
}
