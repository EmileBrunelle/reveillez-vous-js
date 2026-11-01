import { useResizeObserver } from '@vueuse/core'
import { effect, surface, timer, type Gpu, type ShaderSource, type Timer, type TimerSpan } from 'vgpu'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import { raymarchStaticKey } from './frameSkip'
import { paramsKey } from './paramsKey'
import { placeDpr } from './resolution'
import type { QualityLevel } from '@/stores/quality'
import { createShadowBudget, cutShadowsForSession, SHADOW_BUDGET_MS, SHADOW_FALLBACK_FRAME_MS, shadowsCutForSession } from './shadowQuality'

export type Shader = ShaderSource

/** État fourni à `params` à chaque image ; `drift`, `px`, `py` valent 0 en mouvement réduit. */
export interface RaymarchState {
  /** Secondes. */
  t: number
  width: number
  height: number
  /** 0..1, déjà adouci. */
  paranoia: number
  /** Faux = mouvement réduit : une seule image statique. */
  motion: boolean
  /** Horloge de dérive (brouillard). */
  drift: number
  /** Parallaxe -1..1, déjà lissée. */
  px: number
  py: number
  /** 0..1 : densité des particules selon la qualité (1 en `high`), déjà adoucie ; absent = 1. */
  detail?: number
}

/** Densité des particules par niveau ; l’état `detail` glisse vers cette cible (voir `render`). */
export const DETAIL_BY_LEVEL: Record<QualityLevel, number> = { high: 1, medium: 0.7, low: 0.4 }
/** Constante de temps (s) de la glissade de `detail` : un changement de niveau s’étale sur ~3 s, sans saut visible. */
const DETAIL_TAU = 1

export interface RaymarchOptions {
  shader: Shader
  /** Valeurs de l’uniforme `Params` du shader (noms = champs de la struct). */
  params: (s: RaymarchState) => Record<string, number>
  motion: () => boolean
  /** Vrai = CRT éteint (finale) : résolution relevée (voir `placeDpr`) ; sinon rendu basse résolution voulu sous CRT. */
  sharp?: () => boolean
  /** 0..1 ; adouci ici. */
  paranoia: () => number
  /** Décalage cible de la caméra dans [-1, 1]² ; lissé ici (lerp), ignoré en mouvement réduit. */
  parallax: () => { x: number; y: number }
  /**
   * Règle fixe des ombres lancées (voir `shadowQuality`) : faux = coupées (tactile, écran étroit). Absent = coupées, sans mesure.
   * Vrai = actives tant que le coût mesuré tient dans le budget ; sinon elles se coupent pour de bon. Écrit dans l’uniforme `shadows` (0 ou 1).
   */
  shadows?: () => boolean
  /** Niveau de qualité courant (voir `stores/quality.ts`) : réduit le DPR et la densité des particules. Absent = `high`. */
  quality?: () => QualityLevel
  /** Reçoit la durée GPU (ms) du passage du fond quand `timestamp-query` existe (réutilise le timer des ombres). */
  onGpuSample?: (ms: number) => void
  /** Appelé une fois quand le budget propre des ombres est dépassé (le gouverneur en tire une descente). */
  onShadowsOver?: () => void
  /** Pause supplémentaire ; l’onglet caché met déjà la boucle en pause. */
  paused?: () => boolean
  /** Périphérique perdu : la boucle est déjà arrêtée. */
  onLost?: () => void
}

/** Cadence de la boucle en mouvement réduit : juste de quoi repérer un redimensionnement ou un changement de niveau. */
const STATIC_FPS = 4

/**
 * Mesure du coût des ombres : durée GPU du passage (`timer`, `timestamp-query`) ou, à défaut, intervalle entre les images.
 * `span` est le repère à passer au passage ; `sample` reçoit l’intervalle de l’image (utile au repli seulement).
 */
const watchShadowCost = (gpu: Gpu, active: () => boolean, motion: () => boolean, onGpu?: (ms: number) => void) => {
  const bg = createShadowBudget(SHADOW_BUDGET_MS)
  const fallback = createShadowBudget(SHADOW_FALLBACK_FRAME_MS)
  let tm: Timer | null = null
  let span: TimerSpan | null = null
  let off = () => {}
  try {
    tm = timer(gpu)
    span = tm.span('fond')
    off = tm.onResults((r) => {
      if (r.fond !== undefined) onGpu?.(r.fond) // le gouverneur juge le fond avec ou sans ombres
      if (active()) bg.push(r.fond ?? NaN) // ombres éteintes (fenêtre étroite) : la mesure ne compte pas pour leur budget
    })
  } catch {
    tm = null // pas de `timestamp-query` : on juge l’intervalle entre images
  }
  return {
    // `over` doit refléter la mesure utilisée : GPU si on l’a, intervalle sinon.
    budget: {
      push: (ms: number) => (tm ? bg : fallback).push(ms),
      get over() {
        return (tm ? bg : fallback).over
      },
      reset: () => {
        bg.reset()
        fallback.reset()
      },
    },
    span,
    sample: (dt: number) => {
      // En mouvement réduit la boucle tourne à ~4 i/s : l’intervalle (~250 ms) ne mesure pas le coût des ombres.
      // On n’échantillonne donc le repli qu’en mouvement (plutôt que d’abaisser SHADOW_MAX_SAMPLE_MS, qui rejetterait
      // aussi de vraies images lentes à 30 i/s et masquerait un GPU trop lent). L’image statique n’est de toute façon
      // redessinée que sur changement, jamais en continu.
      if (!tm && active() && motion()) fallback.push(dt * 1000)
    },
    dispose: () => {
      off()
      tm?.dispose()
    },
  }
}

/**
 * Lance un fond raymarché générique sur `canvas`. Lève si quoi que ce soit échoue ; renvoie `stop()`, à appeler au démontage.
 * Animé : 30 i/s. `motion()` faux = mouvement réduit : la boucle tourne à `STATIC_FPS` et ne redessine que si la clé de
 * l’image statique change (taille, paranoïa, paramètres de la variante) ; sinon elle ne fait que recalculer cette clé.
 */
export const createRaymarch = (canvas: HTMLCanvasElement, opts: RaymarchOptions): Promise<GpuLoop> => {
  const { motion, paranoia, parallax } = opts
  // Budget mesuré, créé par `setup` seulement si les ombres sont permises ; une fois dépassé, les ombres restent coupées.
  let budget: ReturnType<typeof createShadowBudget> | null = null
  let budgetCut = false
  // Verdict mémorisé : un GPU trop lent ne repaie pas la fenêtre de mesure à chaque lieu ou visite. Il tient jusqu’à ce que le
  // gouverneur de qualité remonte à `high` et le remette à zéro : le budget repart alors d’une fenêtre vide et rejuge les ombres.
  const shadowsOn = () => {
    if (budget?.over) {
      if (!budgetCut) {
        budgetCut = true
        cutShadowsForSession()
        opts.onShadowsOver?.()
      } else if (!shadowsCutForSession()) {
        budget.reset()
        budgetCut = false
      }
    }
    return !!opts.shadows?.() && !shadowsCutForSession()
  }
  const detailTarget = () => DETAIL_BY_LEVEL[opts.quality?.() ?? 'high']
  const params = (s: { p: number; drift: number; px: number; py: number; detail: number }, t: number) => {
    const m = motion()
    const base = opts.params({ t, width: canvas.width, height: canvas.height, paranoia: s.p, motion: m, drift: m ? s.drift : 0, px: m ? s.px : 0, py: m ? s.py : 0, detail: s.detail })
    // Le champ n’existe que si la règle des ombres est fournie : sans elle, les paramètres restent ceux du lieu.
    return opts.shadows ? { ...base, shadows: shadowsOn() ? 1 : 0 } : base
  }
  return startGpuLoop({
    paused: opts.paused,
    // Mouvement réduit : cadence basse, la boucle ne fait que comparer la clé de l’image statique.
    fps: () => (motion() ? 30 : STATIC_FPS),
    onLost: opts.onLost,
    // La règle peut passer au vrai plus tard (fenêtre élargie) : le timer et le budget existent dès qu’elle est fournie.
    timing: !!opts.shadows,
    setup: (gpu) => {
      // Taille CSS mise en cache et tenue à jour par l’observateur : aucune lecture de mise en page par trame.
      const css = { w: canvas.clientWidth, h: canvas.clientHeight }
      useResizeObserver(canvas, ([entry]) => {
        css.w = entry!.contentRect.width
        css.h = entry!.contentRect.height
      })
      const dprFor = () => placeDpr(css.w, css.h, opts.sharp?.() ?? false, window.devicePixelRatio || 1, opts.quality?.() ?? 'high')
      const anim = { p: paranoia(), drift: 0, px: 0, py: 0, detail: detailTarget() }
      const surf = surface(gpu, canvas, { dpr: dprFor(), clearColor: [0, 0, 0, 1] })
      const fx = effect(gpu, opts.shader, { set: { params: params(anim, 0) } })
      const cost = opts.shadows ? watchShadowCost(gpu, shadowsOn, motion, opts.onGpuSample) : null
      budget = cost?.budget ?? null
      return { anim, gpu, dprFor, surf, fx, lastKey: '', cost }
    },
    teardown: (s) => {
      s.cost?.dispose()
      s.fx.dispose()
    },
    render: (frame, s, time) => {
      const a = s.anim
      const dt = Math.min(time.deltaTime, 0.1)
      a.p += (paranoia() - a.p) * (1 - Math.pow(0.97, dt * 60))
      // Densité des particules : glisse vers la cible du niveau (rien ne saute) ; image statique : directement à la cible.
      a.detail = motion() ? a.detail + (detailTarget() - a.detail) * (1 - Math.exp(-dt / DETAIL_TAU)) : detailTarget()
      // CRT éteint/rallumé : la surface est recréée à la nouvelle résolution (l’écran est noir à ce moment-là, en finale).
      const want = s.dprFor()
      if (Math.abs(want - s.surf.dpr) > 1e-6) {
        s.surf.dispose()
        s.surf = surface(s.gpu, canvas, { dpr: want, clearColor: [0, 0, 0, 1] })
      }
      if (motion()) {
        const par = parallax()
        const k = 1 - Math.exp(-dt / 0.35) // constante de temps ~0,35 s, indépendante du débit
        a.px += (par.x - a.px) * k
        a.py += (par.y - a.py) * k
        a.drift += dt
      } else {
        // Image statique : la clé (construite seulement ici) inclut les paramètres de la variante, hors `time` ;
        // on ne redessine que si elle diffère de la dernière image dessinée.
        const key = raymarchStaticKey(canvas.width, canvas.height, a.p, paramsKey(params(a, 0)), shadowsOn())
        if (key === s.lastKey) return
        s.lastKey = key
      }
      if (shadowsOn()) s.cost?.sample(time.deltaTime)
      s.fx.set({ params: params(a, time.time) })
      if (s.cost?.span) frame.pass({ target: s.surf, timer: s.cost.span }, s.fx)
      else frame.pass(s.surf, s.fx)
    },
  })
}
