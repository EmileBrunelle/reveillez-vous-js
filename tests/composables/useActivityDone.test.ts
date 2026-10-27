import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

// `useIdle` de VueUse écoute `window` et ne démarre que si `window` et `document` existent à l’import : l’environnement de test est node.
// Un EventTarget fait office de `window` (les événements s’y envoient directement).
const win = vi.hoisted(() => {
  const target = new EventTarget()
  Object.assign(target, { document: { hidden: false, createElement: () => ({}) } })
  Object.assign(globalThis, { window: target, document: (target as unknown as { document: object }).document })
  return target
})
import { AUTO_SUCCESS_MS, POKE_THROTTLE_MS, SKIP_REVEAL_MS, useActivityDone } from '../../src/composables/useActivityDone'

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

  it('qui joue ne voit pas « Passer » : chaque interaction repousse son apparition', () => {
    const scope = effectScope()
    // Réussite automatique repoussée : on simule plus de 20 s de jeu.
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100, autoMs: 60_000 }))!
    for (let t = 0; t < 3; t++) {
      vi.advanceTimersByTime(SKIP_REVEAL_MS - 1000)
      win.dispatchEvent(new Event(['pointerdown', 'keydown', 'pointermove'][t]))
    }
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(SKIP_REVEAL_MS)
    expect(api.canSkip.value).toBe(true)
    // Affiché, il reste malgré une nouvelle interaction.
    win.dispatchEvent(new Event('pointerdown'))
    expect(api.canSkip.value).toBe(true)
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

  it('une rafale de pointermove repousse « Passer » sans l’avancer : jamais avant 12 s, au plus 250 ms après', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100, autoMs: 120_000 }))!
    // 5 s de pointermove à 60 Hz.
    for (let i = 0; i < 300; i++) {
      win.dispatchEvent(new Event('pointermove'))
      vi.advanceTimersByTime(16)
    }
    expect(api.canSkip.value).toBe(false)
    // Le dernier événement date d’environ 16 ms : la minuterie (réarmée au plus POKE_THROTTLE_MS après lui) n’échoit jamais avant SKIP_REVEAL_MS.
    vi.advanceTimersByTime(SKIP_REVEAL_MS - 100)
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(100 + POKE_THROTTLE_MS)
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })
})
