/* eslint-disable vue/one-component-per-file -- doublures de composants : plusieurs par fichier */
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { DECK_LAYERS, DECK_TILT, deckPose } from '@/components/deckFan'

// Motion simulé : valeurs minimales (get/set), enveloppes transparentes, animations espionnes (WAAPI absent sous happy-dom).
const exit = vi.hoisted(() => ({ fn: null as null | (() => Promise<void>) }))
vi.mock('motion-v', async () => {
  const valeur = (init: number) => {
    let v = init
    return { get: () => v, set: (x: number) => void (v = x) }
  }
  const M = defineComponent({
    inheritAttrs: false,
    setup:
      (_p, { slots, attrs }) =>
      () =>
        h('div', attrs, slots.default?.()),
  })
  return {
    M,
    animate: vi.fn(() => ({ stop: () => {}, then: (r: () => void) => r() })),
    useMotionValue: valeur,
    useSpring: valeur,
    useMotionValueEvent: () => {},
    usePresence: (o: { onExit: () => Promise<void> }) => void (exit.fn = o.onExit),
  }
})

import CardDeck from '@/components/CardDeck.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  exit.fn = null
})
const Hote = defineComponent({ setup: () => () => h('div', { class: 'grid' }, [h(CardDeck)]) })

describe('CardDeck : le paquet 3D', () => {
  it('une tranche faite de couches statiques sous le dos du dessus, dans un contexte 3D isolé à l’intérieur du paquet', () => {
    wrapper = mount(Hote, { attachTo: document.body })
    const racine = wrapper.get('.deckbox')
    expect(racine.attributes('aria-hidden')).toBe('true') // décoratif
    expect(racine.classes()).toContain('pointer-events-none')
    expect(racine.classes()).toContain('col-start-1') // même cellule que l’éventail : même centre
    const enveloppe = wrapper.get('.deckbox__lift')
    expect(enveloppe.classes().join(' ')).not.toContain('preserve-3d') // l’enveloppe reste plate : aucun contexte 3D partagé avec les cartes
    const interieur = enveloppe.element.firstElementChild as HTMLElement
    expect(interieur.className).toContain('preserve-3d')
    // ombre au sol + couches de la tranche + dos du dessus
    expect(interieur.children).toHaveLength(1 + DECK_LAYERS + 1)
    const profondeurs = [...interieur.children].slice(1, 1 + DECK_LAYERS).map((e) => Number(/calc\((-[\d.]+)cqw\)/.exec((e as HTMLElement).style.transform)?.[1]))
    expect(profondeurs.every((z, k) => z < 0 && (k === 0 || z < profondeurs[k - 1]))).toBe(true) // de plus en plus profondes
    expect(wrapper.find('.back').exists()).toBe(true) // le dos du dessus (TarotCardBack)
  })

  it('la pose partagée part de l’inclinaison de repos, et la sortie libère toujours (durée bornée)', async () => {
    wrapper = mount(Hote, { attachTo: document.body })
    expect(deckPose.rx).toBeCloseTo(DECK_TILT.x, 0)
    deckPose.rx = 99
    await expect(exit.fn?.()).resolves.toBeUndefined()
    expect(deckPose.rx).toBe(DECK_TILT.x) // la pose se réinitialise : la prochaine donne repart du repos
  })
})
