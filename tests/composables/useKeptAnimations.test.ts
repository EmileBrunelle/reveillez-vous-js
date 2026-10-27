import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useKeptAnimations } from '../../src/composables/useKeptAnimations'

const anim = () => {
  let end!: () => void
  const done = new Promise<void>((r) => (end = r))
  return { stop: vi.fn(), complete: vi.fn(), then: done.then.bind(done), end }
}

describe('useKeptAnimations', () => {
  it('retient une animation jusqu’à sa fin, puis la lâche', async () => {
    const scope = effectScope()
    const k = scope.run(() => useKeptAnimations())!
    const a = anim()
    k.keep(a)
    expect(k.pending()).toBe(1)
    a.end()
    for (let i = 0; i < 6; i++) await Promise.resolve()
    expect(k.pending()).toBe(0)
  })

  it('finish() mène les animations à leur fin puis les arrête', () => {
    const k = effectScope().run(() => useKeptAnimations())!
    const a = anim()
    k.keep(a)
    k.finish()
    expect(a.complete).toHaveBeenCalledOnce()
    expect(a.stop).toHaveBeenCalledOnce()
    expect(k.pending()).toBe(0)
  })

  it('la destruction du scope termine les animations en cours', () => {
    const scope = effectScope()
    const k = scope.run(() => useKeptAnimations())!
    const a = anim()
    k.keep(a)
    scope.stop()
    expect(a.complete).toHaveBeenCalledOnce()
    expect(a.stop).toHaveBeenCalledOnce()
  })
})
