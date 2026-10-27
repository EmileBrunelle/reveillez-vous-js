// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import DeckCut from '../../src/components/DeckCut.vue'
import { shufflePaquets } from '../../src/engine/paquets'
import { mulberry32 } from '../../src/engine/rng'

let wrapper: VueWrapper | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const monter = () => {
  wrapper = mount(DeckCut, { props: { level: 1, rng: mulberry32(7) }, attachTo: document.body })
  return wrapper
}
const toucher = (cible: Element, type: string, clientX: number, pointerId = 1) =>
  cible.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId, isPrimary: true, clientX, clientY: 0, bubbles: true, cancelable: true }))

describe('DeckCut : toucher', () => {
  it('un tap sans mouvement choisit tout de suite, une seule fois', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100) // garde `ready` (1000 ms)
    const carte = w.findAll('button.deck__card')[1].element
    toucher(carte, 'pointerdown', 0)
    toucher(carte, 'pointerup', 0)
    await vi.advanceTimersByTimeAsync(3000) // repli de 1800 ms, puis image bornée
    expect(w.emitted('pick')).toHaveLength(1)
    expect(w.get('[role="status"]').text()).toBe('Carte choisie.')
  })

  it('un tap avant la fin de la garde ne choisit rien', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(300)
    const carte = w.findAll('button.deck__card')[1].element
    toucher(carte, 'pointerdown', 0)
    toucher(carte, 'pointerup', 0)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('un geste interrompu (pointercancel) ne choisit rien', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100)
    const carte = w.findAll('button.deck__card')[0].element
    toucher(carte, 'pointerdown', 0)
    toucher(carte, 'pointercancel', 0)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toBeUndefined()
  })

  // Hit-test simulé : happy-dom n’a pas de géométrie, on dicte ce que le navigateur verrait sous le doigt.
  const pointer = (cible: Element | null) => Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => cible })
  const paquets = shufflePaquets(mulberry32(7))

  it('un glissement qui finit sur la carte 2 choisit le paquet 2', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100)
    const cartes = w.findAll('button.deck__card').map((c) => c.element)
    pointer(cartes[2])
    toucher(cartes[0], 'pointerdown', 0)
    toucher(cartes[0], 'pointermove', 50)
    toucher(cartes[0], 'pointerup', 50)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toEqual([[paquets[2]]])
  })

  it('un glissement qui finit hors des cartes ne choisit rien', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100)
    const cartes = w.findAll('button.deck__card').map((c) => c.element)
    pointer(cartes[1])
    toucher(cartes[0], 'pointerdown', 0)
    toucher(cartes[0], 'pointermove', 50)
    pointer(null)
    toucher(cartes[0], 'pointerup', 60)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('un click tactile sans geste suivi (lecteur d’écran) choisit le bouton cliqué', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100)
    const cartes = w.findAll('button.deck__card').map((c) => c.element)
    cartes[2].dispatchEvent(new PointerEvent('click', { pointerType: 'touch', bubbles: true }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toEqual([[paquets[2]]])
  })

  it('un vrai tap ne choisit qu’une fois : son click synthétisé est ignoré', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(1100)
    const cartes = w.findAll('button.deck__card').map((c) => c.element)
    toucher(cartes[0], 'pointerdown', 0)
    toucher(cartes[0], 'pointerup', 0)
    cartes[0].dispatchEvent(new PointerEvent('click', { pointerType: 'touch', bubbles: true }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('pick')).toEqual([[paquets[0]]])
  })
})
