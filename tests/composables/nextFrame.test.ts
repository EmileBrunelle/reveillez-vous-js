import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextFrame, nextFrameOr } from '../../src/composables/nextFrame'

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

  it('nextFrameOr : l’image gagne, la minuterie est annulée', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) // rAF reste la file du test
    const p = nextFrameOr(120)
    runFrame()
    await p
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('nextFrameOr : le délai gagne si rAF est suspendu, la boucle est arrêtée', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) // rAF reste la file du test
    const p = nextFrameOr(120)
    await vi.advanceTimersByTimeAsync(121)
    await p
    expect(vi.getTimerCount()).toBe(0)
    expect(() => runFrame()).not.toThrow() // une image tardive ne fait rien
    vi.useRealTimers()
  })
})
