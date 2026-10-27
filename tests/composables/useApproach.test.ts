import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/audio/sfx', () => ({ unlock: vi.fn() }))
vi.mock('../../src/composables/useTilt', () => ({ requestOrientationPermission: vi.fn() }))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const load = async (active: boolean) => {
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive: active } })
  return (await import('../../src/composables/useApproach')).useApproach
}

describe('useApproach', () => {
  it('attend un geste ; approach() débloque l’audio, prépare, puis lève l’attente après la grâce', async () => {
    const { unlock } = await import('../../src/audio/sfx')
    const prepare = vi.fn().mockResolvedValue(undefined)
    const { awaiting, approach } = (await load(false))(prepare, 120)
    expect(awaiting.value).toBe(true)
    approach()
    expect(unlock).toHaveBeenCalled()
    expect(prepare).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(awaiting.value).toBe(true)
    await vi.advanceTimersByTimeAsync(120)
    expect(awaiting.value).toBe(false)
  })
  it('n’attend pas si un geste a déjà eu lieu', async () => {
    const { awaiting } = (await load(true))(vi.fn())
    expect(awaiting.value).toBe(false)
  })
  it('une préparation en échec ne lève pas l’attente et ne lance pas d’erreur', async () => {
    const { awaiting, approach } = (await load(false))(() => Promise.reject(new Error('chunk')), 10)
    approach()
    await vi.advanceTimersByTimeAsync(50)
    expect(awaiting.value).toBe(true)
  })
})
