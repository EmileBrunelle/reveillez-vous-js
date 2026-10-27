import { ac, effetsOut, muted } from './sfx'

// Sons de la planche : tick de bois à chaque lettre validée, ton creux à l’adieu. Tout passe par le bus des effets.
export const OUIJA_PEAK = { tick: 0.1, farewell: 0.12 } as const

const ready = () => {
  const c = ac()
  return c && !muted.value ? c : null
}

/** Lettre validée : petit « tic » de bois (triangle bref qui chute, filtré), hauteur légèrement aléatoire. */
export const ouijaTick = () => {
  const c = ready()
  if (!c) return
  const at = c.currentTime
  const o = c.createOscillator()
  o.type = 'triangle'
  const f0 = 900 * (1 + (Math.random() * 2 - 1) * 0.08)
  o.frequency.setValueAtTime(f0, at)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.55, at + 0.05)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1100
  bp.Q.value = 2.5
  const g = c.createGain()
  g.gain.setValueAtTime(OUIJA_PEAK.tick, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
  o.connect(bp).connect(g).connect(effetsOut(c))
  o.start(at)
  o.stop(at + 0.08)
}

/** AU REVOIR : ton grave et creux qui s’éteint (deux sinus légèrement désaccordés, passe-bas). */
export const ouijaFarewell = () => {
  const c = ready()
  if (!c) return
  const at = c.currentTime
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 500
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(OUIJA_PEAK.farewell, at + 0.06)
  g.gain.exponentialRampToValueAtTime(0.001, at + 1.4)
  lp.connect(g).connect(effetsOut(c))
  // composante médium discrète (triangle à l’octave, ~220 Hz) : audible sur un petit haut-parleur sans changer le timbre creux
  for (const f of [220, 225]) {
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(f, at)
    o.frequency.exponentialRampToValueAtTime(f * 0.8, at + 1.4)
    const og = c.createGain()
    og.gain.value = 1
    o.connect(og).connect(lp)
    o.start(at)
    o.stop(at + 1.45)
  }
  for (const f of [110, 112.5]) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f, at)
    o.frequency.exponentialRampToValueAtTime(f * 0.8, at + 1.4)
    o.connect(lp)
    o.start(at)
    o.stop(at + 1.45)
  }
}
