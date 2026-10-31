import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isRef } from 'vue'

const m = vi.hoisted(() => ({
  loadDoorScene: vi.fn<() => Promise<{ default: object }>>(),
  loadDeckCut: vi.fn(() => Promise.resolve({})),
  loadTarotCard: vi.fn(() => Promise.resolve({})),
  loadFinale: vi.fn(() => Promise.resolve({})),
  prefetch: vi.fn(),
  lazyScene: vi.fn((loader: unknown, skip?: unknown) => ({ loader, skip })),
}))
vi.mock('@/lazy', () => ({
  loadAbout: () => Promise.resolve({}),
  loadCollection: () => Promise.resolve({}),
  loadReset: () => Promise.resolve({}),
  loadSound: () => Promise.resolve({}),
  loadDeckCut: m.loadDeckCut,
  loadFinale: m.loadFinale,
  loadTarotCard: m.loadTarotCard,
  loadDoorScene: m.loadDoorScene,
  prefetch: m.prefetch,
}))
vi.mock('@/composables/lazyScene', () => ({ lazyScene: m.lazyScene }))
import { useLazyScenes } from '@/composables/useLazyScenes'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLazyScenes', () => {
  it('la coupe et la finale passent par lazyScene avec leur repli respectif', () => {
    const deck = vi.fn()
    const finale = vi.fn()
    const s = useLazyScenes({ deck, finale })
    expect(m.lazyScene).toHaveBeenCalledWith(m.loadDeckCut, deck)
    expect(m.lazyScene).toHaveBeenCalledWith(m.loadFinale, finale)
    expect(s.DeckCut).toEqual({ loader: m.loadDeckCut, skip: deck })
    expect(s.Finale).toEqual({ loader: m.loadFinale, skip: finale })
  })

  it('sans replis : les scènes sont créées sans rappel de saut', () => {
    useLazyScenes()
    expect(m.lazyScene).toHaveBeenCalledWith(m.loadDeckCut, undefined)
    expect(m.lazyScene).toHaveBeenCalledWith(m.loadFinale, undefined)
  })

  it('les composants asynchrones des fenêtres et de la carte ne chargent rien avant leur premier rendu', () => {
    useLazyScenes()
    expect(m.loadTarotCard).not.toHaveBeenCalled()
    expect(m.loadDoorScene).not.toHaveBeenCalled()
  })

  it('la porte n’est pas chargée au départ ; ensureDoor la charge, la rend non réactive et préchauffe la coupe et la carte', async () => {
    const door = { name: 'Porte' }
    m.loadDoorScene.mockResolvedValue({ default: door })
    const s = useLazyScenes()
    expect(isRef(s.DoorScene)).toBe(true)
    expect(s.DoorScene.value).toBeNull()
    await s.ensureDoor()
    expect(s.DoorScene.value).toBe(door)
    expect(isReactive(s.DoorScene.value)).toBe(false)
    expect(m.prefetch).toHaveBeenCalledWith(m.loadDeckCut, m.loadTarotCard)
  })

  it('ensureDoor ne charge qu’une fois, même appelé deux fois en parallèle', async () => {
    m.loadDoorScene.mockResolvedValue({ default: {} })
    const s = useLazyScenes()
    const [a, b] = [s.ensureDoor(), s.ensureDoor()]
    expect(a).toBe(b)
    await a
    await s.ensureDoor()
    expect(m.loadDoorScene).toHaveBeenCalledTimes(1)
  })

  it('réseau coupé : l’erreur remonte, rien n’est mis en cache et le clic suivant réessaie', async () => {
    m.loadDoorScene.mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce({ default: { ok: true } })
    const s = useLazyScenes()
    await expect(s.ensureDoor()).rejects.toThrow('réseau')
    expect(s.DoorScene.value).toBeNull()
    expect(m.prefetch).not.toHaveBeenCalled()
    await s.ensureDoor()
    expect(m.loadDoorScene).toHaveBeenCalledTimes(2)
    expect(s.DoorScene.value).toEqual({ ok: true })
  })
})
