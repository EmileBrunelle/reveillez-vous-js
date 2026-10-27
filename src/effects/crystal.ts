import { effect, surface } from 'vgpu'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import crystalShader from './crystal.wgsl'
import { RING_SIZE } from './crystalMath'
import { copyVec4, crystalScalarsChanged, makeVec4Fields } from './frameSkip'

export interface CrystalOptions {
  /** Faux = mouvement réduit : pas de tourbillon, la brume ne revient pas. */
  motion: () => boolean
  /** [x, y, âge, poids] × RING_SIZE, relu à chaque image. */
  points: () => number[]
  /** Grille de couverture emballée (16 rangées de 16 bits) : source unique de la brume dissipée. */
  grid: () => number[]
  /** 0..1 : dissipation finale. */
  done: () => number
  seed: number
  /** Pause supplémentaire ; l’onglet caché met déjà la boucle en pause. */
  paused?: () => boolean
  onLost?: () => void
}

/**
 * Lance la boule de cristal sur `canvas` (carré, DPR plafonné à 1,5, 30 i/s). Lève si quoi que ce soit échoue ;
 * renvoie `stop()`, qui libère l’effet et le périphérique. `onLost` est appelé si le périphérique est perdu hors arrêt volontaire.
 * Mouvement réduit : on ne redessine que si les coups, la grille, la dissipation ou la taille changent.
 */
export const createCrystal = (canvas: HTMLCanvasElement, opts: CrystalOptions): Promise<GpuLoop> =>
  startGpuLoop({
    paused: opts.paused,
    onLost: opts.onLost,
    setup: (gpu) => {
      // Tampons réutilisés : coups récents = vec4f `p0`..`p7`, grille = vec4f `g0`..`g3` (4 rangées chacun).
      const params = makeVec4Fields({ time: 0, motion: 0, done: 0, seed: opts.seed }, RING_SIZE, 4)
      const surf = surface(gpu, canvas, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
      const fx = effect(gpu, crystalShader, { set: { params } })
      return { params, surf, fx, drawn: false, size: '', done: 0, motion: 0 }
    },
    teardown: (s) => s.fx.dispose(),
    render: (frame, s, time) => {
      const { params } = s
      const animated = opts.motion()
      const done = opts.done()
      const size = `${canvas.width}x${canvas.height}`
      let changed = crystalScalarsChanged(s, size, done, animated)
      changed = copyVec4(params, 'p', RING_SIZE, opts.points()) || changed
      changed = copyVec4(params, 'g', 4, opts.grid()) || changed
      // En mouvement le temps change à chaque image ; sinon on saute l’image quand rien n’a bougé.
      if (!animated && !changed) return
      s.drawn = true
      s.size = size
      s.done = done
      s.motion = animated ? 1 : 0
      params.time = animated ? time.time % 600 : 0
      params.motion = animated ? 1 : 0
      params.done = done
      s.fx.set({ params })
      frame.pass(s.surf, s.fx)
    },
  })
