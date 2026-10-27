import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { AUTO_SUCCESS_MS, SKIP_REVEAL_MS, useActivityDone } from '../../src/composables/useActivityDone'

describe('useActivityDone', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('réussit seule après le délai automatique, une seule fois', () => {
    const emit = vi.fn()
    const scope = effectScope()
    scope.run(() => useActivityDone(emit, { delayMs: 100 }))
    vi.advanceTimersByTime(AUTO_SUCCESS_MS + 100)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('finish manuel gagne et la minuterie automatique ne réémet pas', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    api.finish()
    api.finish()
    expect(api.isFinished()).toBe(true)
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('n’émet rien si le composant est démonté avant la fin', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    api.finish()
    scope.stop()
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).not.toHaveBeenCalled()
  })

  it('appelle onFinish une seule fois, avant done, pour une réussite manuelle ou automatique', () => {
    const order: string[] = []
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => order.push('done'), { delayMs: 100, onFinish: () => order.push('finish') }))!
    api.finish()
    api.finish()
    expect(order).toEqual(['finish'])
    vi.advanceTimersByTime(100)
    expect(order).toEqual(['finish', 'done'])
    scope.stop()
    const auto: string[] = []
    const s2 = effectScope()
    s2.run(() => useActivityDone(() => auto.push('done'), { delayMs: 100, onFinish: () => auto.push('finish') }))
    vi.advanceTimersByTime(AUTO_SUCCESS_MS)
    expect(auto).toEqual(['finish'])
    s2.stop()
  })

  it('révèle « Passer » après 12 s, avant la réussite automatique', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100 }))!
    expect(SKIP_REVEAL_MS).toBe(12_000)
    expect(SKIP_REVEAL_MS).toBeLessThan(AUTO_SUCCESS_MS)
    vi.advanceTimersByTime(SKIP_REVEAL_MS - 1)
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })

  it('« Passer » (finish) termine tout de suite, cache le bouton et n’émet qu’une fois', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    vi.advanceTimersByTime(SKIP_REVEAL_MS)
    api.finish()
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(100)
    expect(emit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('une réussite avant 12 s ne révèle jamais « Passer »', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100 }))!
    api.finish()
    vi.advanceTimersByTime(SKIP_REVEAL_MS * 2)
    expect(api.canSkip.value).toBe(false)
    scope.stop()
  })
})
