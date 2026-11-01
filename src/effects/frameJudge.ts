// Juge de fluidité : logique pure (temps injecté) du gouverneur de qualité. Décide quand descendre ou remonter d’un niveau, avec hystérésis.

export interface JudgeConfig {
  /** Descente : moyenne glissante (ms) au-delà de laquelle on descend (~22 ms = moins de ~45 i/s soutenues). */
  downMs: number
  /** Descente : durée de la fenêtre glissante. */
  downWindowMs: number
  /**
   * Remontée : la moyenne doit tenir sous cette valeur (marge confortable sous 16,7 ms) … Sur un écran de 60 Hz, rAF ne descend
   * jamais sous 16,7 ms : la limite est donc relevée à 1,06 × la période d’écran estimée (5e centile des durées, voir `isCalm`).
   */
  upMeanMs: number
  /** … et le 95e centile sous celle-ci (les à-coups comptent) … */
  upP95Ms: number
  /** … sur cette fenêtre, plus longue que celle de la descente. */
  upWindowMs: number
  /** Une mesure plus longue (onglet resté caché, compilation de pipeline, reprise) n’en est pas une. */
  maxSampleMs: number
  /** Plafond de cadence connu (ms) : un navigateur qui bride rAF à 30 Hz (économie d’énergie, écran à 30 Hz). 0 = pas de détection (juge GPU). */
  capMs: number
  /** Tolérance (ms) autour de `capMs` pour le 5e centile des intervalles (très réguliers = plafond). */
  capTolMs: number
  /** Sous plafond, une image est « manquée » au-delà de ce multiple de `capMs` (~47 ms : 50 et 66 ms comptent, une gigue de 40 ms non). */
  capLateFactor: number
  /** Sous plafond, descente si plus de cette part des images de la fenêtre est manquée. */
  capLateShare: number
  /** Pas d’évaluation : le 95e centile trie la fenêtre, inutile de le faire à chaque image. */
  evalEveryMs: number
}

export const JUDGE_DEFAULTS: JudgeConfig = {
  downMs: 22,
  downWindowMs: 2000,
  upMeanMs: 14,
  upP95Ms: 18,
  upWindowMs: 5000,
  maxSampleMs: 250,
  capMs: 1000 / 30,
  capTolMs: 1.2,
  capLateFactor: 1.4,
  capLateShare: 0.15,
  evalEveryMs: 250,
}

/** Silence après un changement de niveau : on ne rejuge pas avant ~8 s (les mesures du nouveau niveau n’ont pas encore de sens). */
export const COOLDOWN_MS = 8000
/** Silence après le chargement ou un changement de phase : la première seconde est gâchée par les compilations et les montages. */
export const WARMUP_MS = 1000

export type Verdict = 'down' | 'up' | null

/** Fenêtre « calme » : moyenne sous la limite de remontée (relevée à 1,06 × la période d’écran, qu’un 60 Hz ne permet pas de battre) et 95e centile sous `upP95Ms`. */
export const isCalm = (s: WindowStats, c: Pick<JudgeConfig, 'upMeanMs' | 'upP95Ms'> = JUDGE_DEFAULTS): boolean => s.mean < Math.max(c.upMeanMs, 1.06 * s.p5) && s.p95 < c.upP95Ms

export interface WindowStats {
  n: number
  mean: number
  /** 5e centile : estime la période de l’écran (les images ne sont jamais plus courtes que la synchro verticale). */
  p5: number
  p95: number
  /** Temps écoulé depuis la plus vieille mesure de la fenêtre (la fenêtre est-elle remplie ?). */
  spanMs: number
}

export interface FrameJudge {
  /** Ajoute une durée d’image (ms) prise à l’instant `now` (ms) ; renvoie un verdict seulement si la fenêtre est remplie. */
  push: (ms: number, now: number) => Verdict
  /** Vide les mesures et se tait pendant `waitMs` (jamais moins que le silence déjà en cours). */
  restart: (now: number, waitMs: number) => void
  /** Moyenne et 95e centile des mesures des `windowMs` dernières ms ; null si aucune. */
  stats: (windowMs: number, now: number) => WindowStats | null
}

/** Capacité du tampon circulaire : 5 s à 240 Hz = 1 200 mesures ; au-delà, les plus vieilles sont écrasées. */
const CAPACITY = 4096

/** Crée un juge ; `cfg` remplace les valeurs par défaut (tests, budget GPU). */
export const createFrameJudge = (cfg: Partial<JudgeConfig> = {}): FrameJudge => {
  const c = { ...JUDGE_DEFAULTS, ...cfg }
  // Tampon circulaire préalloué : `start` = plus vieille mesure, `count` = mesures gardées. Aucune allocation par image.
  const times = new Float64Array(CAPACITY)
  const values = new Float64Array(CAPACITY)
  const scratch = new Float64Array(CAPACITY) // copie triée au moment du jugement seulement
  let start = 0
  let count = 0
  let quietUntil = 0
  let lastEval = -Infinity

  const timeAt = (i: number) => times[(start + i) % CAPACITY]!
  const valueAt = (i: number) => values[(start + i) % CAPACITY]!

  /** Indice (depuis la plus vieille) de la première mesure de la fenêtre `windowMs`. */
  const firstIn = (windowMs: number, now: number): number => {
    let from = count
    while (from > 0 && timeAt(from - 1) >= now - windowMs) from--
    return from
  }

  const stats = (windowMs: number, now: number): WindowStats | null => {
    const from = firstIn(windowMs, now)
    const n = count - from
    if (n === 0) return null
    let sum = 0
    for (let i = 0; i < n; i++) {
      const v = valueAt(from + i)
      scratch[i] = v
      sum += v
    }
    const sorted = scratch.subarray(0, n).sort()
    return { n, mean: sum / n, p5: sorted[Math.max(Math.ceil(0.05 * n) - 1, 0)]!, p95: sorted[Math.ceil(0.95 * n) - 1]!, spanMs: now - timeAt(from) }
  }

  /** Part des mesures de la fenêtre qui dépassent `thresholdMs`. */
  const shareAbove = (windowMs: number, now: number, thresholdMs: number): number => {
    const from = firstIn(windowMs, now)
    const n = count - from
    let late = 0
    for (let i = from; i < count; i++) if (valueAt(i) > thresholdMs) late++
    return n === 0 ? 0 : late / n
  }

  /** Plafond de cadence : la période d’écran estimée (5e centile sur la longue fenêtre) tombe sur ~33,3 ms, 30 Hz imposés. */
  const isCapped = (now: number): boolean => {
    if (c.capMs <= 0) return false
    const long = stats(c.upWindowMs, now)
    return !!long && Math.abs(long.p5 - c.capMs) <= c.capTolMs
  }

  return {
    stats,
    restart: (now, waitMs) => {
      start = 0
      count = 0
      quietUntil = Math.max(quietUntil, now + waitMs)
      lastEval = -Infinity
    },
    push: (ms, now) => {
      if (!Number.isFinite(ms) || ms <= 0 || ms > c.maxSampleMs || now < quietUntil) return null
      if (count === CAPACITY) {
        start = (start + 1) % CAPACITY
        count--
      }
      const slot = (start + count) % CAPACITY
      times[slot] = now
      values[slot] = ms
      count++
      while (count > 1 && timeAt(0) < now - c.upWindowMs) {
        start = (start + 1) % CAPACITY
        count--
      }
      if (now - lastEval < c.evalEveryMs) return null
      lastEval = now
      const d = stats(c.downWindowMs, now)
      if (d && d.n >= 15 && d.spanMs >= 0.9 * c.downWindowMs) {
        // Sous plafond, la moyenne est faussée (33 ms même au repos) : on juge les images manquées ; la charge GPU, elle, a son propre juge.
        if (isCapped(now)) {
          if (shareAbove(c.downWindowMs, now, c.capLateFactor * c.capMs) > c.capLateShare) return 'down'
        } else if (d.mean > c.downMs) return 'down'
      }
      const u = stats(c.upWindowMs, now)
      if (u && u.n >= 30 && u.spanMs >= 0.95 * c.upWindowMs && isCalm(u, c)) return 'up'
      return null
    },
  }
}
