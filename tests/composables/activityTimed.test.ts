import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useActivityDone } from '../../src/composables/useActivityDone'
import { ACTIVITY_GRACE_MS } from '../../src/engine/activityTiming'

const G = ACTIVITY_GRACE_MS

describe('useActivityDone chronométrée (durationMs)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('la fin du temps est un échec, suivi de la suite après ~1 s', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { durationMs: 8000 }))!
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(G + 7999)
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
    vi.advanceTimersByTime(G + 5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('la grâce retarde l’échec : la minuterie ne coule qu’après le verbe du HUD', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    vi.advanceTimersByTime(5000)
    expect(api.outcome.value).toBe('play')
    expect(api.elapsed()).toBe(4000)
    vi.advanceTimersByTime(G)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('le temps écoulé reste à 0 pendant la grâce', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    vi.advanceTimersByTime(G - 1)
    expect(api.elapsed()).toBe(0)
    scope.stop()
  })

  it('pause/reprise conserve le temps restant', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    vi.advanceTimersByTime(G + 2000)
    api.pause('test')
    expect(api.paused.value).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(api.outcome.value).toBe('play')
    expect(api.elapsed()).toBe(2000)
    api.resume('test')
    expect(api.paused.value).toBe(false)
    vi.advanceTimersByTime(2999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('plusieurs raisons de pause : la minuterie ne reprend qu’une fois toutes levées', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    api.pause('a')
    api.pause('b')
    api.resume('a')
    expect(api.paused.value).toBe(true)
    vi.advanceTimersByTime(G + 10_000)
    expect(api.outcome.value).toBe('play')
    api.resume('b')
    vi.advanceTimersByTime(G + 5000)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('pause posée avant le départ (démonstration de Windows) : aucune seconde perdue', () => {
    const scope = effectScope()
    const api = scope.run(() => {
      const a = useActivityDone(() => undefined, { durationMs: 5000 })
      a.pause('démonstration')
      return a
    })!
    vi.advanceTimersByTime(3850)
    expect(api.outcome.value).toBe('play')
    expect(api.elapsed()).toBe(0)
    api.resume('démonstration')
    vi.advanceTimersByTime(G + 4999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('elapsed reste juste après la fin', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    vi.advanceTimersByTime(G + 5000)
    vi.advanceTimersByTime(10_000)
    expect(api.elapsed()).toBe(5000)
    scope.stop()
  })

  it('graceLeft donne la grâce restante, 0 une fois écoulée', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => undefined, { durationMs: 5000 }))!
    vi.advanceTimersByTime(300)
    api.pause('t')
    vi.advanceTimersByTime(5000)
    expect(api.graceLeft()).toBe(G - 300)
    api.resume('t')
    vi.advanceTimersByTime(G)
    expect(api.graceLeft()).toBe(0)
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
