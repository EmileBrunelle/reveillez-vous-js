import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useActivityDone } from '../../src/composables/useActivityDone'

describe('useActivityDone chronométrée (durationMs)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('la fin du temps est un échec, suivi de la suite après ~1 s', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { durationMs: 8000 }))!
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(7999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    vi.advanceTimersByTime(999)
    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('une réussite avant la fin du temps gagne, et l’expiration ne réémet pas', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { durationMs: 8000 }))!
    vi.advanceTimersByTime(3000)
    api.finish()
    expect(api.outcome.value).toBe('win')
    vi.advanceTimersByTime(20_000)
    expect(api.outcome.value).toBe('win')
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('onFinish s’exécute aussi à l’échec (rien ne reste en suspens)', () => {
    const onFinish = vi.fn()
    const scope = effectScope()
    scope.run(() => useActivityDone(() => undefined, { durationMs: 5000, onFinish }))
    vi.advanceTimersByTime(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('sans durationMs, le comportement historique demeure : réussite automatique à 20 s', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined))!
    vi.advanceTimersByTime(20_000)
    expect(api.outcome.value).toBe('win')
    scope.stop()
  })
})
