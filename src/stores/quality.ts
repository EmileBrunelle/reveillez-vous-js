import { ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { COOLDOWN_MS, createFrameJudge, isCalm, JUDGE_DEFAULTS, WARMUP_MS, type WindowStats } from '@/effects/frameJudge'
import { resetShadowVerdict, SHADOW_BUDGET_MS, SHADOWS_OFF_MEDIA } from '@/effects/shadowQuality'

/**
 * Gouverneur de qualité global (non persisté : le verdict dure autant que l’onglet).
 *
 * Trois niveaux : `high` (tout), `medium` (sans ombres lancées), `low` (résolutions réduites, moins de particules, CRT allégé).
 * Départ : `high` sur ordinateur, `medium` au toucher ou sous 641 px, `low` si l’appareil est modeste (≤ 2 cœurs, ≤ 2 Go de mémoire).
 * Le départ est aussi le plafond : un téléphone ne dépasse pas `medium`.
 *
 * Hystérésis (voir `effects/frameJudge.ts`) : descente si la moyenne des images dépasse ~22 ms sur ~2 s ; remontée si la
 * moyenne reste sous ~14 ms et le 95e centile sous ~18 ms sur ~5 s ; ~8 s de silence après tout changement ; après 2 descentes
 * depuis un même niveau, on ne revient plus à ce niveau de la session (anti-yoyo : à un niveau bas, les mesures sont meilleures
 * et feraient remonter puis redescendre en boucle).
 *
 * Plafond de cadence : si le 5e centile des intervalles tombe sur ~33,3 ms (rAF bridé à 30 Hz : économie d’énergie, écran à 30 Hz),
 * la moyenne ne dit plus rien ; on ne descend alors que sur des images manquées (> ~47 ms, plus de 15 % de la fenêtre) ou sur le
 * temps GPU (`reportGpuMs`, juge séparé sans détection de plafond).
 *
 * Douceur : une descente s’applique tout de suite (c’est un secours : la saccade est déjà visible) ; une remontée est seulement
 * mise en attente (`pendingUp`) et appliquée au prochain changement de scène ou de phase (`transition`), jamais en pleine animation.
 *
 * ## Brancher un consommateur
 * ```ts
 * const quality = useQuality()           // composable, voir plus bas
 * quality.level.value                    // 'high' | 'medium' | 'low', réactif ; lu à chaque image dans une boucle
 * quality.atLeast('medium')              // vrai en high et medium
 * quality.settled.value                  // niveau « posé » : ne change qu’aux transitions (pour ce qui recrée une ressource)
 * ```
 * - Un réglage continu (uniform) se lit à chaque image et se lisse côté CPU (voir `detail` dans `raymarch.ts`).
 * - Une ressource coûteuse à recréer (surface, texture) lit `settled` : elle ne bouge qu’aux transitions.
 * - Une option coûteuse tout-ou-rien (ombres) s’allume seulement si `atLeast('high')`.
 *
 * ### Encore à brancher (agents au travail sur ces fichiers au moment de l’écriture)
 * - Ombres et inclinaison des cartes (`TarotCard.vue`, `CardDeck.vue`) : en `low`, ombre portée unique au lieu de
 *   plusieurs couches et inclinaison (`useCardTilt`) sans lumière dynamique ; lire `level` dans un `computed`, jamais dans un style inline recalculé par image.
 *   (`DeckCut.vue` est branchée : `settled` lu au montage, `low` = sans sur-échantillonnage, sans inclinaison au pointeur, ombre fixe.)
 * - Door3D (`src/effects/door3d*`, `doors3d/*`) : passer `quality.level` à `createRaymarch`-like (`quality: () => level.value`) ou
 *   mettre l’uniforme `shadows` à `atLeast('high') ? 1 : 0` ; réduire le DPR comme `placeDpr` (voir `effects/resolution.ts`).
 * - Tout nouveau chargeur GPU qui passe par `startGpuLoop` : fournir `quality` et `onGpuSample` comme dans `BgPlace.vue`.
 */

export const QUALITY_LEVELS = ['high', 'medium', 'low'] as const
export type QualityLevel = (typeof QUALITY_LEVELS)[number]

const rank = (l: QualityLevel): number => QUALITY_LEVELS.indexOf(l)

export interface DeviceEnv {
  /** Pointeur grossier ou écran étroit (même règle que les ombres). */
  coarseOrNarrow: boolean
  /** `navigator.hardwareConcurrency` si connu. */
  cores?: number
  /** `navigator.deviceMemory` en Go si connu (absent de Firefox et Safari). */
  memory?: number
}

/** Niveau de départ d’un appareil. Les API absentes ne comptent pas : elles ne font jamais descendre. */
export const startLevel = (env: DeviceEnv): QualityLevel => {
  const modest = (env.cores !== undefined && env.cores > 0 && env.cores <= 2) || (env.memory !== undefined && env.memory > 0 && env.memory <= 2)
  if (modest) return 'low'
  return env.coarseOrNarrow ? 'medium' : 'high'
}

/** Lit l’environnement avec des gardes (hors navigateur ou API manquante : valeurs neutres). */
export const readDeviceEnv = (): DeviceEnv => {
  const nav = (globalThis as { navigator?: Navigator & { deviceMemory?: number } }).navigator
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia
  return {
    coarseOrNarrow: typeof mm === 'function' ? !!mm(SHADOWS_OFF_MEDIA).matches : false,
    cores: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    memory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined,
  }
}

/** `?quality=low|medium|high` : niveau forcé pour le débogage ; le gouverneur est alors muet. */
export const forcedLevel = (search: string): QualityLevel | null => {
  const q = new URLSearchParams(search).get('quality')
  return (QUALITY_LEVELS as readonly string[]).includes(q ?? '') ? (q as QualityLevel) : null
}

/** Part du budget GPU du fond que la remontée vers `high` exige libre : les ombres coûtent, il faut de la marge avant de les rendre. */
const SHADOW_HEADROOM_MS = SHADOW_BUDGET_MS * 0.6

const now = () => performance.now()

export const useQualityStore = defineStore('quality', () => {
  // Forçage de débogage : exclu du build de production (import.meta.env.DEV remplacé par false).
  const forced = import.meta.env.DEV ? forcedLevel((globalThis as { location?: { search: string } }).location?.search ?? '') : null
  const start = forced ?? startLevel(readDeviceEnv())
  const level = ref<QualityLevel>(start)
  /** Niveau posé aux transitions seulement : pour les ressources coûteuses à recréer (surface du CRT). */
  const settled = ref<QualityLevel>(start)
  /** Remontée décidée par les mesures, appliquée à la prochaine transition. */
  const pendingUp = ref<QualityLevel | null>(null)

  const frameJudge = createFrameJudge()
  // Temps GPU du passage du fond (timer de vgpu, rapporté par `createRaymarch`) : même règle de descente, budget des ombres.
  const gpuJudge = createFrameJudge({ downMs: SHADOW_BUDGET_MS, capMs: 0 })
  // Meilleur niveau permis (rang le plus petit) : le départ, relevé vers le bas par l’anti-yoyo.
  let bestRank = rank(start)
  const dropsFrom: Record<QualityLevel, number> = { high: 0, medium: 0, low: 0 }

  const quiet = (t: number) => {
    frameJudge.restart(t, COOLDOWN_MS)
    gpuJudge.restart(t, COOLDOWN_MS)
  }

  const lower = (t = now()): boolean => {
    if (forced || level.value === 'low') return false
    const from = level.value
    dropsFrom[from]++
    // Anti-yoyo : à la 2e descente depuis `from`, on ne revient plus à `from` de la session.
    if (dropsFrom[from] >= 2) bestRank = Math.max(bestRank, rank(from) + 1)
    level.value = QUALITY_LEVELS[rank(from) + 1]!
    pendingUp.value = null
    quiet(t)
    return true
  }

  /** Marge GPU suffisante pour rendre les ombres : sans mesure GPU (pas de `timestamp-query`), on ne bloque pas. */
  const shadowHeadroom = (t: number): boolean => {
    const g = gpuJudge.stats(JUDGE_DEFAULTS.upWindowMs, t)
    return !g || g.n < 30 || g.mean < SHADOW_HEADROOM_MS
  }

  const wantRise = (t: number) => {
    const target = QUALITY_LEVELS[rank(level.value) - 1]
    if (!target || rank(target) < bestRank) return
    if (target === 'high' && !shadowHeadroom(t)) return
    pendingUp.value = target
  }

  /** Durée d’une image (ms) mesurée par `useFrameBudget`, à l’instant `t` (performance.now). */
  const sample = (ms: number, t = now()) => {
    const v = frameJudge.push(ms, t) // forcé (débogage) : on mesure quand même, mais rien ne change
    if (forced) return
    if (v === 'down') lower(t)
    else if (v === 'up') wantRise(t)
  }

  /** Durée GPU du passage du fond (ms). Une descente demandée par le GPU a la même valeur qu’une descente par les images. */
  const reportGpuMs = (ms: number, t = now()) => {
    const v = gpuJudge.push(ms, t)
    if (forced) return
    if (v === 'down') lower(t)
  }

  /** Le budget propre des ombres est dépassé : en `high`, c’est une descente vers `medium` (les ombres se coupent par le niveau). */
  const reportShadowsOver = (t = now()) => {
    if (!forced && level.value === 'high') lower(t)
  }

  /** La mesure reprend (animation relancée, onglet revenu) : la première seconde ne compte pas. */
  const warmup = (t = now()) => {
    frameJudge.restart(t, WARMUP_MS)
    gpuJudge.restart(t, WARMUP_MS)
  }

  /**
   * Changement de scène ou de phase : c’est ici qu’une remontée en attente s’applique (si les ~2 dernières secondes sont encore
   * calmes), puis le niveau est « posé ». Les mesures repartent de zéro avec une seconde de grâce.
   */
  const transition = (t = now()) => {
    const target = pendingUp.value
    pendingUp.value = null
    if (target && !forced) {
      const recent = frameJudge.stats(JUDGE_DEFAULTS.downWindowMs, t)
      if (!recent || isCalm(recent)) {
        level.value = target
        if (target === 'high') resetShadowVerdict() // les ombres reviennent, leur budget les juge de nouveau
        quiet(t)
      }
    }
    settled.value = level.value
    warmup(t)
  }

  const atLeast = (min: QualityLevel): boolean => rank(level.value) <= rank(min)

  /** Mesures récentes pour le débogage : images sur 5 s, passage du fond sur 5 s. */
  const stats = (t = now()): { frame: WindowStats | null; gpu: WindowStats | null } => ({
    frame: frameJudge.stats(JUDGE_DEFAULTS.upWindowMs, t),
    gpu: gpuJudge.stats(JUDGE_DEFAULTS.upWindowMs, t),
  })

  return { level, settled, pendingUp, forced: forced !== null, atLeast, sample, reportGpuMs, reportShadowsOver, warmup, transition, stats }
})

/** API courte pour les composants : `const { level, atLeast } = useQuality()`. */
export const useQuality = () => {
  const store = useQualityStore()
  const { level, settled } = storeToRefs(store)
  return { level, settled, atLeast: store.atLeast }
}
