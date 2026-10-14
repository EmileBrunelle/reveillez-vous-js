import { clock, effect, frameLoop, init, surface } from 'vgpu'
import crtShader from './crt.wgsl'

/**
 * Starts the WebGPU CRT overlay on `canvas`. Throws if anything fails; returns pause/stop controls.
 * `paranoia()` returns 0..1 and is read every frame (eased) to drive the shader.
 */
/** Must match PERIOD in crt.wgsl: every time-driven term repeats exactly over this many seconds. */
const PERIOD = 100

export const startCrt = async (canvas: HTMLCanvasElement, motion: boolean, paranoia: () => number): Promise<{ setPaused(paused: boolean): void; stop(): void }> => {
  const gpu = await init()
  const surf = surface(gpu, canvas, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
  let p = paranoia()
  const params = (t: number) => ({ time: t, height: canvas.height, width: canvas.width, motion: motion ? 1 : 0, paranoia: p })
  const crt = effect(gpu, crtShader, { set: { params: params(0) } })
  const time = clock(gpu)
  const run = () =>
    frameLoop(gpu, (frame) => {
      // Frame-rate independent easing (0.04 per frame at 60 fps) and time wrapped to the shader's common period.
      p += (paranoia() - p) * (1 - Math.pow(0.96, Math.min(time.deltaTime, 0.1) * 60))
      crt.set({ params: params(time.time % PERIOD) })
      frame.pass(surf, crt)
    })
  let loop: { stop(): void } | null = run()
  return {
    /** Pause/resume rendering (hidden tab). */
    setPaused(paused: boolean) {
      if (paused) {
        loop?.stop()
        loop = null
      } else loop ??= run()
    },
    stop() {
      loop?.stop()
      crt.dispose()
      gpu.dispose()
    },
  }
}
