import { clock, effect, frameLoop, init, surface } from 'vgpu'
import porchShader from './porch.wgsl'

/** Internal resolution: ~0.5x CSS px, long side capped (mobile budget); the canvas is upscaled by CSS (linear). */
const MAX_LONG = 540
const FPS_CAP = 30

/**
 * Starts the raymarched porch background on `canvas`. Throws if anything fails; returns controls.
 * `motion()` false = reduced motion: one static frame (re-rendered on resize/level change only).
 * `paranoia()` returns 0..1 and is eased here. `parallax()` returns the target camera offset in [-1, 1]²; smoothed here (lerp), ignored when `motion()` is false.
 */
export const startPorch = async (canvas: HTMLCanvasElement, motion: () => boolean, paranoia: () => number, parallax: () => { x: number; y: number }, onLost?: () => void): Promise<{ setPaused(paused: boolean): void; stop(): void }> => {
  const gpu = await init()
  let stopped = false
  void gpu.lost.then(() => {
    if (!stopped) onLost?.()
  })
  const dprFor = () => Math.min(0.5, MAX_LONG / Math.max(canvas.clientWidth, canvas.clientHeight, 1))
  const surf = surface(gpu, canvas, { dpr: dprFor(), clearColor: [0, 0, 0, 1] })
  let p = paranoia()
  let drift = 0
  let px = 0
  let py = 0
  const params = (t: number) => {
    const m = motion()
    const k = 1 + 1.2 * p // uneasy: amplitude grows ...
    const speed = 0.13 / (1 + 0.8 * p) // ... while the rhythm slows
    return {
      time: t,
      width: canvas.width,
      height: canvas.height,
      paranoia: p,
      sway: m ? 0.02 * k * Math.sin(t * speed) + 0.008 * k * Math.sin(t * speed * 2.3 + 1) : 0,
      swayY: m ? 0.008 * k * Math.sin(t * speed * 1.4 + 2) : 0,
      drift: m ? drift : 0,
      wolf: Math.min(1, Math.max(0, (p - 0.62) / 0.16)),
      px: m ? px : 0,
      py: m ? py : 0,
    }
  }
  const fx = effect(gpu, porchShader, { set: { params: params(0) } })
  const time = clock(gpu)
  let lastDraw = -1
  let lastKey = ''
  const run = () =>
    frameLoop(gpu, (frame) => {
      const dt = Math.min(time.deltaTime, 0.1)
      p += (paranoia() - p) * (1 - Math.pow(0.97, dt * 60))
      const animated = motion()
      const key = `${canvas.width}x${canvas.height}|${p.toFixed(3)}|${animated}`
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
