// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import DeckCut from '@/components/DeckCut.vue'
import { PAQUET_NOMS, PAQUET_PRESAGES, shufflePaquets } from '@/engine/paquets'
import { mulberry32 } from '@/engine/rng'

// La boucle rAF et la mesure de la boîte sont pilotées à la main : la géométrie n’existe pas sous happy-dom.
const boucle = vi.hoisted(() => ({ cb: null as null | ((o: { timestamp: number }) => void), largeur: { value: 300 } as { value: number } }))
vi.mock('@vueuse/core', async (orig) => {
  const vue = await import('vue')
  return {
    ...(await orig<typeof import('@vueuse/core')>()),
    useRafFn: (cb: (o: { timestamp: number }) => void) => {
      boucle.cb = cb
      return { resume: () => {}, pause: () => {} }
    },
    useElementSize: () => ({ width: vue.computed(() => boucle.largeur.value), height: vue.ref(0) }),
  }
})
vi.mock('@/audio/sfx', () => ({ cardDeal: vi.fn() }))
vi.mock('@/audio/cards', () => ({ cardHover: vi.fn(), cardPick: vi.fn(), cardPickStill: vi.fn() }))

import { cardDeal } from '@/audio/sfx'
import { cardHover, cardPick, cardPickStill } from '@/audio/cards'

const paquets = shufflePaquets(mulberry32(7))
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  boucle.cb = null
  boucle.largeur = ref(300)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const media = (re: RegExp) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: re.test(q), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
const reduit = () => media(/reduce/)
const monter = () => {
  wrapper = mount(DeckCut, { props: { level: 1, rng: mulberry32(7) }, attachTo: document.body })
  return wrapper
}
const cartes = () => wrapper!.findAll('button.deck__card')
const avancer = (ms: number) => vi.advanceTimersByTimeAsync(ms)
/** Fait tourner la boucle d’animation comme le ferait requestAnimationFrame. */
const images = (n: number) => {
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(16)
    boucle.cb?.({ timestamp: performance.now() })
  }
}
const pointeur = (cible: Element, type: string, init: PointerEventInit = {}) =>
  cible.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true, ...init }))
const statut = () => wrapper!.get('[role="status"]').text()
const lignesActives = () => wrapper!.findAll('.deck__line--on').length

describe('DeckCut : rendu et donne', () => {
  it('trois cartes nommées par leur paquet, invite et légende dans l’ordre des paquets', () => {
    const w = monter()
    expect(cartes()).toHaveLength(3)
    cartes().forEach((c, i) => expect(c.attributes('aria-label')).toBe(`${PAQUET_NOMS[paquets[i]]} : ${PAQUET_PRESAGES[paquets[i]]}`))
    expect(w.attributes('role')).toBe('group')
    expect(w.attributes('aria-labelledby')).toBe(w.get('.deck__prompt').attributes('id'))
    expect(w.get('.deck__prompt').text()).toBe('Choisissez une carte.')
    expect(w.findAll('.deck__line')).toHaveLength(3)
    w.findAll('.deck__line').forEach((l, i) => {
      expect(l.text()).toContain(PAQUET_PRESAGES[paquets[i]])
      expect(l.text().toLowerCase()).toContain(PAQUET_NOMS[paquets[i]].toLowerCase())
    })
    expect(statut()).toBe('')
  })

  it('l’invite devient « Touchez une carte. » sur un écran tactile', () => {
    media(/coarse/)
    const w = monter()
    expect(w.get('.deck__prompt').text()).toBe('Touchez une carte.')
  })

  it('les cartes sont données avec leur bruit, puis prêtes après 1 s', async () => {
    const w = monter()
    expect(cartes()[0].classes()).toContain('pointer-events-none')
    expect(w.get('.deck__prompt').classes()).not.toContain('opacity-100')
    await avancer(400)
    expect(cardDeal).toHaveBeenCalledTimes(3)
    await avancer(700)
    expect(cartes()[0].classes()).not.toContain('pointer-events-none')
    expect(w.get('.deck__prompt').classes()).toContain('opacity-100')
  })

  it('la carte du milieu est devant les deux autres au repos', () => {
    monter()
    expect(cartes().map((c) => c.classes().find((k) => /^z-\d+$/.test(k)))).toEqual(['z-1', 'z-3', 'z-1'])
  })

  it('focus() donne le focus au groupe', () => {
    const w = monter()
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.element)
  })
})

describe('DeckCut : survol à la souris', () => {
  it('survoler une carte prête la met en valeur dans la légende, une seule fois (bruit de frôlement)', async () => {
    monter()
    await avancer(1100)
    pointeur(cartes()[2].element, 'pointerenter')
    expect(cardHover).toHaveBeenCalledTimes(1)
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
    expect(wrapper!.findAll('.deck__line')[2].classes()).toContain('deck__line--on')
    pointeur(cartes()[2].element, 'pointerenter')
    expect(cardHover).toHaveBeenCalledTimes(1)
    pointeur(cartes()[2].element, 'pointermove', { clientX: 10, clientY: 10 })
    images(30) // les ressorts poursuivent la cible sans lever d’erreur
    pointeur(cartes()[2].element, 'pointerleave')
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
  })

  it('avant la fin de la garde, le survol ne fait rien', async () => {
    monter()
    await avancer(300)
    pointeur(cartes()[0].element, 'pointerenter')
    await wrapper!.vm.$nextTick()
    expect(cardHover).not.toHaveBeenCalled()
    expect(lignesActives()).toBe(0)
  })

  it('un pointeur tactile ne déclenche pas de survol, et pointerleave d’une autre carte ne désactive pas la visée', async () => {
    monter()
    await avancer(1100)
    pointeur(cartes()[0].element, 'pointerenter', { pointerType: 'touch' })
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
    pointeur(cartes()[1].element, 'pointerenter')
    pointeur(cartes()[0].element, 'pointerleave')
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
    pointeur(cartes()[1].element, 'pointerleave', { pointerType: 'touch' })
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
  })

  it('le clavier : le focus visible vise la carte, la perte de focus la relâche', async () => {
    monter()
    await avancer(1100)
    const bouton = cartes()[0].element as HTMLElement
    vi.spyOn(bouton, 'matches').mockImplementation((s: string) => s === ':focus-visible')
    bouton.dispatchEvent(new FocusEvent('focus'))
    await wrapper!.vm.$nextTick()
    expect(wrapper!.findAll('.deck__line')[0].classes()).toContain('deck__line--on')
    bouton.dispatchEvent(new FocusEvent('blur'))
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
  })

  it('un focus qui n’est pas « visible » (clic) ne vise rien', async () => {
    monter()
    await avancer(1100)
    ;(cartes()[0].element as HTMLElement).dispatchEvent(new FocusEvent('focus'))
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
  })
})

describe('DeckCut : choix à la souris', () => {
  it('un clic avant que les cartes soient prêtes ne choisit rien', async () => {
    const w = monter()
    await avancer(300)
    await cartes()[1].trigger('click')
    await avancer(3000)
    expect(w.emitted('pick')).toBeUndefined()
    expect(cardPick).not.toHaveBeenCalled()
  })

  it('choisir : son, statut, cartes désactivées, vol de la carte jusqu’à la position du tirage, puis pick', async () => {
    const w = monter()
    await avancer(1100)
    images(120) // éventail posé
    await cartes()[2].trigger('click')
    expect(cardPick).toHaveBeenCalledTimes(1)
    expect(statut()).toBe('Carte choisie.')
    expect(cartes().every((c) => c.attributes('disabled') !== undefined)).toBe(true)
    expect(w.emitted('pick')).toBeUndefined()
    // Dès le choix (avant tout mouvement), la carte du dessous passe au-dessus de toutes les autres, qui se rangent dessous.
    expect(cartes()[2].classes()).toContain('z-10')
    expect(cartes()[0].classes()).not.toContain('z-10')
    expect(cartes()[1].classes()).not.toContain('z-10')
    images(300) // fuite des autres, envol, tassement
    await w.vm.$nextTick()
    expect(cartes()[2].classes()).toContain('z-10') // la carte choisie passe devant à l’envol
    await avancer(200) // image bornée avant l’émission
    expect(w.emitted('pick')).toEqual([[paquets[2]]])
    // un second clic (ou le filet de 1,8 s) n’émet pas une deuxième fois
    await cartes()[0].trigger('click')
    await avancer(3000)
    expect(w.emitted('pick')).toHaveLength(1)
  })

  it('choisir la carte du milieu et celle de gauche fonctionne aussi', async () => {
    for (const i of [0, 1]) {
      const w = monter()
      await avancer(1100)
      images(60)
      await cartes()[i].trigger('click')
      images(300)
      await avancer(200)
      expect(w.emitted('pick')).toEqual([[paquets[i]]])
      w.unmount()
      wrapper = undefined
    }
  })

  it('sans image d’animation (onglet masqué), le filet de 1,8 s émet quand même', async () => {
    const w = monter()
    await avancer(1100)
    await cartes()[0].trigger('click')
    await avancer(1700)
    expect(w.emitted('pick')).toBeUndefined()
    await avancer(300)
    expect(w.emitted('pick')).toEqual([[paquets[0]]])
  })

  it('grand écran haut : l’éventail s’étale sans erreur et le choix aboutit', async () => {
    media(/min-width: 1600px/)
    const w = monter()
    await avancer(1100)
    images(80)
    await cartes()[1].trigger('click')
    images(300)
    await avancer(200)
    expect(w.emitted('pick')).toEqual([[paquets[1]]])
  })

  it('boîte étroite (téléphone en paysage) : même déroulement', async () => {
    boucle.largeur.value = 200
    const w = monter()
    await avancer(1100)
    images(80)
    pointeur(cartes()[0].element, 'pointerenter')
    images(20)
    await cartes()[0].trigger('click')
    images(300)
    await avancer(200)
    expect(w.emitted('pick')).toEqual([[paquets[0]]])
  })

  it('boîte non mesurée (largeur 0) : la boucle ne fait rien, le filet choisit quand même', async () => {
    boucle.largeur.value = 0
    const w = monter()
    await avancer(1100)
    images(10)
    await cartes()[1].trigger('click')
    await avancer(2000)
    expect(w.emitted('pick')).toEqual([[paquets[1]]])
  })
})

describe('DeckCut : mouvement réduit', () => {
  it('cartes prêtes tout de suite ; le survol met en valeur sans mouvement ni bruit', async () => {
    reduit()
    monter()
    await wrapper!.vm.$nextTick()
    expect(cartes()[0].classes()).not.toContain('pointer-events-none')
    expect(cardDeal).not.toHaveBeenCalled()
    pointeur(cartes()[0].element, 'pointerenter')
    await wrapper!.vm.$nextTick()
    expect(cardHover).not.toHaveBeenCalled()
    expect(lignesActives()).toBe(1)
    pointeur(cartes()[0].element, 'pointerleave')
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
  })

  it('choisir : bruit « immobile », puis pick après 320 ms (courte glissade, pas de ressort)', async () => {
    reduit()
    const w = monter()
    await cartes()[1].trigger('click')
    expect(cardPickStill).toHaveBeenCalledTimes(1)
    expect(cardPick).not.toHaveBeenCalled()
    expect(w.emitted('pick')).toBeUndefined()
    await avancer(330)
    expect(w.emitted('pick')).toEqual([[paquets[1]]])
  })

  it('le focus clavier met en valeur la carte, et un changement de largeur remet l’éventail en place', async () => {
    reduit()
    monter()
    const bouton = cartes()[2].element as HTMLElement
    vi.spyOn(bouton, 'matches').mockImplementation((s: string) => s === ':focus-visible')
    bouton.dispatchEvent(new FocusEvent('focus'))
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
    boucle.largeur.value = 400
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
  })
})

describe('DeckCut : toucher (aperçu et annonce)', () => {
  const toucher = (cible: Element | Window, type: string, init: PointerEventInit = {}) =>
    cible.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true, ...init }))
  const sous = (cible: Element | null) => Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => cible })

  it('un glissement met l’aperçu sous le doigt et l’annonce une seule fois aux lecteurs d’écran', async () => {
    monter()
    await avancer(1100)
    sous(cartes()[1].element)
    toucher(cartes()[0].element, 'pointerdown')
    toucher(cartes()[0].element, 'pointermove', { clientX: 5 }) // sous le seuil : encore un tap
    await wrapper!.vm.$nextTick()
    expect(statut()).toBe('')
    toucher(cartes()[0].element, 'pointermove', { clientX: 40 })
    await wrapper!.vm.$nextTick()
    expect(statut()).toBe(`${PAQUET_NOMS[paquets[1]]} : ${PAQUET_PRESAGES[paquets[1]]}`)
    expect(cardHover).toHaveBeenCalledTimes(1)
  })

  it('un tap hors des cartes annule l’aperçu', async () => {
    monter()
    await avancer(1100)
    sous(cartes()[1].element)
    toucher(cartes()[0].element, 'pointerdown')
    toucher(cartes()[0].element, 'pointermove', { clientX: 40 })
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(1)
    toucher(document.body, 'pointercancel')
    toucher(document.body, 'pointerdown')
    await wrapper!.vm.$nextTick()
    expect(lignesActives()).toBe(0)
    expect(statut()).toBe('')
  })

  it('un second doigt est ignoré, et la perte de focus ou le masquage de l’onglet remettent le suivi à zéro', async () => {
    const w = monter()
    await avancer(1100)
    toucher(cartes()[0].element, 'pointerdown')
    toucher(cartes()[1].element, 'pointerdown', { pointerId: 2, isPrimary: false })
    window.dispatchEvent(new Event('blur'))
    toucher(cartes()[0].element, 'pointerup') // suivi perdu : rien n’est choisi
    await avancer(3000)
    expect(w.emitted('pick')).toBeUndefined()
    toucher(cartes()[0].element, 'pointerdown')
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    toucher(cartes()[0].element, 'pointerup')
    await avancer(3000)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('un pointermove d’un autre doigt ou sans geste en cours est ignoré', async () => {
    const w = monter()
    await avancer(1100)
    toucher(window, 'pointermove', { clientX: 100 })
    toucher(cartes()[0].element, 'pointerdown')
    toucher(cartes()[0].element, 'pointermove', { clientX: 100, pointerId: 9 })
    toucher(cartes()[0].element, 'pointerup', { pointerId: 9 })
    await avancer(100)
    expect(w.emitted('pick')).toBeUndefined()
    expect(cardHover).not.toHaveBeenCalled()
  })
})
