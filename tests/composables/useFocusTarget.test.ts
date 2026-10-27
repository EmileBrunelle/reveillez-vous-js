import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

class FakeEl {
  children = new Set<unknown>()
  focus = vi.fn()
  contains(o: unknown) {
    return o === this || this.children.has(o)
  }
}
// Un composant qui expose focus() (porte, DeckCut, Finale) n’est pas un HTMLElement.
const exposing = () => ({ focus: vi.fn() })

let active: unknown
const body = {}
beforeEach(() => {
  vi.stubGlobal('HTMLElement', FakeEl)
  vi.stubGlobal('Element', FakeEl)
  vi.stubGlobal('document', {
    body,
    get activeElement() {
      return active
    },
  })
  active = body
})
afterEach(() => vi.unstubAllGlobals())

type T = 'door' | 'close' | 'deck'
const setup = async () => {
  const { useFocusTarget } = await import('../../src/composables/useFocusTarget')
  const target = ref<T | null>(null)
  const door = shallowRef<{ focus: () => void } | null>(null)
  const deck = shallowRef<{ focus: () => void } | null>(null)
  const close = shallowRef<FakeEl | null>(null)
  const reading = shallowRef<FakeEl | null>(null)
  const area = shallowRef<FakeEl | null>(new FakeEl())
  effectScope().run(() =>
    useFocusTarget<T>({
      target,
      refs: { door, deck, close } as never,
      area: area as never,
      guarded: { target: 'close', from: reading as never },
    }),
  )
  return { target, door, deck, close, reading, area }
}

describe('useFocusTarget', () => {
  it('appelle focus() du composant quand sa ref devient non nulle, puis vide la cible', async () => {
    const { target, door } = await setup()
    target.value = 'door'
    await nextTick()
    expect(target.value).toBe('door') // pas encore monté : on attend
    const scene = exposing()
    door.value = scene
    await nextTick()
    expect(scene.focus).toHaveBeenCalledTimes(1)
    expect(target.value).toBeNull()
  })
  it('focalise un élément simple sans défiler (focusQuietly)', async () => {
    const { target, close, reading } = await setup()
    const el = new FakeEl()
    reading.value = new FakeEl()
    active = reading.value
    target.value = 'close'
    close.value = el
    await nextTick()
    expect(el.focus).toHaveBeenCalledTimes(1)
    expect(el.focus.mock.calls[0]![0]).toMatchObject({ preventScroll: true })
  })
  it('ne vole pas le focus posé ailleurs (hors de la zone principale)', async () => {
    const { target, door } = await setup()
    active = new FakeEl() // barre des tâches
    const scene = exposing()
    door.value = scene
    target.value = 'door'
    await nextTick()
    expect(scene.focus).not.toHaveBeenCalled()
    expect(target.value).toBeNull()
  })
  it('permet le déplacement depuis l’écran précédent, dans la zone principale', async () => {
    const { target, door, area } = await setup()
    const prev = new FakeEl()
    area.value!.children.add(prev)
    active = prev
    const scene = exposing()
    door.value = scene
    target.value = 'door'
    await nextTick()
    expect(scene.focus).toHaveBeenCalledTimes(1)
  })
  it('« close » ne déloge que le focus de la section de lecture elle-même', async () => {
    const { target, close, reading, area } = await setup()
    const inCard = new FakeEl()
    area.value!.children.add(inCard)
    reading.value = new FakeEl()
    active = inCard // lecteur d’écran dans la carte
    const el = new FakeEl()
    close.value = el
    target.value = 'close'
    await nextTick()
    expect(el.focus).not.toHaveBeenCalled()
    active = reading.value
    target.value = 'close'
    close.value = new FakeEl()
    await nextTick()
    expect((close.value as FakeEl).focus).toHaveBeenCalledTimes(1)
  })
  it('une scène paresseuse dont focus() est différé reste servie : la cible attend la ref', async () => {
    const { target, deck } = await setup()
    target.value = 'deck'
    await nextTick()
    const lazy = exposing()
    deck.value = lazy
    await nextTick()
    expect(lazy.focus).toHaveBeenCalledTimes(1)
  })
})
