import { effect, surface } from 'vgpu'
import crtShader from './crt.wgsl'
import { crtStaticKey } from './frameSkip'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import type { QualityLevel } from '@/stores/quality'

/** Doit correspondre à PERIOD dans crt.wgsl : tous les termes pilotés par le temps se répètent exactement sur ce nombre de secondes. */
const PERIOD = 100

export interface CrtOptions {
  /** Faux = mouvement réduit : le shader est statique, on ne redessine que si la taille ou la paranoïa change. */
  motion: () => boolean
  /** 0..1, relu à chaque image et adouci ici. */
  paranoia: () => number
  /** Âge (s) et amplitude 0..1 du dernier coup ; l’objet renvoyé peut être réutilisé d’un appel à l’autre. */
  ripple: () => { age: number; amp: number }
  /** Vrai = CRT éteint (finale) : plus de rendu. L’onglet caché met déjà la boucle en pause. */
  paused?: () => boolean
  /** Niveau de qualité courant (voir `stores/quality.ts`) : en `low`, le grain s’éteint en douceur (uniform `lite`). Absent = `high`. */
  quality?: () => QualityLevel
  /** Niveau « posé » aux changements de scène ou de phase : en `low`, la surface passe à 1× (plus de 1,5×) ; recréée seulement à ce moment. Absent = `quality`. */
  settledQuality?: () => QualityLevel
  /** Périphérique perdu : la boucle est déjà arrêtée. */
  onLost?: () => void
}

/** Allègement visé par niveau (`lite` du shader) et durée de la glissade (s). */
export const LITE_BY_LEVEL: Record<QualityLevel, number> = { high: 0, medium: 0, low: 1 }
const LITE_TAU = 1.2
/** Plage de DPR de la surface : plafond 1,5× sauf en `low` (pixels internes divisés par ~2 sur un écran dense). */
export const crtDprRange = (level: QualityLevel): [number, number] => (level === 'low' ? [1, 1] : [1, 1.5])

/**
 * Lance la surcouche CRT WebGPU sur `canvas` (DPR plafonné à 1,5, 30 i/s). Lève si quoi que ce soit échoue ;
 * renvoie `stop()`, à appeler au démontage.
 */
export const startCrt = (canvas: HTMLCanvasElement, opts: CrtOptions): Promise<GpuLoop> =>
  startGpuLoop({
    paused: opts.paused,
    onLost: opts.onLost,
    setup: (gpu) => {
      // Objet de paramètres réutilisé à chaque image (aucune allocation par trame).
      const liteTarget = () => LITE_BY_LEVEL[opts.quality?.() ?? 'high']
      const dprLevel = () => opts.settledQuality?.() ?? opts.quality?.() ?? 'high'
      const params = { time: 0, height: 0, width: 0, motion: 0, paranoia: opts.paranoia(), rippleAge: 0, rippleAmp: 0, lite: liteTarget() }
      const range = crtDprRange(dprLevel())
      const surf = surface(gpu, canvas, { dpr: range, clearColor: [0, 0, 0, 0] })
      const fx = effect(gpu, crtShader, { set: { params } })
      return { gpu, params, surf, fx, lastKey: '', range, liteTarget, dprLevel }
    },
    teardown: (s) => s.fx.dispose(),
    render: (frame, s, time) => {
      const { params } = s
      // Easing indépendant du débit (0,04 par image à 60 i/s).
      params.paranoia += (opts.paranoia() - params.paranoia) * (1 - Math.pow(0.96, Math.min(time.deltaTime, 0.1) * 60))
      const animated = opts.motion()
      // Allègement : glisse vers la cible du niveau (image statique : directement).
      const dt = Math.min(time.deltaTime, 0.1)
      params.lite = animated ? params.lite + (s.liteTarget() - params.lite) * (1 - Math.exp(-dt / LITE_TAU)) : s.liteTarget()
      // Résolution : suit le niveau posé aux transitions seulement (recréer la surface change le motif des lignes de balayage).
      const range = crtDprRange(s.dprLevel())
      if (range[1] !== s.range[1]) {
        s.surf.dispose()
        s.surf = surface(s.gpu, canvas, { dpr: range, clearColor: [0, 0, 0, 0] })
        s.range = range
      }
      // Mouvement réduit : tout terme temporel du shader est nul, rien ne change hors taille et paranoïa.
      if (!animated) {
        const key = crtStaticKey(canvas.width, canvas.height, params.paranoia, params.lite)
        if (key === s.lastKey) return
        s.lastKey = key
      }
      const r = opts.ripple()
      params.time = time.time % PERIOD
      params.height = canvas.height
      params.width = canvas.width
      params.motion = animated ? 1 : 0
      params.rippleAge = r.age
      params.rippleAmp = r.amp
      s.fx.set({ params })
      frame.pass(s.surf, s.fx)
    },
  })
