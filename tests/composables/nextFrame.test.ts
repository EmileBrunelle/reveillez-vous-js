import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextFrame } from '../../src/composables/nextFrame'

// useRafFn de VueUse ne démarre que si `window` existe à l’import (isClient) : l’environnement de test est node.
const frames = vi.hoisted(() => {
  const queue: FrameRequestCallback[] = []
  Object.assign(globalThis, {
    window: globalThis,
    document: { createElement: () => ({}) },
    requestAnimationFrame: (cb: FrameRequestCallback) => queue.push(cb),
    cancelAnimationFrame: () => undefined,
  })
  return queue
})
const runFrame = () => frames.splice(0).forEach((cb) => cb(performance.now()))

describe('nextFrame', () => {
  beforeEach(() => frames.splice(0))
  afterEach(() => frames.splice(0))

  it('se résout à la première image et ne reprogramme plus de rAF', async () => {
    let done = false
    const p = nextFrame().then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    runFrame()
    await p
    expect(done).toBe(true)
    runFrame() // l’éventuelle image suivante déclenchée par la boucle
    expect(frames.length).toBe(0)
  })
})
