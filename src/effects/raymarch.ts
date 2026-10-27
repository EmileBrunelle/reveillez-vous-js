import { useResizeObserver } from '@vueuse/core'
import { effect, surface } from 'vgpu'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import { paramsKey } from './paramsKey'
import { placeDpr } from './resolution'

export type Shader = Parameters<typeof effect>[1]

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
}

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
  /** Pause supplémentaire ; l’onglet caché met déjà la boucle en pause. */
  paused?: () => boolean
  /** Périphérique perdu : la boucle est déjà arrêtée. */
  onLost?: () => void
}

/**
 * Lance un fond raymarché générique sur `canvas` (30 i/s). Lève si quoi que ce soit échoue ; renvoie `stop()`,
 * à appeler au démontage. `motion()` faux = mouvement réduit : une image statique (redessinée au redimensionnement
 * ou au changement de niveau seulement).
 */
export const createRaymarch = (canvas: HTMLCanvasElement, opts: RaymarchOptions): Promise<GpuLoop> => {
  const { motion, paranoia, parallax } = opts
  const params = (s: { p: number; drift: number; px: number; py: number }, t: number) => {
    const m = motion()
    return opts.params({ t, width: canvas.width, height: canvas.height, paranoia: s.p, motion: m, drift: m ? s.drift : 0, px: m ? s.px : 0, py: m ? s.py : 0 })
  }
  return startGpuLoop({
    paused: opts.paused,
    onLost: opts.onLost,
    setup: (gpu) => {
      // Taille CSS mise en cache et tenue à jour par l’observateur : aucune lecture de mise en page par trame.
      const css = { w: canvas.clientWidth, h: canvas.clientHeight }
      useResizeObserver(canvas, ([entry]) => {
        css.w = entry!.contentRect.width
        css.h = entry!.contentRect.height
      })
      const dprFor = () => placeDpr(css.w, css.h, opts.sharp?.() ?? false, window.devicePixelRatio || 1)
      const anim = { p: paranoia(), drift: 0, px: 0, py: 0 }
      const surf = surface(gpu, canvas, { dpr: dprFor(), clearColor: [0, 0, 0, 1] })
      const fx = effect(gpu, opts.shader, { set: { params: params(anim, 0) } })
      return Object.assign(anim, { gpu, lastKey: '', dprFor, surf, fx })
    },
    teardown: (s) => s.fx.dispose(),
    render: (frame, s, time) => {
      const dt = Math.min(time.deltaTime, 0.1)
      s.p += (paranoia() - s.p) * (1 - Math.pow(0.97, dt * 60))
      // CRT éteint/rallumé : la surface est recréée à la nouvelle résolution (l’écran est noir à ce moment-là, en finale).
      const want = s.dprFor()
      if (Math.abs(want - s.surf.dpr) > 1e-6) {
        s.surf.dispose()
        s.surf = surface(s.gpu, canvas, { dpr: want, clearColor: [0, 0, 0, 1] })
      }
      if (motion()) {
        const par = parallax()
        const k = 1 - Math.exp(-dt / 0.35) // constante de temps ~0,35 s, indépendante du débit
        s.px += (par.x - s.px) * k
        s.py += (par.y - s.py) * k
        s.drift += dt
      } else {
        // Image statique : la clé (construite seulement ici) inclut les paramètres de la variante, hors `time` ;
        // changer de variante sans remontage redessine.
        const key = `${canvas.width}x${canvas.height}|${s.p.toFixed(3)}|${paramsKey(params(s, 0))}`
        if (key === s.lastKey) return
        s.lastKey = key
      }
      s.fx.set({ params: params(s, time.time) })
      frame.pass(s.surf, s.fx)
    },
  })
}
