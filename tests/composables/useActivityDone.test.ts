import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { AUTO_SUCCESS_MS, useActivityDone } from '../../src/composables/useActivityDone'

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
})
