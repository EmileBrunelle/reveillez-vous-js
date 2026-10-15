import { clock, effect, frameLoop, init, surface } from 'vgpu'
import crystalShader from './crystal.wgsl'
import { RING_SIZE } from './crystalMath'

const FPS_CAP = 30

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
  onLost?: () => void
}

/** Les coups récents deviennent les champs vec4f `p0`..`p7`, la grille les champs `g0`..`g3` (4 rangées chacun). */
const pointFields = (flat: number[], grid: number[]): Record<string, number[]> => {
  const out: Record<string, number[]> = {}
  for (let i = 0; i < 4; i++) out[`g${i}`] = [grid[i * 4] ?? 0, grid[i * 4 + 1] ?? 0, grid[i * 4 + 2] ?? 0, grid[i * 4 + 3] ?? 0]
  for (let i = 0; i < RING_SIZE; i++) out[`p${i}`] = [flat[i * 4] ?? 0, flat[i * 4 + 1] ?? 0, flat[i * 4 + 2] ?? 0, flat[i * 4 + 3] ?? 0]
  return out
}

/**
 * Lance la boule de cristal sur `canvas` (carré, DPR plafonné à 1,5). Lève si quoi que ce soit échoue ; renvoie pause/arrêt.
 * `stop` libère l’effet et le périphérique ; `onLost` est appelé si le périphérique est perdu hors arrêt volontaire.
 */
export const createCrystal = async (canvas: HTMLCanvasElement, opts: CrystalOptions): Promise<{ setPaused(paused: boolean): void; stop(): void }> => {
  const gpu = await init()
  let stopped = false
  let loop: { stop(): void } | null = null
  void gpu.lost.then(() => {
    if (stopped) return
    try {
      loop?.stop()
    } catch {
      /* périphérique déjà perdu */
    }
    loop = null
    opts.onLost?.()
  })
  const params = (t: number) => ({ time: opts.motion() ? t % 600 : 0, motion: opts.motion() ? 1 : 0, done: opts.done(), seed: opts.seed, ...pointFields(opts.points(), opts.grid()) })
  let surf: ReturnType<typeof surface>
  let fx: ReturnType<typeof effect>
  let time: ReturnType<typeof clock>
  try {
    surf = surface(gpu, canvas, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
    fx = effect(gpu, crystalShader, { set: { params: params(0) } })
    time = clock(gpu)
  } catch (e) {
    gpu.dispose()
    throw e
  }
  let lastDraw = -1
  const run = () =>
    frameLoop(gpu, (frame) => {
      if (performance.now() - lastDraw < 1000 / FPS_CAP - 4) return
      lastDraw = performance.now()
      fx.set({ params: params(time.time) })
      frame.pass(surf, fx)
    })
  loop = run()
  return {
    setPaused(paused: boolean) {
      if (paused) {
        loop?.stop()
        loop = null
      } else loop ??= run()
    },
    stop() {
      stopped = true
      // Périphérique déjà perdu ou détruit : on ne veut pas qu’un dispose lève pendant le démontage.
      try {
        loop?.stop()
      } catch {
        /* rien */
      }
      loop = null
      try {
        fx.dispose()
      } catch {
        /* rien */
      }
      try {
        gpu.dispose()
      } catch {
        /* rien */
      }
    },
  }
}
