// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import PendulumActivity from '@/components/activities/PendulumActivity.vue'
import { ACTIVITY_PROMPTS, PENDULUM_TEXTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, durationOf } from '@/engine/activityTiming'
import { heldSymbol, paramsFor, restAngle, symbolAngle, symbolSpacing, tuningFor, type PendulumState } from '@/engine/pendulum'
import { mulberry32 } from '@/engine/rng'
import { activityFor } from '@/lazy'
import { avancer, fenetrePerdFocus, horloge, mouvementReduit, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) : le HUD et la réussite appellent `animate`, on le neutralise.
const animate = vi.hoisted(() => vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })))
vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate }))

// État physique du cristal : lu à chaque image (le rendu passe par des variables CSS, pas par Vue).
const suivi = vi.hoisted(() => ({ state: null as PendulumState | null, steps: 0 }))
vi.mock('@/engine/pendulum', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/engine/pendulum')>()
  return {
    ...orig,
    stepPendulum: (...a: Parameters<typeof orig.stepPendulum>) => {
      const r = orig.stepPendulum(...a)
      suivi.state = r
      suivi.steps++
      return r
    },
  }
})

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  suivi.state = null
  suivi.steps = 0
  animate.mockClear()
  horloge()
  avertissements = [vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})]
})
afterEach(() => {
  for (const spy of avertissements) expect(spy).not.toHaveBeenCalled()
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

const LEVEL = 3
const tuning = tuningFor(LEVEL)
const params = paramsFor(tuning)

const monter = async (level = LEVEL, seed = 11) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(PendulumActivity, { props: { level, rng: mulberry32(seed) }, attachTo: document.body, global: { plugins: [pinia] } })
  await avancer(200)
  return wrapper
}
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')
const invite = (w: VueWrapper) => w.get('p[aria-live="polite"]')
const bouton = (w: VueWrapper) => w.get('button.crystal-hit')
const symboles = (w: VueWrapper) => w.findAll('[data-testid="pendulum-symbol"]')
const cible = (w: VueWrapper) => symboles(w).findIndex((s) => s.attributes('data-target') !== undefined)
const angleCss = (w: VueWrapper) => Number((w.get('[data-testid="pendulum-swing"]').element as HTMLElement).style.getPropertyValue('--a'))
const appuiClavier = (w: VueWrapper, key = ' ') => bouton(w).trigger('keydown', { key })

// Avance image par image jusqu’à ce que le cristal, arrêté à cet instant, s’immobilise là où `veut(angle)` ; appuie alors sur Espace.
const appuyerQuand = async (w: VueWrapper, veut: (reste: number) => boolean, maxMs = 12_000) => {
  for (let t = 0; t < maxMs; t += 16) {
    if (suivi.state && !suivi.state.rest && !suivi.state.stopped && veut(restAngle(suivi.state, params))) {
      await appuiClavier(w)
      return true
    }
    await avancer(16)
  }
  return false
}
// Zone centrale du symbole visé (à moins de 0,2 espacement).
const surCible = (w: VueWrapper) => (reste: number) => Math.abs(reste - symbolAngle(cible(w), tuning.count)) < 0.2 * symbolSpacing(tuning.count)
// Deux symboles à côté de la cible, côté centre (toujours atteignable).
const ratee = (w: VueWrapper) => {
  const t = cible(w)
  const voulu = symbolAngle(t, tuning.count) + (t < (tuning.count - 1) / 2 ? 2 : -2) * symbolSpacing(tuning.count)
  return (reste: number) => Math.abs(reste - voulu) < 0.2 * symbolSpacing(tuning.count)
}

describe('PendulumActivity : consigne et accessibilité', () => {
  it('l’invite (région aria-live polie) demande le symbole visé, qui est l’un des symboles affichés', async () => {
    const w = await monter()
    expect(symboles(w)).toHaveLength(tuning.count)
    expect(cible(w)).toBeGreaterThanOrEqual(0)
    expect(w.findAll('[data-target]')).toHaveLength(1)
    expect(invite(w).text()).toMatch(/^Arrêtez le pendule sur (la|le|l’)/)
    expect(invite(w).attributes('aria-live')).toBe('polite')
  })

  it('le cristal est un bouton réel « Arrêter le pendule », seul bouton de l’activité, focalisé au montage, décrit par les gestes', async () => {
    const w = await monter()
    const b = bouton(w)
    expect(b.element.tagName).toBe('BUTTON')
    expect(b.attributes('type')).toBe('button')
    expect(b.attributes('aria-label')).toBe('Arrêter le pendule')
    expect(w.findAll('button.crystal-hit')).toHaveLength(1) // plus de gros bouton sous le demi-cercle
    expect(b.element.closest('.crystal-pos')).not.toBeNull() // enfant du bras qui tourne : il suit le cristal
    expect(w.get('[data-testid="pendulum-hint"]').text()).toMatch(/^(Cliquez sur|Touchez) le pendule$/)
    expect(document.activeElement).toBe(b.element)
    expect(w.get(`#${b.attributes('aria-describedby')}`).text()).toBe(PENDULUM_TEXTS.help)
    expect(b.attributes('tabindex')).toBeUndefined()
  })

  it('le dessin est caché aux lecteurs d’écran (sauf le cristal-bouton) ; le HUD annonce l’issue', async () => {
    const w = await monter()
    expect(w.get('.board').attributes('aria-hidden')).toBe('true')
    expect(w.get('.crystal').attributes('aria-hidden')).toBe('true')
    expect(bouton(w).element.closest('[aria-hidden="true"]')).toBeNull()
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.verb)
  })

  it('le cristal oscille : l’angle varie des deux côtés de la verticale', async () => {
    const w = await monter()
    const angles: number[] = []
    for (let t = 0; t < 6000; t += 100) {
      await avancer(100)
      angles.push(angleCss(w))
    }
    expect(Math.min(...angles)).toBeLessThan(-0.8)
    expect(Math.max(...angles)).toBeGreaterThan(0.8)
  })

  it('aucun clignotement : le symbole visé luit par une animation de 1,2 s ou plus par sens (0,42 Hz)', async () => {
    // La durée de l’animation est écrite dans le CSS du composant (aller-retour de 1,2 s) ; on garde ici la constante qu’elle suppose.
    const hz = 1 / (2 * 1.2)
    expect(hz).toBeLessThanOrEqual(0.5)
  })
})

describe('PendulumActivity : arrêt', () => {
  it.each([
    ['Espace', ' '],
    ['Entrée', 'Enter'],
  ])('%s arrête le pendule dès l’appui et empêche l’action par défaut', async (_nom, key) => {
    const w = await monter()
    const e = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true })
    bouton(w).element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(suivi.state!.stopped).toBe(false) // la boucle applique l’arrêt à l’image suivante
    await avancer(16)
    expect(suivi.state!.stopped).toBe(true)
    await avancer(1000)
    expect(suivi.state!.rest).toBe(true)
  })

  it('une autre touche est ignorée et non interceptée ; la répétition de touche aussi', async () => {
    const w = await monter()
    const a = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true })
    bouton(w).element.dispatchEvent(a)
    expect(a.defaultPrevented).toBe(false)
    await bouton(w).trigger('keydown', { key: ' ', repeat: true })
    await avancer(100)
    expect(suivi.state!.stopped).toBe(false)
  })

  it('le relâchement d’Espace n’agit pas (le clic natif de la touche est supprimé)', async () => {
    const w = await monter()
    const e = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true })
    bouton(w).element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    await avancer(100)
    expect(suivi.state!.stopped).toBe(false)
  })

  it('l’appui de souris ou de doigt (pointerdown) arrête ; le clic qui suit (detail > 0) ne compte pas deux fois', async () => {
    const w = await monter()
    await bouton(w).trigger('pointerdown', { button: 0, pointerType: 'touch' })
    await avancer(16)
    expect(suivi.state!.stopped).toBe(true)
    const avant = suivi.steps
    await bouton(w).trigger('click', { detail: 1 })
    await avancer(100)
    expect(suivi.steps).toBeGreaterThan(avant)
  })

  it('un appui à côté du cristal (fond, scène) n’arrête rien et rend le focus au cristal', async () => {
    const w = await monter()
    ;(document.activeElement as HTMLElement).blur()
    await w.get('[data-testid="pendulum-stage"]').trigger('pointerdown', { button: 0 })
    await w.get('[data-testid="pendulum-scene"]').trigger('pointerdown', { button: 0 })
    await w.get('.board').trigger('pointerdown', { button: 0 })
    await avancer(100)
    expect(suivi.state!.stopped).toBe(false)
    expect(document.activeElement).toBe(bouton(w).element)
  })

  it('un autre bouton de souris n’arrête pas', async () => {
    const w = await monter()
    await bouton(w).trigger('pointerdown', { button: 2 })
    await avancer(100)
    expect(suivi.state!.stopped).toBe(false)
  })

  it('un clic sans appui préalable (lecteur d’écran, detail 0) arrête ; juste après une touche, il est ignoré', async () => {
    const w = await monter()
    await bouton(w).trigger('click')
    await avancer(16)
    expect(suivi.state!.stopped).toBe(true)
  })

  it('le clic natif d’Espace, qui suit la touche déjà traitée, n’arrête pas une seconde fois après la relance', async () => {
    const w = await monter()
    await appuyerQuand(w, () => true)
    await avancer(16)
    await bouton(w).trigger('click') // clic synthétisé par le navigateur au relâchement : ignoré (garde de 600 ms)
    expect(suivi.state!.stopped).toBe(true)
  })

  it('le cristal glisse encore après l’appui puis s’immobilise sur place, sans retour au centre', async () => {
    const w = await monter()
    await appuyerQuand(w, (r) => Math.abs(r) > 0.5)
    await avancer(16)
    const avant = suivi.state!.theta
    await avancer(900)
    const fin = suivi.state!
    expect(fin.rest).toBe(true)
    expect(Math.abs(fin.theta)).toBeGreaterThan(0.3)
    expect(Math.abs(fin.theta - avant)).toBeGreaterThan(0.02)
    expect(angleCss(w)).toBeCloseTo(fin.theta, 3)
  })

  it('un second appui pendant la glissade ne change rien', async () => {
    const w = await monter()
    await appuiClavier(w)
    await avancer(16)
    const e = suivi.state!
    await appuiClavier(w)
    await avancer(16)
    expect(suivi.state!.stopped).toBe(true)
    expect(Math.abs(suivi.state!.theta - e.theta)).toBeLessThan(0.1)
  })
})

describe('PendulumActivity : issue', () => {
  it('arrêté sur le symbole visé : il s’illumine, la réussite est annoncée, la fin est émise après l’issue', async () => {
    const w = await monter()
    expect(await appuyerQuand(w, surCible(w))).toBe(true)
    for (let t = 0; t < 2000 && !hud(w).text().includes(ACTIVITY_PROMPTS.pendulum.win); t += 16) await avancer(16)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.win)
    expect(w.get('[role="status"]').text()).toBe(ACTIVITY_PROMPTS.pendulum.win)
    expect(symboles(w)[cible(w)].attributes('data-lit')).toBeDefined()
    expect(symboles(w)[cible(w)].classes()).toContain('lit')
    expect(invite(w).classes()).toContain('invisible')
    expect(animate).toHaveBeenCalledWith(expect.anything(), { scale: [1, 1.4, 1.25] }, expect.anything())
    expect(bouton(w).attributes('aria-disabled')).toBe('true')
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 100)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('une fois gagné, le cristal reste immobile sur le symbole et un nouvel appui n’y change rien', async () => {
    const w = await monter()
    await appuyerQuand(w, surCible(w))
    await avancer(1500)
    const theta = suivi.state!.theta
    expect(heldSymbol(theta, tuning.count, tuning.ratio)).toBe(cible(w))
    await appuiClavier(w)
    await avancer(2000)
    expect(suivi.state!.theta).toBe(theta)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('un raté : message qui nomme le symbole retenu et répète la consigne, puis relance du pendule ; il reste un essai', async () => {
    const w = await monter()
    expect(await appuyerQuand(w, ratee(w))).toBe(true)
    await avancer(1000)
    expect(suivi.state!.rest).toBe(true)
    expect(invite(w).text()).toMatch(/^Pas (la|le|l’).+\. Dernière chance : arrêtez le pendule sur /)
    expect(w.find('.slot.missed').exists()).toBe(true)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.pendulum.fail)
    // Relance (1,1 s après l’immobilisation) : le cristal repart sans sauter de position.
    const theta = suivi.state!.theta
    for (let t = 0; t < 2000 && suivi.state!.rest; t += 16) await avancer(16)
    expect(suivi.state!.rest).toBe(false)
    expect(Math.abs(suivi.state!.theta - theta)).toBeLessThan(0.05)
    expect(w.find('.slot.missed').exists()).toBe(false)
    // La seconde chance peut réussir.
    expect(await appuyerQuand(w, surCible(w))).toBe(true)
    await avancer(1500)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.win)
  })

  it('deux ratés : échec annoncé tout de suite (sans attendre la minuterie), cristal immobile, fin émise', async () => {
    const w = await monter()
    const t0 = Date.now()
    await appuyerQuand(w, ratee(w))
    await avancer(1000 + 1100 + 300)
    await appuyerQuand(w, ratee(w))
    await avancer(1000)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.fail)
    expect(w.get('[role="status"]').text()).toBe(ACTIVITY_PROMPTS.pendulum.fail)
    expect(suivi.state!.rest).toBe(true)
    expect(symboles(w).some((s) => s.attributes('data-lit') !== undefined)).toBe(false)
    await avancer(OUTCOME_MS + 100)
    expect(w.emitted('done')).toHaveLength(1)
    // Restait beaucoup de temps : l’échec vient des essais, pas de la minuterie.
    expect(Date.now() - t0).toBeLessThan(durationOf('pendulum'))
  })

  it('arrêté entre deux symboles (niveau serré) : « Entre deux signes », et c’est un essai de moins', async () => {
    const w = await monter(5)
    const n = tuningFor(5).count
    const ratio = tuningFor(5).ratio
    const p5 = paramsFor(tuningFor(5))
    // Milieu de deux symboles voisins : hors de toute zone.
    const mid = (symbolAngle(3, n) + symbolAngle(4, n)) / 2
    let fait = false
    for (let t = 0; t < 12_000 && !fait; t += 16) {
      if (suivi.state && !suivi.state.rest && !suivi.state.stopped && Math.abs(restAngle(suivi.state, p5) - mid) < 0.03) {
        await appuiClavier(w)
        fait = true
      } else await avancer(16)
    }
    expect(fait).toBe(true)
    expect(heldSymbol(mid, n, ratio)).toBeNull()
    await avancer(1000)
    expect(invite(w).text()).toMatch(/^Entre deux signes\. Dernière chance/)
  })

  it('temps écoulé sans arrêt : échec de la minuterie, et le cristal finit par s’arrêter de lui-même', async () => {
    const w = await monter()
    await avancer(durationOf('pendulum') + ACTIVITY_GRACE_MS + 200)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.fail)
    await avancer(1000)
    expect(suivi.state!.rest).toBe(true)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('l’appui est ignoré une fois l’issue rendue', async () => {
    const w = await monter()
    await avancer(durationOf('pendulum') + ACTIVITY_GRACE_MS + 1500)
    await appuiClavier(w)
    await avancer(200)
    expect(w.emitted('done')).toHaveLength(1)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.fail)
  })
})

describe('PendulumActivity : pause', () => {
  it('en pause, le cristal est gelé (angle, état, minuterie) ; il reprend là où il était à « Reprendre »', async () => {
    const w = await monter()
    await avancer(700)
    fenetrePerdFocus()
    await avancer(50)
    expect(w.text()).toContain('EN PAUSE')
    const fige = angleCss(w)
    const pas = suivi.steps
    await avancer(5000)
    expect(angleCss(w)).toBe(fige)
    expect(suivi.steps).toBe(pas)
    await reprendre(w)
    await avancer(300)
    expect(suivi.steps).toBeGreaterThan(pas)
    expect(angleCss(w)).not.toBe(fige)
  })

  it('en pause, un appui n’arrête rien', async () => {
    const w = await monter()
    await avancer(300)
    fenetrePerdFocus()
    await avancer(50)
    await appuiClavier(w)
    await bouton(w).trigger('pointerdown', { button: 0 })
    await reprendre(w)
    await avancer(100)
    expect(suivi.state!.stopped).toBe(false)
  })

  it('la relance après un raté attend la fin de la pause', async () => {
    const w = await monter()
    await appuyerQuand(w, ratee(w))
    await avancer(1000)
    expect(suivi.state!.rest).toBe(true)
    fenetrePerdFocus() // pendant les 1,1 s d’attente avant la relance
    await avancer(50)
    await avancer(5000)
    expect(suivi.state!.rest).toBe(true)
    await reprendre(w)
    await avancer(300)
    expect(suivi.state!.rest).toBe(false)
  })
})

describe('PendulumActivity : mouvement réduit et niveaux', () => {
  it('mouvement normal : traînée de six copies du cristal', async () => {
    const w = await monter()
    expect(w.findAll('.ghost-arm')).toHaveLength(6)
  })

  it('mouvement réduit : aucune traînée, balancement plus lent, toujours jouable', async () => {
    mouvementReduit(true)
    const w = await monter()
    expect(w.findAll('.ghost-arm')).toHaveLength(0)
    // Plus lent : après 1 s, le cristal est moins loin du point bas qu’au mouvement normal (même départ, période 1,5 fois plus longue).
    const reduit = Math.abs(suivi.state!.omega)
    expect(reduit).toBeGreaterThan(0)
    const lent = paramsFor(tuning, true)
    const vif = paramsFor(tuning)
    expect(lent.w2).toBeLessThan(vif.w2)
    // Jouable : un arrêt bien visé gagne.
    const pLent = paramsFor(tuning, true)
    let gagne = false
    for (let t = 0; t < 15_000 && !gagne; t += 16) {
      if (suivi.state && !suivi.state.rest && !suivi.state.stopped && surCible(w)(restAngle(suivi.state, pLent))) {
        await appuiClavier(w)
        gagne = true
      } else await avancer(16)
    }
    expect(gagne).toBe(true)
    await avancer(1500)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.pendulum.win)
  })

  it('le nombre de symboles suit le niveau (2 à 5) et se borne hors de cet intervalle', async () => {
    for (const [level, n] of [
      [2, 5],
      [3, 6],
      [4, 7],
      [5, 8],
      [1, 5],
      [9, 8],
    ] as const) {
      const w = await monter(level)
      expect(symboles(w), `niveau ${level}`).toHaveLength(n)
      w.unmount()
      wrapper = undefined
      document.body.innerHTML = ''
    }
  })

  it('même graine, même disposition ; autre graine, autre disposition', async () => {
    const ordre = async (seed: number) => {
      const w = await monter(LEVEL, seed)
      const o = `${cible(w)}|${w
        .findAll('[data-testid="pendulum-symbol"] svg')
        .map((s) => s.html().length)
        .join(',')}`
      w.unmount()
      wrapper = undefined
      document.body.innerHTML = ''
      return o
    }
    expect(await ordre(5)).toBe(await ordre(5))
    const autres = new Set([await ordre(1), await ordre(2), await ordre(3), await ordre(4)])
    expect(autres.size).toBeGreaterThan(1)
  })
})

describe('lazy : chargeur du pendule', () => {
  it('activityFor charge le composant du pendule', async () => {
    const module = await activityFor('pendulum' as never)!()
    expect(module.default).toBeDefined()
  })
})
