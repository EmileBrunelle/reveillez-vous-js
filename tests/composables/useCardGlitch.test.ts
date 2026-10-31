import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCardGlitch } from '../../src/composables/useCardGlitch'

// Éléments factices : seul ce que le composable touche (animate).
const fakeEl = () => {
  const animate = vi.fn()
  return { el: { animate } as unknown as HTMLElement, animate }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const setup = async (level: number, reduced = false) => {
  const { el, animate } = fakeEl()
  const faceUp = ref(false)
  const scope = effectScope()
  scope.run(() => useCardGlitch({ targets: () => [el], content: ref(el), level: () => level, faceUp, reduced: ref(reduced) }))
  faceUp.value = true
  await nextTick()
  return { animate, scope }
}

describe('useCardGlitch', () => {
  it('niveau 3 ou mouvement réduit : aucun hoquet', async () => {
    for (const [level, reduced] of [
      [3, false],
      [5, true],
    ] as const) {
      const { animate, scope } = await setup(level, reduced)
      vi.advanceTimersByTime(30_000)
      expect(animate).not.toHaveBeenCalled()
      scope.stop()
    }
  })

  it('niveau 4 : un hoquet (2 animations) entre 2 s et 8 s après le retournement, jamais avant', async () => {
    const { animate, scope } = await setup(4)
    vi.advanceTimersByTime(1900)
    expect(animate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(6200)
    expect(animate).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60_000)
    expect(animate).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('le démontage annule le hoquet en attente', async () => {
    const { animate, scope } = await setup(4)
    scope.stop()
    vi.advanceTimersByTime(30_000)
    expect(animate).not.toHaveBeenCalled()
  })
})
