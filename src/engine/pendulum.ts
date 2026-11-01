import type { Rng } from './rng'

// Le pendule divinatoire : simulation pure (aucun DOM, aucune horloge), pilotée image par image par le composant.
// Le cristal oscille à l’amplitude `amplitude` au-dessus d’un demi-cercle de symboles ; `stopped` ajoute un fort amortissement visqueux
// puis, sous `hold` rad/s, un frottement sec (la main retient le fil) : le cristal s’immobilise là où il est, pas au centre.
// Pendant l’arrêt la main pince le fil : la pesanteur n’agit plus, donc le cristal glisse de `omega / stop` radians dans son sens de marche (prévisible : on devance de cette distance).

/** Demi-ouverture (rad) de l’arc de symboles : ils couvrent 2 × 70° autour de la verticale, dans un demi-cercle gravé de 2 × 90°. */
export const HALF_ARC = (7 * Math.PI) / 18
/** Amplitude (rad) du balancement : un peu au-delà des symboles des extrémités, pour que le cristal puisse s’y arrêter. */
export const AMPLITUDE = HALF_ARC + 0.2
/** Pas interne (s) de l’intégration : fixe, donc indépendant de la cadence d’affichage. */
export const SUBSTEP = 1 / 240

export interface PendulumState {
  /** Angle à la verticale (rad), positif vers la droite. */
  theta: number
  /** Vitesse angulaire (rad/s). */
  omega: number
  /** L’arrêt est demandé : fort amortissement. */
  stopped: boolean
  /** Immobile (seulement après un arrêt) : plus rien ne bouge. */
  rest: boolean
}

export interface PendulumParams {
  /** g / L (s⁻²) : fixe la période. */
  w2: number
  /** Amortissement visqueux libre (s⁻¹) : très faible, la fatigue lente d’un vrai pendule. */
  free: number
  /** Amortissement visqueux de l’arrêt (s⁻¹) : fort. */
  stop: number
  /** Sous cette vitesse (rad/s), après un arrêt, le cristal est retenu. */
  hold: number
}

export const FREE_DAMPING = 0.012
export const STOP_DAMPING = 7
export const HOLD_SPEED = 0.3

/** Moyenne arithmético-géométrique (convergence quadratique : quelques tours suffisent). */
const agm = (a: number, b: number): number => {
  let x = a
  let y = b
  for (let i = 0; i < 12 && Math.abs(x - y) > 1e-12; i++) [x, y] = [(x + y) / 2, Math.sqrt(x * y)]
  return x
}

/** Facteur de période d’un pendule simple à l’amplitude `amplitude` (rad) : T = T₀ × facteur (1 aux petites amplitudes), exact (T = T₀ · 2K(k)/π = T₀ / AGM(1, cos(A/2))). */
export const periodFactor = (amplitude: number): number => 1 / agm(1, Math.cos(amplitude / 2))

/** Période réelle (s) d’un balancement d’amplitude `amplitude` pour g/L = `w2`. */
export const swingPeriod = (w2: number, amplitude: number): number => ((2 * Math.PI) / Math.sqrt(w2)) * periodFactor(amplitude)

/** g/L qui donne la période réelle `period` (s) à l’amplitude `amplitude` : on règle la période voulue, pas celle des petites oscillations. */
export const w2ForPeriod = (period: number, amplitude: number): number => ((2 * Math.PI * periodFactor(amplitude)) / period) ** 2

/** Un pas d’intégration de `dt` (s) : Euler semi-implicite, amortissement implicite (stable même très fort). */
const substep = (s: PendulumState, p: PendulumParams, dt: number): PendulumState => {
  const c = s.stopped ? p.stop : p.free
  const gravity = s.stopped ? 0 : p.w2 * Math.sin(s.theta)
  const omega = (s.omega - gravity * dt) / (1 + c * dt)
  if (s.stopped && Math.abs(omega) < p.hold) return { theta: s.theta, omega: 0, stopped: true, rest: true }
  return { theta: s.theta + omega * dt, omega, stopped: s.stopped, rest: false }
}

/** Avance l’état de `dt` secondes (découpé en pas fixes) ; un état immobile est rendu tel quel. */
export const stepPendulum = (state: PendulumState, dt: number, p: PendulumParams): PendulumState => {
  if (state.rest || dt <= 0) return state
  const n = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-9))
  let s = state
  for (let i = 0; i < n && !s.rest; i++) s = substep(s, p, dt / n)
  return s
}

/** Demande l’arrêt : l’amortissement fort s’applique dès le pas suivant (la position et la vitesse ne sautent pas). */
export const requestStop = (s: PendulumState): PendulumState => (s.stopped ? s : { ...s, stopped: true })

/**
 * Lance le pendule de l’angle `theta` avec l’énergie d’un balancement d’amplitude `amplitude`, vers `dir` (+1 droite, −1 gauche) :
 * la vitesse se déduit de la conservation de l’énergie, donc un départ de repos (relance après un raté) ou du centre se fait sans saut.
 */
export const launch = (p: PendulumParams, amplitude: number, theta = 0, dir: 1 | -1 = 1): PendulumState => {
  const k = 2 * p.w2 * (Math.cos(theta) - Math.cos(amplitude))
  return { theta, omega: dir * Math.sqrt(Math.max(0, k)), stopped: false, rest: false }
}

/** Côté vers lequel pousser depuis un repos à `theta` : vers le côté où il y a le plus de place (au centre, vers la droite). */
export const pushDir = (theta: number): 1 | -1 => (theta > 0 ? -1 : 1)

/** Angle (rad) du symbole `i` parmi `n`, répartis également sur l’arc. */
export const symbolAngle = (i: number, n: number): number => (n < 2 ? 0 : -HALF_ARC + (i * 2 * HALF_ARC) / (n - 1))

/** Écart (rad) entre deux symboles voisins. */
export const symbolSpacing = (n: number): number => (n < 2 ? 2 * HALF_ARC : (2 * HALF_ARC) / (n - 1))

/**
 * Symbole retenu par un cristal immobile à `theta` : le plus proche, si l’écart reste dans la tolérance (`ratio` × espacement,
 * 0,5 = aucun interstice) ; sinon `null` (entre deux symboles, ou hors de l’arc).
 */
export const heldSymbol = (theta: number, n: number, ratio: number): number | null => {
  if (n < 1) return null
  const spacing = symbolSpacing(n)
  const i = Math.min(n - 1, Math.max(0, Math.round((theta + HALF_ARC) / spacing)))
  return Math.abs(theta - symbolAngle(i, n)) <= ratio * spacing + 1e-9 ? i : null
}

/** Angle où le cristal s’immobiliserait si l’arrêt était demandé maintenant (simulation à blanc, bornée). */
export const restAngle = (state: PendulumState, p: PendulumParams, maxS = 5): number => {
  let s = requestStop(state)
  for (let t = 0; t < maxS && !s.rest; t += 1 / 120) s = stepPendulum(s, 1 / 120, p)
  return s.theta
}

/** Réglage par niveau (2 à 5, borné) : plus de symboles, plus vite, tolérance plus étroite. */
export interface PendulumTuning {
  /** Nombre de symboles sur l’arc. */
  count: number
  /** Période réelle du balancement (s). */
  period: number
  /** Demi-largeur de la zone d’un symbole, en part de l’espacement (0,5 = jointives). */
  ratio: number
  /** Essais avant l’échec. */
  tries: number
}

const TUNINGS: readonly PendulumTuning[] = [
  { count: 5, period: 3.6, ratio: 0.5, tries: 2 },
  { count: 6, period: 3.3, ratio: 0.46, tries: 2 },
  { count: 7, period: 3.0, ratio: 0.42, tries: 2 },
  { count: 8, period: 2.8, ratio: 0.4, tries: 2 },
]

export const tuningFor = (level: number): PendulumTuning => TUNINGS[Math.min(5, Math.max(2, Math.round(level))) - 2]

/** Paramètres physiques d’un niveau ; `slow` (mouvement réduit) allonge la période de moitié. */
export const paramsFor = (tuning: PendulumTuning, slow = false): PendulumParams => ({
  w2: w2ForPeriod(tuning.period * (slow ? 1.5 : 1), AMPLITUDE),
  free: FREE_DAMPING,
  stop: STOP_DAMPING,
  hold: HOLD_SPEED,
})

/** Tire `n` éléments distincts de `pool`, dans un ordre aléatoire (Fisher-Yates, `rng` injecté). */
export const pickSymbols = <T>(rng: Rng, pool: readonly T[], n: number): T[] => {
  const a = [...pool]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

/** Indice visé parmi `n` symboles. */
export const pickTarget = (rng: Rng, n: number): number => Math.min(n - 1, Math.floor(rng() * n))
