import { effect, surface } from 'vgpu'
import { startGpuLoop, type GpuLoop } from './gpuLoop'
import crystalShader from './crystal.wgsl'
import { RING_SIZE } from './crystalMath'

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

/** Tampons réutilisés : les coups récents deviennent les champs vec4f `p0`..`p7`, la grille les champs `g0`..`g3` (4 rangées chacun). */
const makeParams = (seed: number) => {
  const params: Record<string, number | number[]> = { time: 0, motion: 0, done: 0, seed }
  for (let i = 0; i < 4; i++) params[`g${i}`] = [0, 0, 0, 0]
  for (let i = 0; i < RING_SIZE; i++) params[`p${i}`] = [0, 0, 0, 0]
  return params
}

/** Copie `src` (par paquets de 4, 0 si absent) dans les vec4 `${prefix}${i}` ; renvoie vrai si une valeur a changé. */
const copyVec4 = (params: Record<string, number | number[]>, prefix: string, count: number, src: number[]): boolean => {
  let changed = false
  for (let i = 0; i < count; i++) {
    const v = params[`${prefix}${i}`] as number[]
    for (let j = 0; j < 4; j++) {
      const n = src[i * 4 + j] ?? 0
      if (v[j] !== n) {
        v[j] = n
        changed = true
      }
    }
  }
  return changed
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
      const params = makeParams(opts.seed)
      const surf = surface(gpu, canvas, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
      const fx = effect(gpu, crystalShader, { set: { params } })
      return { params, surf, fx, drawn: false, size: '' }
    },
    teardown: (s) => s.fx.dispose(),
    render: (frame, s, time) => {
      const { params } = s
      const animated = opts.motion()
      const done = opts.done()
      const size = `${canvas.width}x${canvas.height}`
      let changed = !s.drawn || size !== s.size || done !== params.done || (animated ? 1 : 0) !== params.motion
      changed = copyVec4(params, 'p', RING_SIZE, opts.points()) || changed
      changed = copyVec4(params, 'g', 4, opts.grid()) || changed
      // En mouvement le temps change à chaque image ; sinon on saute l’image quand rien n’a bougé.
      if (!animated && !changed) return
      s.drawn = true
      s.size = size
      params.time = animated ? time.time % 600 : 0
      params.motion = animated ? 1 : 0
      params.done = done
      s.fx.set({ params })
      frame.pass(s.surf, s.fx)
    },
  })
