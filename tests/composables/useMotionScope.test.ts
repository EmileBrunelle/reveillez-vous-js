import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMotionScope } from '../../src/composables/useMotionScope'

// Faux `animate` : des contrôles thenable, terminés à la demande.
const fakeAnimate = () => {
  const made: { stop: ReturnType<typeof vi.fn>; finish: () => void }[] = []
  const animate = vi.fn(() => {
    let finish = () => {}
    const done = new Promise<void>((r) => (finish = r))
    const controls = { stop: vi.fn(), then: done.then.bind(done), finish }
    made.push(controls)
    return controls
  })
  return { animate, made }
}
const el = {} as Element

describe('useMotionScope', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ne garde pas les animations terminées (la liste ne grossit pas)', async () => {
    const { animate, made } = fakeAnimate()
    const scope = effectScope()
    const m = scope.run(() => useMotionScope(animate as never))!
    const all = Array.from({ length: 50 }, () => m.go(el, { x: 1 }))
    expect(m.pending()).toBe(50)
    made.forEach((c) => c.finish())
    await Promise.all(all)
    expect(m.pending()).toBe(0)
    scope.stop()
  })

  it('go sans cible ne fait rien ; snap anime en durée 0', async () => {
    const { animate } = fakeAnimate()
    const scope = effectScope()
    const m = scope.run(() => useMotionScope(animate as never))!
    await m.go(null, { x: 1 })
    expect(animate).not.toHaveBeenCalled()
    void m.snap(el, { x: 1 })
    expect(animate).toHaveBeenCalledWith(el, { x: 1 }, { duration: 0 })
    scope.stop()
  })

  it('halt arrête les animations et annule les attentes', async () => {
    const { animate, made } = fakeAnimate()
    const scope = effectScope()
    const m = scope.run(() => useMotionScope(animate as never))!
    void m.go(el, { x: 1 })
    const after = vi.fn()
    void m.wait(500).then(after)
    m.halt()
    expect(made[0].stop).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(after).not.toHaveBeenCalled()
    expect(m.pending()).toBe(0)
    scope.stop()
  })

  it('wait se résout après le délai et se retire', async () => {
    const scope = effectScope()
    const m = scope.run(() => useMotionScope(fakeAnimate().animate as never))!
    const after = vi.fn()
    void m.wait(300).then(after)
    await vi.advanceTimersByTimeAsync(300)
    expect(after).toHaveBeenCalled()
    expect(m.pending()).toBe(0)
    scope.stop()
  })

  it('arrête tout quand le scope est détruit', () => {
    const { animate, made } = fakeAnimate()
    const scope = effectScope()
    const m = scope.run(() => useMotionScope(animate as never))!
    void m.go(el, { x: 1 })
    scope.stop()
    expect(made[0].stop).toHaveBeenCalled()
  })
})
