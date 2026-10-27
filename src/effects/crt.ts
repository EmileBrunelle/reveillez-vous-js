import { effect, surface } from 'vgpu'
import crtShader from './crt.wgsl'
import { startGpuLoop, type GpuLoop } from './gpuLoop'

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
  /** Périphérique perdu : la boucle est déjà arrêtée. */
  onLost?: () => void
}

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
      const params = { time: 0, height: 0, width: 0, motion: 0, paranoia: opts.paranoia(), rippleAge: 0, rippleAmp: 0 }
      const surf = surface(gpu, canvas, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
      const fx = effect(gpu, crtShader, { set: { params } })
      return { params, surf, fx, lastKey: '' }
    },
    teardown: (s) => s.fx.dispose(),
    render: (frame, s, time) => {
      const { params } = s
      // Easing indépendant du débit (0,04 par image à 60 i/s).
      params.paranoia += (opts.paranoia() - params.paranoia) * (1 - Math.pow(0.96, Math.min(time.deltaTime, 0.1) * 60))
      const animated = opts.motion()
      // Mouvement réduit : tout terme temporel du shader est nul, rien ne change hors taille et paranoïa.
      if (!animated) {
        const key = `${canvas.width}x${canvas.height}|${params.paranoia.toFixed(3)}`
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
