// Qualité adaptative des ombres lancées des fonds raymarchés : une règle fixe (appareil tactile ou écran étroit) et un budget mesuré.

/** Requête média sous laquelle les ombres sont coupées : pointeur grossier (téléphones, tablettes) ou largeur de 640 px et moins. */
export const SHADOWS_OFF_MEDIA = '(pointer: coarse), (max-width: 640px)'

/** Budget moyen du passage du fond, en ms de GPU : 12 ms laissent ~4 ms de marge à 60 Hz (16,7 ms) pour le CRT et la composition. */
export const SHADOW_BUDGET_MS = 12
/** Sans mesure GPU (pas de `timestamp-query`) : intervalle moyen entre deux images au-delà duquel on coupe ; la boucle vise 33 ms (30 i/s). */
export const SHADOW_FALLBACK_FRAME_MS = 45
/** Nombre d’images moyennées avant de juger : ~1 s à 30 i/s, assez pour ne pas réagir à un à-coup isolé. */
export const SHADOW_WINDOW = 30
/** Une image plus longue que cela (onglet resté caché, reprise) n’est pas une mesure de coût. */
const SHADOW_MAX_SAMPLE_MS = 250

export interface ShadowBudget {
  /** Ajoute une mesure en ms (durée GPU du passage, ou intervalle entre images en repli). */
  push: (ms: number) => void
  /** Vrai dès qu’une fenêtre complète a dépassé la limite : les ombres restent coupées jusqu’au démontage (pas de va-et-vient). */
  readonly over: boolean
}

/** Juge le coût mesuré par fenêtres de `window` images consécutives ; la limite s’applique à la moyenne de la fenêtre. */
export const createShadowBudget = (limitMs: number, window = SHADOW_WINDOW): ShadowBudget => {
  let sum = 0
  let n = 0
  let over = false
  return {
    push: (ms) => {
      if (over || !Number.isFinite(ms) || ms < 0 || ms > SHADOW_MAX_SAMPLE_MS) return
      sum += ms
      if (++n < window) return
      over = sum / n > limitMs
      sum = 0
      n = 0
    },
    get over() {
      return over
    },
  }
}
