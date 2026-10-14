import { paramsKey } from './paramsKey'
import { clock, effect, frameLoop, init, surface } from 'vgpu'

/** Internal resolution: ~0.5x CSS px, long side capped (mobile budget); the canvas is upscaled by CSS (linear). */
const MAX_LONG = 540
const FPS_CAP = 30

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
  /** 0..1 ; adouci ici. */
  paranoia: () => number
  /** Décalage cible de la caméra dans [-1, 1]² ; lissé ici (lerp), ignoré en mouvement réduit. */
  parallax: () => { x: number; y: number }
  onLost?: () => void
}

/**
 * Lance un fond raymarché générique sur `canvas`. Lève si quoi que ce soit échoue ; renvoie les contrôles.
 * `motion()` faux = mouvement réduit : une image statique (redessinée au redimensionnement ou au changement de niveau seulement).
 */
export const createRaymarch = async (canvas: HTMLCanvasElement, opts: RaymarchOptions): Promise<{ setPaused(paused: boolean): void; stop(): void }> => {
  const { motion, paranoia, parallax } = opts
  const gpu = await init()
  let stopped = false
  void gpu.lost.then(() => {
    if (!stopped) opts.onLost?.()
  })
  const dprFor = () => Math.min(0.5, MAX_LONG / Math.max(canvas.clientWidth, canvas.clientHeight, 1))
  let p = paranoia()
  let drift = 0
  let px = 0
  let py = 0
  const params = (t: number) => {
    const m = motion()
    return opts.params({ t, width: canvas.width, height: canvas.height, paranoia: p, motion: m, drift: m ? drift : 0, px: m ? px : 0, py: m ? py : 0 })
  }
  // Si la création de la surface ou de l’effet échoue, on libère le périphérique avant de relancer l’erreur.
  let surf: ReturnType<typeof surface>
  let fx: ReturnType<typeof effect>
  let time: ReturnType<typeof clock>
  try {
    surf = surface(gpu, canvas, { dpr: dprFor(), clearColor: [0, 0, 0, 1] })
    fx = effect(gpu, opts.shader, { set: { params: params(0) } })
    time = clock(gpu)
  } catch (e) {
    gpu.dispose()
    throw e
  }
  let lastDraw = -1
  let lastKey = ''
  const run = () =>
    frameLoop(gpu, (frame) => {
      const dt = Math.min(time.deltaTime, 0.1)
      p += (paranoia() - p) * (1 - Math.pow(0.97, dt * 60))
      const animated = motion()
      // En image statique, la clé inclut les paramètres de la variante (hors `time`) : changer de variante sans remontage redessine.
      const key = `${canvas.width}x${canvas.height}|${p.toFixed(3)}|${animated}` + (animated ? '' : `|${paramsKey(params(0))}`)
      if (animated) {
        const par = parallax()
        const k = 1 - Math.exp(-dt / 0.35) // ~0.35 s time constant, frame-rate independent
        px += (par.x - px) * k
        py += (par.y - py) * k
        drift += dt
        // Frame skipping: cap at FPS_CAP.
        if (performance.now() - lastDraw < 1000 / FPS_CAP - 4) return
      } else if (key === lastKey) return // static frame: redraw only on resize / level change
      lastDraw = performance.now()
      lastKey = key
      fx.set({ params: params(time.time) })
      frame.pass(surf, fx)
    })
  let loop: { stop(): void } | null = run()
  return {
    setPaused(paused: boolean) {
      if (paused) {
        loop?.stop()
        loop = null
      } else loop ??= run()
    },
    stop() {
      stopped = true
      loop?.stop()
      fx.dispose()
      gpu.dispose()
    },
  }
}
