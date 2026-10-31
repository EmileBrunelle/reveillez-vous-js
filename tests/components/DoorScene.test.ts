// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import DoorScene from '@/components/DoorScene.vue'
import { doors } from '@/content/scenes'
import { prophecies } from '@/content/prophecies'
import { useSessionStore } from '@/stores/session'
import type { KnockHit } from '@/audio/sfx'

// Pas d’audio réel : on capture le calendrier des coups pour jouer nous-mêmes les coups de la voyante.
const sfx = vi.hoisted(() => ({
  knocks: [] as { offsets: number[]; intensity: number; onHit: KnockHit; cancel: () => void }[],
  motif: ['court'] as ('court' | 'long')[],
}))
vi.mock('@/audio/sfx', () => ({
  creak: vi.fn(),
  knock: vi.fn(),
  slam: vi.fn(),
  unlock: vi.fn(),
  scheduleKnocks: vi.fn((offsets: number[], intensity: number, onHit: KnockHit) => {
    const cancel = vi.fn()
    sfx.knocks.push({ offsets, intensity, onHit, cancel })
    return { times: [], now: () => 0, cancel }
  }),
}))
// Motif fixe : deux coups séparés d’une pause courte (le jugement reste le vrai `judge`).
vi.mock('@/engine/rhythm', async (orig) => ({ ...(await orig<typeof import('@/engine/rhythm')>()), rhythmFor: () => sfx.motif }))
// Les animations Motion sont remplacées par des contrôles inertes : les promesses se résolvent tout de suite.
vi.mock('motion-v', async (orig) => ({ ...(await orig<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {} })) }))

import { creak, knock, slam, unlock } from '@/audio/sfx'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  sfx.knocks.length = 0
  sfx.motif = ['court']
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const LIGNE = 'Entrez, on vous attendait.'
const monter = (props: Record<string, unknown> = {}) => {
  wrapper = mount(DoorScene, { props: { door: doors[0], line: LIGNE, level: 1, ...props }, attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const porte = (w: VueWrapper) => w.get('button[aria-label="Cogner à la porte"]')
/** Ligne d’aide sous le motif (les phrases fantômes invisibles polluent `text()`). */
const indice = (w: VueWrapper) => w.get('p.m-0').text()
const avancer = (ms: number) => vi.advanceTimersByTimeAsync(ms)
/** Fait avancer le jeu jusqu’à la phase où la personne doit cogner. */
const jusquaRepeter = async (w: VueWrapper) => {
  await porte(w).trigger('click')
  await avancer(800)
  const { onHit } = sfx.knocks[0]
  onHit(0, 0.5)
  onHit(1, 0.5)
  await avancer(300)
}
const cogner = async (w: VueWrapper, n: number, ecart: number) => {
  for (let i = 0; i < n; i++) {
    await porte(w).trigger('click')
    if (i < n - 1) await avancer(ecart)
  }
}

describe('DoorScene : rendu', () => {
  it('affiche la porte comme bouton, son libellé et la phrase d’invite', () => {
    const w = monter()
    expect(porte(w).attributes('data-phase')).toBe('invite')
    expect(w.get('[role="img"]').attributes('aria-label')).toBe(doors[0].label)
    expect(w.get('p.lead').text()).toBe('(Cognez à la porte)')
    expect(porte(w).attributes('aria-describedby')).toBe(w.get('p.lead').attributes('id'))
  })

  it('porte avec cadre : le cadre est dessiné', () => {
    const avecCadre = doors.find((d) => d.frame)!
    const w = monter({ door: avecCadre })
    expect(w.findAll('svg').length).toBeGreaterThan(doors[0].frame ? 2 : 1)
  })

  it('le souffle d’invite arrive après 3 s sans geste', async () => {
    const w = monter()
    expect(indice(w)).toBe('')
    await avancer(3100)
    expect(indice(w)).toBe('Touchez la porte pour cogner.')
    expect(w.get('[data-leaf]').attributes('data-nudge')).toBeDefined()
  })

  it('focus() expose le focus sur la porte', () => {
    const w = monter()
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(porte(w).element)
  })
})

describe('DoorScene : déroulement d’une visite réussie', () => {
  it('cogner, écouter, répéter le rythme, puis la porte s’ouvre', async () => {
    const w = monter()
    const session = useSessionStore()
    const seq0 = session.knock.seq
    await porte(w).trigger('click')
    expect(knock).toHaveBeenCalledTimes(1)
    expect(unlock).toHaveBeenCalled()
    expect(session.knock.seq).toBeGreaterThan(seq0)

    await avancer(800)
    expect(w.emitted('listening')).toEqual([[true]])
    expect(porte(w).attributes('data-phase')).toBe('listen')
    expect(indice(w)).toBe('Ça cogne de l’intérieur…')
    expect(sfx.knocks).toHaveLength(1)
    expect(sfx.knocks[0].offsets).toEqual([0, 0.3])
    expect(w.get('[role="status"]').text()).toContain('toc toc')
    expect(w.get('p.lead').text()).toBe(LIGNE)

    sfx.knocks[0].onHit(0, 0.5)
    sfx.knocks[0].onHit(1, 0.5)
    await nextTick()
    expect(w.findAll('[data-knock-pattern] [data-dot][data-on]')).toHaveLength(2)
    await avancer(300)
    expect(porte(w).attributes('data-phase')).toBe('repeat')
    expect(w.emitted('listening')?.at(-1)).toEqual([false])
    expect(indice(w)).toBe('Touchez la porte : un coup par point.')
    expect(w.get('[role="status"]').text()).toBe('À vous de cogner.')

    await cogner(w, 2, 300)
    await nextTick()
    expect(w.findAll('[data-knock-pattern] [data-dot][data-on]')).toHaveLength(2)
    await avancer(1200) // silence : le rythme est jugé
    expect(w.emitted('knocked')).toHaveLength(1)
    expect(indice(w)).toBe('Bien.')
    expect(w.emitted('open')).toBeUndefined()

    await avancer(350) // ouverture
    expect(creak).toHaveBeenCalledTimes(1)
    await avancer(750 + 400)
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('un toucher pendant l’ouverture la termine tout de suite, une seule fois', async () => {
    const w = monter()
    await jusquaRepeter(w)
    await cogner(w, 2, 300)
    await avancer(1200 + 350)
    expect(creak).toHaveBeenCalled()
    await porte(w).trigger('click')
    expect(w.emitted('open')).toHaveLength(1)
    await avancer(3000)
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('un trop-plein de coups est jugé sans attendre le silence', async () => {
    const w = monter()
    await jusquaRepeter(w)
    await cogner(w, 3, 300)
    expect(indice(w)).toBe('Trop de coups.')
  })

  it('le clic sur la scène (hors bouton) pendant l’ouverture la termine', async () => {
    const w = monter()
    await jusquaRepeter(w)
    await cogner(w, 2, 300)
    await avancer(1200 + 350)
    await w.get('section').trigger('click')
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('les coups du clavier (detail 0) font jaillir les étincelles au centre, ceux de la souris à leur position', async () => {
    const w = monter()
    await porte(w).trigger('click', { detail: 0 })
    await porte(w).trigger('click', { detail: 1, clientX: 40, clientY: 50 })
    expect(knock).toHaveBeenCalledTimes(2)
  })
})

describe('DoorScene : échecs', () => {
  it('pas assez de coups : verdict, nouvelle écoute, puis abandon après trois échecs', async () => {
    const w = monter()
    await jusquaRepeter(w)
    await cogner(w, 1, 0)
    await avancer(1200)
    expect(indice(w)).toBe('Pas assez de coups.')
    expect(w.emitted('knocked')).toBeUndefined()
    const lignesRate = new Set(
      Object.values(prophecies)
        .flat()
        .filter((t): t is string => typeof t === 'string'),
    )
    expect(lignesRate.has(w.get('p.lead').text())).toBe(true)

    await avancer(1600) // nouvelle écoute
    expect(sfx.knocks).toHaveLength(2)
    expect(indice(w)).toBe('Ça cogne de l’intérieur…')
    sfx.knocks[1].onHit(1, 0.5)
    await avancer(300)
    await cogner(w, 1, 0)
    await avancer(1200 + 1600)
    expect(sfx.knocks).toHaveLength(3)
    sfx.knocks[2].onHit(1, 0.5)
    await avancer(300)
    await cogner(w, 1, 0)
    await avancer(1200)
    expect(w.emitted('open')).toBeUndefined()
    await avancer(1800 + 750 + 400)
    expect(creak).toHaveBeenCalled()
    expect(w.emitted('open')).toHaveLength(1)
    expect(w.emitted('knocked')).toBeUndefined()
  })

  it('bon nombre de coups mais mauvais rythme : verdict dédié', async () => {
    sfx.motif = ['long'] // la personne tape une pause courte : bon nombre, mauvais rythme
    const w = monter()
    await jusquaRepeter(w)
    await cogner(w, 2, 300)
    await avancer(1200)
    expect(indice(w)).toBe('Le bon nombre de coups, mais pas le bon rythme.')
    expect(w.emitted('knocked')).toBeUndefined()
  })
})

describe('DoorScene : visite de rappel', () => {
  it('un seul toucher ouvre la porte', async () => {
    const w = monter({ quick: true })
    expect(w.get('p.lead').text()).toBe(LIGNE)
    expect(indice(w)).toBe('Touchez la porte pour l’ouvrir.')
    await porte(w).trigger('click')
    expect(w.get('[role="status"]').text()).toBe('La porte s’ouvre.')
    await avancer(450 + 750 + 400)
    expect(w.emitted('open')).toHaveLength(1)
    expect(sfx.knocks).toHaveLength(0)
  })

  it('des touchers rapprochés ne programment qu’une ouverture', async () => {
    const w = monter({ quick: true })
    await porte(w).trigger('click')
    await porte(w).trigger('click')
    await avancer(450 + 750 + 400)
    expect(creak).toHaveBeenCalledTimes(1)
  })
})

describe('DoorScene : entrées tactiles et clavier', () => {
  it('le toucher compte au pointerdown ; le clic qui suit est ignoré', async () => {
    const w = monter()
    porte(w).element.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    await porte(w).trigger('click', { detail: 1 })
    expect(knock).toHaveBeenCalledTimes(1)
  })

  it('un pointerdown de souris est laissé au clic', async () => {
    const w = monter()
    porte(w).element.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }))
    expect(knock).not.toHaveBeenCalled()
    await porte(w).trigger('click', { detail: 1 })
    expect(knock).toHaveBeenCalledTimes(1)
  })

  it('une touche maintenue (repeat) ne cogne pas : preventDefault', async () => {
    const w = monter()
    const e = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true })
    porte(w).element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    const e2 = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    porte(w).element.dispatchEvent(e2)
    expect(e2.defaultPrevented).toBe(false)
  })

  it('les clics multiples ne sélectionnent pas de texte', () => {
    const w = monter()
    const double = new MouseEvent('mousedown', { detail: 2, bubbles: true, cancelable: true })
    porte(w).element.dispatchEvent(double)
    expect(double.defaultPrevented).toBe(true)
    const simple = new MouseEvent('mousedown', { detail: 1, bubbles: true, cancelable: true })
    porte(w).element.dispatchEvent(simple)
    expect(simple.defaultPrevented).toBe(false)
  })
})

describe('DoorScene : mouvement réduit', () => {
  it('la porte s’ouvre sans animation de rotation et émet open', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
    const w = monter({ quick: true })
    await porte(w).trigger('click')
    await avancer(450 + 400)
    expect(creak).toHaveBeenCalled()
    expect(w.emitted('open')).toHaveLength(1)
  })
})

describe('DoorScene : fermeture', () => {
  it('la porte claque : impact, puis closed ; plus de bouton', async () => {
    const w = monter({ closing: true })
    expect(w.find('button[aria-label="Cogner à la porte"]').exists()).toBe(false)
    expect(w.find('.scene--ui').attributes('inert')).toBeDefined()
    await avancer(250 + 20)
    expect(slam).toHaveBeenCalledTimes(1)
    expect(w.emitted('impact')).toEqual([[1]])
    await avancer(550)
    expect(w.emitted('closed')).toHaveLength(1)
  })

  it('un clic sur la scène pendant la fermeture la termine tout de suite', async () => {
    const w = monter({ closing: true })
    await w.get('section').trigger('click')
    expect(w.emitted('closed')).toHaveLength(1)
    await avancer(2000)
    expect(w.emitted('closed')).toHaveLength(1)
  })

  it('fermeture en mouvement réduit : mêmes événements', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
    const w = monter({ closing: true })
    await avancer(250 + 20 + 550)
    expect(w.emitted('impact')).toEqual([[1]])
    expect(w.emitted('closed')).toHaveLength(1)
  })
})

describe('DoorScene : destruction', () => {
  it('annule le calendrier des coups', async () => {
    const w = monter()
    await porte(w).trigger('click')
    await avancer(800)
    w.unmount()
    wrapper = undefined
    expect(sfx.knocks[0].cancel).toHaveBeenCalled()
  })
})
