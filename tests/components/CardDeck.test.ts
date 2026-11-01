/* eslint-disable vue/one-component-per-file -- doublures de composants : plusieurs par fichier */
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { DECK_LAYERS, DECK_TILT, deckPose } from '@/components/deckFan'
import { deckShown } from '@/components/deckShown'
import { deckSlot } from '@/components/deckInsert'

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
  deckShown.value = false
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
    const surech = enveloppe.element.firstElementChild as HTMLElement
    expect(surech.className).toBe('deck-ss') // rendu en sur-échantillonnage : l’intérieur est dessiné à 2× puis ramené à 1×, pour lisser les bords en escalier
    const interieur = surech.firstElementChild as HTMLElement
    expect(interieur.className).toContain('preserve-3d')
    // ombre au sol + couches de la tranche + dos du dessus
    expect(interieur.children).toHaveLength(1 + DECK_LAYERS + 1)
    const profondeurs = [...interieur.children].slice(1, 1 + DECK_LAYERS).map((e) => Number(/calc\((-[\d.]+)cqw\)/.exec((e as HTMLElement).style.transform)?.[1]))
    expect(profondeurs.every((z, k) => z < 0 && (k === 0 || z < profondeurs[k - 1]))).toBe(true) // de plus en plus profondes
    expect(wrapper.find('.back').exists()).toBe(true) // le dos du dessus (TarotCardBack)
  })

  it('caché par défaut, décoratif et inerte : jamais cliquable, sans curseur de clic, masqué aux technologies d’assistance', () => {
    wrapper = mount(Hote, { attachTo: document.body })
    const racines = wrapper.findAll('.deckbox')
    expect(racines).toHaveLength(2) // le paquet et sa couche de recouvrement
    racines.forEach((r) => {
      expect(r.attributes('aria-hidden')).toBe('true')
      expect(r.classes()).toContain('pointer-events-none')
      expect(r.classes().join(' ')).not.toMatch(/cursor-/)
    })
    expect(wrapper.html()).not.toContain('cursor-pointer')
    expect(wrapper.html()).not.toContain('<button')
  })

  it('la couche de recouvrement copie le dessus du paquet : le dos et les couches AU-DESSUS du rang visé, par-dessus la carte, éteinte au départ', () => {
    wrapper = mount(Hote, { attachTo: document.body })
    const couche = wrapper.get('.deckcover')
    expect(couche.classes()).toContain('z-10') // un z-index constant, jamais animé
    expect(couche.classes()).toContain('pointer-events-none')
    const surech = couche.get('.deckbox__lift').element.firstElementChild as HTMLElement
    expect(surech.className).toBe('deck-ss') // même sur-échantillonnage que le paquet : la copie reste identique
    const interieur = surech.firstElementChild as HTMLElement
    expect(interieur.className).toContain('preserve-3d')
    expect(interieur.children).toHaveLength(deckSlot.value + 1) // les couches au-dessus du rang, plus le dos du dessus (pas d’ombre au sol)
    expect(couche.find('.back').exists()).toBe(true)
  })

  it('la sortie libère toujours (durée bornée), puis la pose partagée repart du repos pour la prochaine donne', async () => {
    wrapper = mount(Hote, { attachTo: document.body })
    expect(deckPose.rx).toBeCloseTo(DECK_TILT.x, 0)
    deckPose.rx = 99
    await expect(exit.fn?.()).resolves.toBeUndefined()
    expect(deckPose.rx).toBe(DECK_TILT.x)
  })

  it('suit deckShown : il n’apparaît qu’à la donne et au rangement', async () => {
    const { animate } = await import('motion-v')
    wrapper = mount(Hote, { attachTo: document.body })
    const appels = () => vi.mocked(animate).mock.calls.length
    const avant = appels()
    deckShown.value = true
    await wrapper.vm.$nextTick()
    expect(appels()).toBeGreaterThan(avant) // fondu d’apparition (et respiration)
    const apres = appels()
    deckShown.value = false
    await wrapper.vm.$nextTick()
    expect(appels()).toBeGreaterThan(apres) // fondu de disparition
  })

  it('le dos du dessus varie d’un montage à l’autre, et la couche de recouvrement affiche toujours le même que le paquet', () => {
    const vus = new Set<string>()
    for (const r of [0, 0.4, 0.9]) {
      vi.spyOn(Math, 'random').mockReturnValue(r)
      wrapper = mount(Hote, { attachTo: document.body })
      const dos = (sel: string) =>
        wrapper!
          .get(`${sel} .back`)
          .classes()
          .find((k) => k.startsWith('back--') && k !== 'back--fill')
      expect(dos('.deckcover')).toBe(dos('.deckbox:not(.deckcover)'))
      vus.add(dos('.deckcover')!)
      wrapper.unmount()
      wrapper = undefined
      vi.restoreAllMocks()
    }
    expect(vus.size).toBe(3)
  })
})
