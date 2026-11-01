// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CandlesActivity from '@/components/activities/CandlesActivity.vue'
import { mulberry32 } from '@/engine/rng'
import { HOLD_MS } from '@/engine/candles'
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
const eteintes = (w: VueWrapper) => chandelles(w).flatMap((c, i) => (c.attributes('aria-label')?.endsWith('allumée') ? [] : [i]))

// Événement du pointeur principal par défaut (happy-dom ne remplit pas `isPrimary`) ; `isPrimary: false` simule un second doigt.
const pointeur = (type: string, init: Parameters<typeof evenementPointeur>[1] & { isPrimary?: boolean }) => {
  const { isPrimary = true, ...reste } = init
  return Object.assign(evenementPointeur(type, reste), { isPrimary })
}
// Activation au clavier (Entrée ou Espace) : un `click` sans `detail`. Un clic de souris ou un tap a `detail` = 1.
const activer = (c: ReturnType<typeof chandelles>[number]) => c.trigger('click', { detail: 0 })
const cliquer = (c: ReturnType<typeof chandelles>[number]) => c.trigger('click', { detail: 1 })

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
  w.element.dispatchEvent(pointeur('pointermove', { clientX: m.x, clientY: m.y + 20 }))
}

describe('CandlesActivity : allumage', () => {
  it('trois activations au clavier allument les trois chandelles, puis réussite et fin émise après l’issue', async () => {
    const w = await monter()
    await avancer(200)
    expect(invite(w).text()).toBe('Tenez l’allumette sur chaque mèche')
    expect(allumees(w)).toHaveLength(0)
    for (const [i, c] of chandelles(w).entries()) {
      await activer(c)
      expect(allumees(w)).toHaveLength(i + 1)
    }
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('un clic de souris ou un tap bref n’allume pas : trois taps ne gagnent plus', async () => {
    const w = await monter()
    for (const c of chandelles(w)) await cliquer(c)
    await avancer(1500)
    expect(allumees(w)).toHaveLength(0)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.win)
    expect(w.emitted('done')).toBeUndefined()
  })

  it('une seconde activation sur une chandelle déjà allumée ne change rien', async () => {
    const w = await monter()
    const [premiere] = chandelles(w)
    await activer(premiere)
    await activer(premiere)
    expect(allumees(w)).toHaveLength(1)
  })

  it('l’allumette tenue 600 ms sur une mèche l’allume ; moins longtemps, ou ailleurs, rien ne s’allume', async () => {
    const w = await monter()
    mesurer(w)
    approcher(w, 1)
    await avancer(HOLD_MS - 200)
    expect(allumees(w)).toHaveLength(0)
    // Partie en vue de la mèche : la progression redescend, rien ne s’allume.
    w.element.dispatchEvent(pointeur('pointermove', { clientX: 10, clientY: 10 }))
    await avancer(700)
    expect(allumees(w)).toHaveLength(0)
    approcher(w, 1)
    await avancer(HOLD_MS - 100)
    expect(allumees(w)).toHaveLength(0)
    await avancer(200)
    expect(allumees(w).map((c) => c.attributes('aria-label'))).toEqual(['Chandelle 2 allumée'])
  })

  it('tenir l’allumette sur les trois mèches, l’une après l’autre, gagne la partie', async () => {
    const w = await monter()
    mesurer(w)
    for (let i = 0; i < 3; i++) {
      approcher(w, i)
      await avancer(HOLD_MS + 150)
    }
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
  })

  it('le pointeur qui quitte la scène (souris) retire l’allumette ; au toucher, la prise dure 300 ms', async () => {
    const w = await monter()
    mesurer(w)
    approcher(w, 0)
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-100')
    w.element.dispatchEvent(pointeur('pointerleave', { clientX: 0, clientY: 0 }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-0')

    w.element.dispatchEvent(pointeur('pointerdown', { clientX: meche(0).x, clientY: meche(0).y + 20, pointerType: 'touch' }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-100')
    w.element.dispatchEvent(pointeur('pointerup', { clientX: 0, clientY: 0, pointerType: 'touch' }))
    w.element.dispatchEvent(pointeur('pointerleave', { clientX: 0, clientY: 0, pointerType: 'touch' }))
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
    w.element.dispatchEvent(pointeur('pointercancel', { clientX: 0, clientY: 0 }))
    await avancer(16)
    expect(w.get('.match').classes()).toContain('opacity-0')
    expect(w.findAll('.wick-glow')[2].attributes('style')).toContain('opacity: 0')
  })

  it('un second doigt ne conduit pas l’allumette et ne la fait pas disparaître', async () => {
    const w = await monter()
    mesurer(w)
    // Un doigt secondaire seul : l’allumette n’apparaît pas.
    w.element.dispatchEvent(pointeur('pointermove', { clientX: meche(0).x, clientY: meche(0).y + 20, isPrimary: false, pointerId: 2 }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-0')
    // Le doigt principal pose l’allumette ; le relâchement du second ne la retire pas.
    w.element.dispatchEvent(pointeur('pointerdown', { clientX: meche(1).x, clientY: meche(1).y + 20, pointerType: 'touch' }))
    await avancer(50)
    expect(w.get('.match').classes()).toContain('opacity-100')
    w.element.dispatchEvent(pointeur('pointerup', { clientX: 0, clientY: 0, pointerType: 'touch', isPrimary: false, pointerId: 2 }))
    w.element.dispatchEvent(pointeur('pointercancel', { clientX: 0, clientY: 0, isPrimary: false, pointerId: 2 }))
    await avancer(600)
    expect(w.get('.match').classes()).toContain('opacity-100')
    // Le second doigt ne déplace pas non plus l’allumette : elle reste tenue sur la mèche 2 et l’allume.
    w.element.dispatchEvent(pointeur('pointermove', { clientX: 10, clientY: 10, pointerType: 'touch', isPrimary: false, pointerId: 2 }))
    await avancer(300)
    expect(allumees(w).map((c) => c.attributes('aria-label'))).toEqual(['Chandelle 2 allumée'])
  })

  it('la scène mesure au pointerdown et à l’entrée, pas à chaque mouvement', async () => {
    const w = await monter()
    const scene = w.element as HTMLElement
    let mesures = 0
    scene.getBoundingClientRect = () => (mesures++, rect(0, 0, 800, 600))
    chandelles(w).forEach((c, i) => ((c.element as HTMLElement).getBoundingClientRect = () => rect(200 + i * 160, 300, 72, 176)))
    scene.dispatchEvent(pointeur('pointerenter', { clientX: 5, clientY: 5 }))
    for (let k = 0; k < 20; k++) scene.dispatchEvent(pointeur('pointermove', { clientX: 5 + k, clientY: 5 }))
    expect(mesures).toBe(1)
    scene.dispatchEvent(pointeur('pointerdown', { clientX: 5, clientY: 5 }))
    expect(mesures).toBe(2)
  })
})

describe('CandlesActivity : tenue au toucher', () => {
  const toutAllumer = async (w: VueWrapper) => {
    for (const c of chandelles(w)) await activer(c)
  }

  it('une chandelle tenue au doigt n’est jamais soufflée, et seul son doigt la libère', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    const [a, b, c] = chandelles(w)
    // Trois doigts, trois chandelles : toutes protégées, le courant d’air attend.
    await a.trigger('pointerdown', { pointerId: 1 })
    await b.trigger('pointerdown', { pointerId: 2 })
    await c.trigger('pointerdown', { pointerId: 3 })
    await avancer(1500)
    expect(allumees(w)).toHaveLength(3)
    // Un doigt qui se lève ne libère que sa chandelle : c’est la seule qui peut être soufflée.
    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 2 }))
    await avancer(600)
    expect(eteintes(w)).toEqual([1])
  })

  it('un pointercancel libère lui aussi seulement le pointeur concerné', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    const [a, b, c] = chandelles(w)
    await a.trigger('pointerdown', { pointerId: 1 })
    await b.trigger('pointerdown', { pointerId: 2 })
    await c.trigger('pointerdown', { pointerId: 3 })
    window.dispatchEvent(Object.assign(new Event('pointercancel'), { pointerId: 3 }))
    await avancer(600)
    expect(eteintes(w)).toEqual([2])
  })
})

describe('CandlesActivity : niveaux 3 à 5 (courant d’air)', () => {
  const toutAllumer = async (w: VueWrapper) => {
    for (const c of chandelles(w)) await activer(c)
  }
  const tenirSurLaMeche = async (w: VueWrapper, i: number) => {
    approcher(w, i)
    await avancer(HOLD_MS + 150)
  }

  it('une chandelle s’éteint après la troisième ; la rallumer à la main termine l’activité', async () => {
    const w = await monter(3)
    mesurer(w)
    await toutAllumer(w)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(500)
    expect(allumees(w)).toHaveLength(2)
    await avancer(200)
    expect(invite(w).text()).toBe('Un courant d’air… Rallumez la chandelle.')
    expect(w.find('.smoke').exists()).toBe(true)
    await tenirSurLaMeche(w, eteintes(w)[0])
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('niveau 3 : sans rallumage après 4 s, la chandelle se rallume seule et l’activité réussit', async () => {
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

  it('niveaux 4 et 5 : aucun rallumage automatique, la chandelle soufflée reste éteinte jusqu’à ce qu’on la rallume', async () => {
    for (const level of [4, 5]) {
      const w = await monter(level)
      mesurer(w)
      await toutAllumer(w)
      await avancer(600)
      expect(allumees(w)).toHaveLength(2)
      await avancer(6000)
      expect(allumees(w)).toHaveLength(2)
      expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.win)
      expect(w.emitted('done')).toBeUndefined()
      await tenirSurLaMeche(w, eteintes(w)[0])
      expect(allumees(w)).toHaveLength(3)
      expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
      w.unmount()
      wrapper = undefined
    }
  })

  it('niveau 5 : une chandelle soufflée jamais rallumée mène à l’échec au temps', async () => {
    const w = await monter(5)
    await toutAllumer(w)
    await avancer(durationOf('candles') + ACTIVITY_GRACE_MS + 100)
    expect(allumees(w)).toHaveLength(2)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.fail)
  })

  it('la troisième chandelle allumée dans les dernières secondes donne la victoire, pas « Le courant d’air a gagné »', async () => {
    for (const level of [3, 5]) {
      const w = await monter(level)
      await activer(chandelles(w)[0])
      await activer(chandelles(w)[1])
      // Il reste 3 s : trop peu pour souffler puis rallumer.
      await avancer(ACTIVITY_GRACE_MS + durationOf('candles') - 3000)
      await activer(chandelles(w)[2])
      expect(allumees(w)).toHaveLength(3)
      expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
      await avancer(5000)
      expect(allumees(w)).toHaveLength(3)
      expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.fail)
      expect(w.emitted('done')).toHaveLength(1)
      w.unmount()
      wrapper = undefined
    }
  })

  it('la troisième allumée à la limite des 4,5 s restantes arme encore le courant d’air', async () => {
    const w = await monter(5)
    await activer(chandelles(w)[0])
    await activer(chandelles(w)[1])
    await avancer(ACTIVITY_GRACE_MS + durationOf('candles') - 4600)
    await activer(chandelles(w)[2])
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.win)
    await avancer(500)
    expect(allumees(w)).toHaveLength(2)
  })

  it('toutes les chandelles protégées : pas de relance sans fin, la victoire arrive quand il ne reste plus de quoi rallumer', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    for (const c of chandelles(w)) await c.trigger('pointerenter')
    await avancer(1500)
    expect(allumees(w)).toHaveLength(3)
    // Le courant d’air réessaie tant qu’il reste du temps, puis cède : les trois allumées gagnent avant la fin du temps.
    await avancer(ACTIVITY_GRACE_MS + durationOf('candles') - 1500 - 2000)
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.candles.fail)
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

  it('le courant d’air n’arrive qu’une fois : rallumer la chandelle soufflée termine, rien ne s’éteint ensuite', async () => {
    const w = await monter(3)
    await toutAllumer(w)
    await avancer(600)
    await activer(chandelles(w)[eteintes(w)[0]])
    await avancer(OUTCOME_MS + 50)
    expect(allumees(w)).toHaveLength(3)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('niveaux 1 et 2 : aucune chandelle soufflée', async () => {
    const w = await monter(2)
    await toutAllumer(w)
    await avancer(800)
    expect(allumees(w)).toHaveLength(3)
  })
})

describe('CandlesActivity : issue et pause', () => {
  it('sans rien faire, l’échec arrive à la fin du temps ; les chandelles restent comme elles sont', async () => {
    const w = await monter()
    await activer(chandelles(w)[0])
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

  it('en pause, le délai du courant d’air est gelé puis repris là où il s’était arrêté (il ne souffle pas d’un coup à la reprise)', async () => {
    const w = await monter(3)
    for (const c of chandelles(w)) await activer(c)
    // 300 ms sur les 450 ms écoulées, puis pause.
    await avancer(300)
    fenetrePerdFocus()
    await avancer(5000)
    expect(allumees(w)).toHaveLength(3)
    await reprendre(w)
    await avancer(100)
    // Il restait 150 ms : à la reprise + 100 ms, pas encore soufflée.
    expect(allumees(w)).toHaveLength(3)
    await avancer(100)
    expect(allumees(w)).toHaveLength(2)
  })

  it('en pause, le rallumage automatique (niveau 3) est gelé puis repris avec son temps restant', async () => {
    const w = await monter(3)
    for (const c of chandelles(w)) await activer(c)
    await avancer(500)
    expect(allumees(w)).toHaveLength(2)
    // 1 s de rallumage écoulée sur 4 s, puis pause de 10 s.
    await avancer(1000)
    fenetrePerdFocus()
    await avancer(10_000)
    expect(allumees(w)).toHaveLength(2)
    await reprendre(w)
    await avancer(2800)
    expect(allumees(w)).toHaveLength(2)
    await avancer(400)
    expect(allumees(w)).toHaveLength(3)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.candles.win)
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

describe('CandlesActivity : mise en page de la consigne (CLS nul)', () => {
  // happy-dom ne fait aucune mise en page : on vérifie la réserve de hauteur (2 lignes) et que la consigne n’est jamais retirée du flux.
  const reservee = (w: VueWrapper) => {
    const p = invite(w)
    expect(p.classes()).toContain('min-h-[2lh]')
    expect(p.classes()).not.toContain('hidden')
    expect(p.element.parentElement).toBe(w.element)
  }

  it('la consigne réserve sa hauteur dès le montage (texte encore vide), après son remplissage et à l’issue', async () => {
    const w = await monter()
    expect(invite(w).text()).toBe('')
    reservee(w)
    await avancer(200)
    expect(invite(w).text()).not.toBe('')
    expect(invite(w).classes()).not.toContain('invisible')
    reservee(w)
    for (const c of chandelles(w)) await activer(c)
    // À l’issue : masquée (invisible) mais pas vidée, la rangée ne bouge pas.
    expect(invite(w).classes()).toContain('invisible')
    expect(invite(w).text()).not.toBe('')
    reservee(w)
    await avancer(OUTCOME_MS + 50)
    reservee(w)
  })

  it('l’échec au temps garde aussi la consigne dans le flux, masquée', async () => {
    const w = await monter()
    await avancer(durationOf('candles') + ACTIVITY_GRACE_MS + 100)
    expect(invite(w).classes()).toContain('invisible')
    expect(invite(w).text()).not.toBe('')
    reservee(w)
  })

  it('le texte de la consigne passe au courant d’air sans changer la réserve de hauteur', async () => {
    const w = await monter(3)
    await avancer(200)
    for (const c of chandelles(w)) await activer(c)
    await avancer(600)
    expect(invite(w).text()).toBe('Un courant d’air… Rallumez la chandelle.')
    reservee(w)
  })
})
