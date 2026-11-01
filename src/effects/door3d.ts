import { effect, surface, timer, type Timer, type TimerSpan } from 'vgpu'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import type { QualityLevel } from '@/stores/quality'
import door3dShader from './door3d.wgsl'

export { door3dShader }

export interface Door3dOptions {
  /** Uniformes de l’image à dessiner (voir `door3dParams`) ; `dt` = secondes depuis l’image précédente, pour avancer le ressort. */
  params: (dt: number, width: number, height: number) => Record<string, number>
  /** Vrai = une image est à dessiner (changement de props, ressort en mouvement, redimensionnement). Faux : la boucle est arrêtée. */
  dirty: () => boolean
  /** Appelé après chaque image dessinée : l’appelant remet `dirty` à faux si plus rien ne bouge. */
  drawn: () => void
  /** Appelé quand la surface change de taille : l’appelant remet `dirty` à vrai. */
  resized: () => void
  /** Mesure GPU (`timer` de vgpu, `timestamp-query`) : reçoit la durée du passage en ms. Banc d’essai seulement. */
  onGpuMs?: (ms: number) => void
  onLost?: () => void
  /** Niveau de qualité posé (`useQuality().settled`) : règle la résolution interne. Absent = `high`. */
  settled?: QualityLevel
}

/** Plage de DPR de la surface selon le niveau posé (comme `placeDpr` pour les fonds) ; `low` garde la porte 3D avec un DPR de 1 (le minimum), sans ombres : le coût baisse, la porte reste. */
export const door3dDpr = (settled: QualityLevel = 'high'): [number, number] => (settled === 'high' ? [1, 1.5] : settled === 'medium' ? [1, 1.25] : [1, 1])

/**
 * Lance la porte 3D sur `canvas` (fond transparent, alpha prémultiplié, DPR plafonné par le niveau de qualité, 1,5 au plus).
 * Rendu à la demande : la boucle n’existe que tant que `dirty()` est vrai (elle passe par la pause de `startGpuLoop`, qui la coupe
 * aussi quand l’onglet est caché). Lève si l’init échoue ; renvoie `stop()`.
 */
export const createDoor3d = (canvas: HTMLCanvasElement, opts: Door3dOptions): Promise<GpuLoop> =>
  startGpuLoop({
    fps: 60,
    paused: () => !opts.dirty(),
    onLost: opts.onLost,
    timing: !!opts.onGpuMs,
    setup: (gpu) => {
      const surf = surface(gpu, canvas, { dpr: door3dDpr(opts.settled), clearColor: [0, 0, 0, 0] })
      const off = surf.onResize(() => opts.resized())
      const fx = effect(gpu, door3dShader, { set: { params: opts.params(0, canvas.width, canvas.height) } })
      let tm: Timer | null = null
      let span: TimerSpan | null = null
      let offTimer = () => {}
      if (opts.onGpuMs) {
        try {
          tm = timer(gpu)
          span = tm.span('porte')
          const cb = opts.onGpuMs
          offTimer = tm.onResults((r) => {
            if (r.porte !== undefined) cb(r.porte)
          })
        } catch {
          tm = null // pas de `timestamp-query` : pas de mesure
        }
      }
      return { surf, fx, off, tm, span, offTimer }
    },
    teardown: (s) => {
      s.off()
      s.offTimer()
      s.tm?.dispose()
      s.fx.dispose()
    },
    render: (frame, s, time) => {
      if (!opts.dirty()) return
      const w = canvas.width
      const h = canvas.height
      s.fx.set({ params: opts.params(Math.min(time.deltaTime, 0.1), w, h) })
      if (s.span) frame.pass({ target: s.surf, timer: s.span }, s.fx)
      else frame.pass(s.surf, s.fx)
      // vgpu ajuste la taille du canevas pendant le passage : si elle a changé, l’image a été calculée pour l’ancienne, on en redessine une.
      if (canvas.width === w && canvas.height === h) opts.drawn()
    },
  })
