import { ac, effetsOut, muted, noiseBuffer } from './sfx'

// Sons de papier des cartes (coupe, collection) : bruit filtré, enveloppes courtes, hauteur légèrement aléatoire.
// Tous passent par le bus des effets et restent bien sous `cardThud` (crête 0,4, soit environ -20 dBFS, le plus fort des sons de ce fichier).
export const PEAK = { hover: 0.04, slide: 0.07, whoosh: 0.12, tap: 0.08, collect: 0.07 } as const
export const ENV_MIN = 0.03 // durées (s) des frottements de papier
export const ENV_MAX = 0.15
export const WHOOSH_DUR = 0.34
export const HOVER_MIN_INTERVAL = 140 // ms entre deux frôlements, même en passant d’une carte à l’autre
const JITTER = 0.18 // ± part de la fréquence centrale

/** Fréquence centrale avec un jitter aléatoire, bornée à 1–6 kHz pour le papier. */
export const jitter = (base: number, rand: () => number = Math.random) => Math.min(6000, Math.max(1000, base * (1 + (rand() * 2 - 1) * JITTER)))

/** Limiteur de fréquence : vrai si `now` (ms) est assez loin du dernier son accepté. */
export const createGate = (minInterval: number) => {
  let last = -Infinity
  return (now: number) => {
    if (now - last < minInterval) return false
    last = now
    return true
  }
}
const hoverGate = createGate(HOVER_MIN_INTERVAL)

type PaperKind = 'bandpass' | 'highpass'
// Un frôlement : bruit court, filtre, attaque rapide puis chute exponentielle.
const paper = (c: AudioContext, at: number, dur: number, freq: number, peak: number, kind: PaperKind = 'bandpass') => {
  const d = Math.min(ENV_MAX, Math.max(ENV_MIN, dur))
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, d)
  const f = c.createBiquadFilter()
  f.type = kind
  f.Q.value = kind === 'bandpass' ? 0.9 : 0.5
  f.frequency.setValueAtTime(jitter(freq), at)
  f.frequency.exponentialRampToValueAtTime(jitter(freq * 1.35), at + d)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(peak, at + d * 0.25)
  g.gain.exponentialRampToValueAtTime(0.001, at + d)
  src.connect(f).connect(g).connect(effetsOut(c))
  src.start(at)
}

const ready = () => {
  const c = ac()
  return c && !muted.value ? c : null
}

/** Survol d’une carte de la coupe : frôlement de papier très discret, au plus un toutes les 140 ms. */
export const cardHover = () => {
  const c = ready()
  if (!c || !hoverGate(performance.now())) return
  paper(c, c.currentTime, 0.06, 4200, PEAK.hover, 'highpass')
}

/** Choix d’une carte : souffle qui monte pendant que les deux autres glissent (deux « fsst » décalés). */
export const cardPick = () => {
  const c = ready()
  if (!c) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, WHOOSH_DUR)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 0.8
  f.frequency.setValueAtTime(jitter(700), t)
  f.frequency.exponentialRampToValueAtTime(jitter(3200), t + WHOOSH_DUR)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(PEAK.whoosh, t + 0.12)
  g.gain.exponentialRampToValueAtTime(0.001, t + WHOOSH_DUR)
  src.connect(f).connect(g).connect(effetsOut(c))
  src.start(t)
  paper(c, t + 0.1, 0.1, 3000, PEAK.slide)
  paper(c, t + 0.17, 0.1, 2400, PEAK.slide)
}

/** Choix en mouvement réduit : pas de trajet, seulement une petite tape de papier. */
export const cardPickStill = () => {
  const c = ready()
  if (c) paper(c, c.currentTime, 0.08, 2200, PEAK.tap)
}

/** Ouverture de la collection ; `fresh` : une carte nouvelle est mise en évidence (second frôlement un peu plus aigu). */
export const cardCollect = (fresh: boolean) => {
  const c = ready()
  if (!c) return
  const t = c.currentTime
  paper(c, t, 0.09, 2800, PEAK.collect)
  if (fresh) paper(c, t + 0.14, 0.12, 3800, PEAK.collect)
}
