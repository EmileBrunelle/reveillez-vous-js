import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

// Navigateur minimal, posé AVANT l’import de VueUse (`defaultWindow` est résolu à l’import) : un rAF à déclenchement manuel et une Animation factice.
const env = vi.hoisted(() => {
  const frames: Array<(t: number) => void> = []
  class FakeAnimation extends EventTarget {
    playState: AnimationPlayState = 'paused'
    pending = false
    replaceState = 'active'
    startTime = null
    currentTime = null
    timeline = null
    playbackRate = 1
    play = () => {
      this.playState = 'running'
    }
    pause = () => {
      this.playState = 'paused'
    }
    // Comme le navigateur : l’état change, puis l’évènement part.
    cancel = () => {
      this.playState = 'idle'
      this.dispatchEvent(new Event('cancel'))
    }
    finish = () => {
      this.playState = 'finished'
      this.dispatchEvent(new Event('finish'))
    }
  }
  class FakeElement {
    animation = new FakeAnimation()
    animate() {
      return this.animation
    }
  }
  const win = {
    HTMLElement: FakeElement,
    requestAnimationFrame: (cb: (t: number) => void) => frames.push(cb),
    cancelAnimationFrame: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    document: { createElement: () => ({}) },
  }
  Object.assign(globalThis, { window: win, document: win.document, HTMLElement: FakeElement, requestAnimationFrame: win.requestAnimationFrame })
  // Exécute les images en attente (celles que les callbacks planifient attendent l’image suivante).
  const runFrames = () => {
    const batch = frames.splice(0)
    batch.forEach((cb) => cb(performance.now()))
  }
  return { FakeElement, runFrames }
})

const { useCardShimmer } = await import('../../src/composables/useCardShimmer')

const setup = async () => {
  const el = new env.FakeElement()
  const scope = effectScope()
  const api = scope.run(() => useCardShimmer(ref(el as unknown as HTMLElement)))!
  await nextTick()
  return { el, scope, ...api }
}

describe('useCardShimmer', () => {
  beforeEach(() => env.runFrames())

  it('ne brille pas avant le premier reflet', async () => {
    const { shimmering, scope } = await setup()
    expect(shimmering.value).toBe(false)
    scope.stop()
  })

  it('brille pendant la lecture, puis retombe à la fin (will-change retiré)', async () => {
    const { el, shimmer, shimmering, scope } = await setup()
    shimmer()
    env.runFrames()
    expect(shimmering.value).toBe(true)
    el.animation.finish()
    env.runFrames()
    env.runFrames()
    expect(shimmering.value).toBe(false)
    scope.stop()
  })

  it('retombe aussi à l’annulation (will-change retiré)', async () => {
    const { el, shimmer, shimmering, scope } = await setup()
    shimmer()
    env.runFrames()
    expect(shimmering.value).toBe(true)
    el.animation.cancel()
    env.runFrames()
    env.runFrames()
    expect(shimmering.value).toBe(false)
    scope.stop()
  })
})
