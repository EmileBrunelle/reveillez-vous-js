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

/** Crée un juge ; `cfg` remplace les valeurs par défaut (tests, budget GPU). */
export const createFrameJudge = (cfg: Partial<JudgeConfig> = {}): FrameJudge => {
  const c = { ...JUDGE_DEFAULTS, ...cfg }
  let times: number[] = []
  let values: number[] = []
  let quietUntil = 0
  let lastEval = -Infinity

  const stats = (windowMs: number, now: number): WindowStats | null => {
    let from = times.length
    while (from > 0 && times[from - 1]! >= now - windowMs) from--
    const n = times.length - from
    if (n === 0) return null
    const slice = values.slice(from)
    const mean = slice.reduce((a, b) => a + b, 0) / n
    slice.sort((a, b) => a - b)
    return { n, mean, p5: slice[Math.max(Math.ceil(0.05 * n) - 1, 0)]!, p95: slice[Math.ceil(0.95 * n) - 1]!, spanMs: now - times[from]! }
  }

  return {
    stats,
    restart: (now, waitMs) => {
      times = []
      values = []
      quietUntil = Math.max(quietUntil, now + waitMs)
      lastEval = -Infinity
    },
    push: (ms, now) => {
      if (!Number.isFinite(ms) || ms <= 0 || ms > c.maxSampleMs || now < quietUntil) return null
      times.push(now)
      values.push(ms)
      const drop = times.findIndex((t) => t >= now - c.upWindowMs)
      if (drop > 0) {
        times = times.slice(drop)
        values = values.slice(drop)
      }
      if (now - lastEval < c.evalEveryMs) return null
      lastEval = now
      const d = stats(c.downWindowMs, now)
      if (d && d.n >= 15 && d.spanMs >= 0.9 * c.downWindowMs && d.mean > c.downMs) return 'down'
      const u = stats(c.upWindowMs, now)
      if (u && u.n >= 30 && u.spanMs >= 0.95 * c.upWindowMs && isCalm(u, c)) return 'up'
      return null
    },
  }
}
