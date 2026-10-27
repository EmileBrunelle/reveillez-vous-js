import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { runLater } from '../../src/audio/runLater'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('runLater', () => {
  it('exécute la fonction une seule fois, après le délai', () => {
    const fn = vi.fn()
    runLater(fn, 300)
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('survit à l’arrêt de la portée appelante (libération après un fondu de sortie)', () => {
    const fn = vi.fn()
    const caller = effectScope()
    caller.run(() => runLater(fn, 100))
    caller.stop()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
