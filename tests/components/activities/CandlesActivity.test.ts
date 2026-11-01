// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CandlesActivity from '@/components/activities/CandlesActivity.vue'
import { mulberry32 } from '@/engine/rng'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, durationOf } from '@/engine/activityTiming'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { avancer, evenementPointeur, fenetrePerdFocus, fenetreRetrouveFocus, horloge, rect, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) : le HUD appelle `animate`, on le neutralise.
// Le ressort de l’allumette est remplacé par un suivi immédiat (la physique de Motion n’est pas l’objet du test, et son rendu ne suit pas les fausses horloges).
vi.mock('motion-v', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion-v')>()),
  animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })),
  useSpring: (source: { get: () => number; set: (v: number) => void }) => ({ get: () => source.get(), jump: (v: number) => source.set(v), getVelocity: () => 0 }),
}))

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  horloge()
  avertissements = [vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})]
})
afterEach(() => {
  // Aucun avertissement Vue pendant tout le test.
  for (const spy of avertissements) expect(spy).not.toHaveBeenCalled()
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

const monter = async (level = 1) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(CandlesActivity, { props: { level, rng: mulberry32(7) }, attachTo: document.body, global: { plugins: [pinia] } })
  // Les écouteurs de la scène s’attachent après le premier tick.
  await avancer(1)
  return wrapper
}
const chandelles = (w: VueWrapper) => w.findAll('button.candle')
const allumees = (w: VueWrapper) => chandelles(w).filter((c) => c.attributes('aria-label')?.endsWith('allumée'))
const invite = (w: VueWrapper) => w.get('p[aria-live="polite"]')
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')

// Mesures : scène en (0, 0), trois chandelles de 72×176 px alignées, mèche à 28 % de la hauteur.
const mesurer = (w: VueWrapper) => {
  const scene = w.element as HTMLElement
  scene.getBoundingClientRect = () => rect(0, 0, 800, 600)
  chandelles(w).forEach((c, i) => ((c.element as HTMLElement).getBoundingClientRect = () => rect(200 + i * 160, 300, 72, 176)))
}
const meche = (i: number) => ({ x: 200 + i * 160 + 36, y: 300 + 176 * 0.28 })
// L’allumette vise 20 px sous la mèche (le point de la flamme est `y - 20`).
const approcher = (w: VueWrapper, i: number) => {
  const m = meche(i)
  w.element.dispatchEvent(evenementPointeur('pointermove', { clientX: m.x, clientY: m.y + 20 }))
}

describe('CandlesActivity : allumage', () => {
  it('trois clics allument les trois chandelles, puis réussite et fin émise après l’issue', async () => {
    const w = await monter()
    await avancer(200)
    expect(invite(w).text()).toBe('Allumez les trois chandelles')
    expect(allumees(w)).toHaveLength(0)
    for (const [i, c] of chandelles(w).entries()) {
      await c.trigger('click')
      expect(allumees(w)).toHaveLength(i + 1)
    }
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('un second clic sur une chandelle déjà allumée ne change rien', async () => {
    const w = await monter()
    const [premiere] = chandelles(w)
    await premiere.trigger('click')
    await premiere.trigger('click')
    expect(allumees(w)).toHaveLength(1)
  })

  it('l’allumette tenue 600 ms sur une mèche l’allume ; ailleurs, la progression retombe', async () => {
    const w = await monter()
    mesurer(w)
    approcher(w, 1)
    await avancer(300)
    expect(allumees(w)).toHaveLength(0)
    // Partie en vue de la mèche : la progression redescend, rien ne s’allume.
    w.element.dispatchEvent(evenementPointeur('pointermove', { clientX: 10, clientY: 10 }))
    await avancer(700)
    expect(allumees(w)).toHaveLength(0)
    approcher(w, 1)
    await avancer(900)
    expect(allumees(w).map((c) => c.attributes('aria-label'))).toEqual(['Chandelle 2 allumée'])
  })

  it('le pointeur qui quitte la scène (souris) retire l’allumette ; au toucher, la prise dure 300 ms', async () => {
    const w = await monter()
    mesurer(w)
    approcher(w, 0)
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-100')
    w.element.dispatchEvent(evenementPointeur('pointerleave', { clientX: 0, clientY: 0 }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-0')

    w.element.dispatchEvent(evenementPointeur('pointerdown', { clientX: meche(0).x, clientY: meche(0).y + 20, pointerType: 'touch' }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-100')
    w.element.dispatchEvent(evenementPointeur('pointerup', { clientX: 0, clientY: 0, pointerType: 'touch' }))
    w.element.dispatchEvent(evenementPointeur('pointerleave', { clientX: 0, clientY: 0, pointerType: 'touch' }))
    await avancer(100)
    expect(w.get('.match').classes()).toContain('opacity-100')
    await avancer(400)
    expect(w.get('.match').classes()).toContain('opacity-0')
  })

  it('pointercancel retire l’allumette et remet à zéro la progression des mèches éteintes', async () => {
    const w = await monter()
    mesurer(w)
    approcher(w, 2)
    await avancer(300)
    expect(w.findAll('.wick-glow')[2].attributes('style')).not.toContain('opacity: 0;')
    w.element.dispatchEvent(evenementPointeur('pointercancel', { clientX: 0, clientY: 0 }))
    await avancer(16)
    expect(w.get('.match').classes()).toContain('opacity-0')
    expect(w.findAll('.wick-glow')[2].attributes('style')).toContain('opacity: 0')
  })

  it('le toucher tient la chandelle (pointerdown) jusqu’au relâchement du doigt', async () => {
    const w = await monter(3)
    await chandelles(w)[0].trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    window.dispatchEvent(new Event('pointercancel'))
    // Aucune erreur : l’état « touché » est relâché ; la chandelle reste éteinte.
    expect(allumees(w)).toHaveLength(0)
  })
})

describe('CandlesActivity : niveau 3 (courant d’air)', () => {
  const toutAllumer = async (w: VueWrapper) => {
    for (const c of chandelles(w)) await c.trigger('click')
  }

  it('une chandelle s’éteint après la troisième ; la rallumer termine l’activité', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(500)
    expect(allumees(w)).toHaveLength(2)
    await avancer(200)
    expect(invite(w).text()).toBe('Un courant d’air… Rallumez la chandelle.')
    expect(w.find('.smoke').exists()).toBe(true)
    const eteinte = chandelles(w).find((c) => !c.attributes('aria-label')?.endsWith('allumée'))!
    await eteinte.trigger('click')
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('sans rallumage après 4 s, la chandelle se rallume seule et l’activité réussit', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    await avancer(600)
    expect(allumees(w)).toHaveLength(2)
    await avancer(3900)
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('une chandelle survolée n’est jamais soufflée : le courant d’air attend', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    for (const c of chandelles(w)) await c.trigger('pointerenter')
    await avancer(1500)
    expect(allumees(w)).toHaveLength(3)
    for (const c of chandelles(w)) await c.trigger('pointerleave')
    await avancer(600)
    expect(allumees(w)).toHaveLength(2)
  })

  it('une chandelle au focus clavier est protégée comme une chandelle survolée', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    for (const c of chandelles(w)) await c.trigger('focus')
    await avancer(1500)
    expect(allumees(w)).toHaveLength(3)
    // Un seul blur : les deux autres restent protégées, celle-là peut être soufflée.
    await chandelles(w)[1].trigger('blur')
    await avancer(600)
    expect(chandelles(w)[1].attributes('aria-label')).toBe('Allumer la chandelle 2')
    expect(allumees(w)).toHaveLength(2)
  })

  it('le courant d’air n’arrive qu’une fois', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    await avancer(600)
    const eteinte = chandelles(w).find((c) => !c.attributes('aria-label')?.endsWith('allumée'))!
    await eteinte.trigger('click')
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('mouvement et niveau 1 ou 2 : aucune chandelle soufflée', async () => {
    const w = await monter(2)
    await toutAllumer(w)
    await avancer(800)
    expect(allumees(w)).toHaveLength(3)
  })
})

describe('CandlesActivity : issue et pause', () => {
  it('sans rien faire, l’échec arrive à la fin du temps ; les chandelles restent comme elles sont', async () => {
    const w = await monter()
    await chandelles(w)[0].trigger('click')
    await avancer(durationOf('candles') + ACTIVITY_GRACE_MS + 100)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.fail)
    expect(allumees(w)).toHaveLength(1)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('la pause fige la minuterie : aucun échec tant que « Reprendre » n’est pas pressé', async () => {
    const w = await monter()
    await avancer(500)
    fenetrePerdFocus()
    await avancer(50)
    expect(w.text()).toContain('EN PAUSE')
    await avancer(40_000)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.fail)
    // Le retour du focus seul ne reprend pas.
    fenetreRetrouveFocus()
    await avancer(40_000)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.fail)
    await reprendre(w)
    await avancer(100)
    expect(w.text()).not.toContain('EN PAUSE')
    await avancer(21_000)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.fail)
  })

  it('en pause, l’allumette ne s’allume pas ; le courant d’air est reporté à la reprise', async () => {
    const w = await monter(3)
    mesurer(w)
    for (const c of chandelles(w)) await c.trigger('click')
    // Pause avant l’échéance de 450 ms du courant d’air.
    fenetrePerdFocus()
    await avancer(2000)
    expect(allumees(w)).toHaveLength(3)
    await reprendre(w)
    await avancer(50)
    expect(allumees(w)).toHaveLength(2)
  })

  it('en pause, la boucle de l’allumette est figée', async () => {
    const w = await monter()
    mesurer(w)
    fenetrePerdFocus()
    approcher(w, 0)
    await avancer(2000)
    expect(allumees(w)).toHaveLength(0)
  })
})
