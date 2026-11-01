// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import WispsActivity from '@/components/activities/WispsActivity.vue'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, durationOf } from '@/engine/activityTiming'
import { avancer, evenementPointeur, fenetrePerdFocus, horloge, mouvementReduit, rect, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) : le HUD appelle `animate`, on le neutralise.
vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })) }))
// Pas de mise en page dans happy-dom : la scène mesure 800 × 600.
vi.mock('@vueuse/core', async (importOriginal) => ({ ...(await importOriginal<typeof import('@vueuse/core')>()), useElementSize: () => ({ width: ref(800), height: ref(600) }) }))
// Aléa déterministe : le feu follet suit une suite fixe.
vi.mock('@/engine/rng', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/engine/rng')>()
  return { ...orig, secureRng: () => orig.mulberry32(5) }
})

// Position du feu follet : le rendu de Motion ne suit pas les fausses horloges, on lit donc ce que le composant calcule
// (`nextWaypoint` = apparition ou saut en mouvement réduit, `stepWisp` = chaque image).
const suivi = vi.hoisted(() => ({ pos: null as { x: number; y: number } | null }))
vi.mock('@/engine/wisps', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/engine/wisps')>()
  return {
    ...orig,
    nextWaypoint: (...a: Parameters<typeof orig.nextWaypoint>) => {
      const p = orig.nextWaypoint(...a)
      suivi.pos = p
      return p
    },
    stepWisp: (...a: Parameters<typeof orig.stepWisp>) => {
      const r = orig.stepWisp(...a)
      suivi.pos = r.pos
      return r
    },
  }
})

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  suivi.pos = null
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

const monter = async (level = 1) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(WispsActivity, { props: { level }, attachTo: document.body, global: { plugins: [pinia] } })
  const stage = wrapper.get('[data-testid="wisps-stage"]').element as HTMLElement
  stage.getBoundingClientRect = () => rect(0, 0, 800, 600)
  await avancer(200) // les écouteurs s’attachent, le premier feu follet apparaît et l’invite se remplit
  return wrapper
}
const scene = (w: VueWrapper) => w.get('[data-testid="wisps-stage"]').element
const orbe = (w: VueWrapper) => w.find('.wisp-wrap')
const position = (_w?: VueWrapper) => suivi.pos
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')
const invite = (w: VueWrapper) => w.get('p[aria-live="polite"]')
const attraper = (w: VueWrapper) => w.get('button')
const bouton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Attraper le feu follet')!

// Suit le feu follet avec le pointeur jusqu’à la capture (le feu ralentit près du pointeur) ; renvoie le nombre d’images utilisées.
const suivre = async (w: VueWrapper, maxMs = 6000, type = 'mouse') => {
  for (let t = 0; t < maxMs; t += 16) {
    const p = position(w)
    if (p) scene(w).dispatchEvent(evenementPointeur('pointermove', { clientX: p.x, clientY: p.y + (type === 'touch' ? 40 : 0), pointerType: type }))
    await avancer(16)
    if (w.find('.wisp-bloom').exists()) return t
  }
  return -1
}

describe('WispsActivity : capture', () => {
  it('un feu follet apparaît dans la scène, dans les marges, et l’invite compte 0/3', async () => {
    const w = await monter()
    const p = position(w)!
    expect(p.x).toBeGreaterThanOrEqual(56)
    expect(p.x).toBeLessThanOrEqual(744)
    expect(p.y).toBeGreaterThanOrEqual(56)
    expect(p.y).toBeLessThanOrEqual(544)
    expect(invite(w).text()).toBe('Touchez ou cliquez sur les trois feux follets (0/3).')
  })

  it('le feu follet bouge d’une image à l’autre (il n’est pas figé)', async () => {
    const w = await monter()
    const a = position(w)!
    await avancer(1500)
    const b = position(w)!
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1)
  })

  it('tenir le pointeur sur le feu follet le capture ; le suivant reparaît après 700 ms', async () => {
    const w = await monter()
    expect(await suivre(w)).toBeGreaterThan(0)
    expect(invite(w).text()).toContain('(1/3)')
    expect(w.find('.wisp-bloom').exists()).toBe(true)
    await avancer(800)
    expect(w.find('.wisp-bloom').exists()).toBe(false)
    expect(w.emitted('done')).toBeUndefined()
  })

  it('un clic (pointerdown) sur le feu follet le capture sur-le-champ', async () => {
    const w = await monter()
    const p = position(w)!
    scene(w).dispatchEvent(evenementPointeur('pointerdown', { clientX: p.x, clientY: p.y }))
    await avancer(16)
    expect(w.find('.wisp-bloom').exists()).toBe(true)
    expect(invite(w).text()).toContain('(1/3)')
  })

  it('un clic loin du feu follet ne capture rien', async () => {
    const w = await monter()
    const p = position(w)!
    scene(w).dispatchEvent(evenementPointeur('pointerdown', { clientX: p.x < 400 ? 790 : 10, clientY: p.y < 300 ? 590 : 10 }))
    await avancer(16)
    expect(w.find('.wisp-bloom').exists()).toBe(false)
  })

  it('les trois captures réussissent l’activité : issue annoncée puis fin émise', async () => {
    const w = await monter()
    for (let n = 1; n <= 3; n++) {
      const p = position(w)!
      scene(w).dispatchEvent(evenementPointeur('pointerdown', { clientX: p.x, clientY: p.y }))
      await avancer(800)
    }
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.wisps.win)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
    // L’invite se vide, le bouton clavier devient inerte.
    expect(invite(w).classes()).toContain('invisible')
    expect(bouton(w).attributes('aria-disabled')).toBe('true')
  })

  it('le bouton clavier « Attraper le feu follet » capture ; pendant la floraison, un second appui est ignoré', async () => {
    const w = await monter()
    await bouton(w).trigger('click')
    await bouton(w).trigger('click')
    expect(invite(w).text()).toContain('(1/3)')
  })

  it('sans feu follet visible, le bouton clavier ne fait rien', async () => {
    const w = await monter()
    await bouton(w).trigger('click') // capture : le suivant n’apparaît qu’après 700 ms
    await avancer(100)
    await bouton(w).trigger('click')
    expect(invite(w).text()).toContain('(1/3)')
  })
})

describe('WispsActivity : pointeur et toucher', () => {
  it('au toucher, un guide apparaît 40 px au-dessus du doigt et la prise dure 300 ms après le relâchement', async () => {
    const w = await monter()
    expect(w.find('.wisp-guide').exists()).toBe(false)
    scene(w).dispatchEvent(evenementPointeur('pointermove', { clientX: 100, clientY: 200, pointerType: 'touch' }))
    await avancer(16)
    expect(w.find('.wisp-guide').exists()).toBe(true)
    scene(w).dispatchEvent(evenementPointeur('pointerup', { clientX: 100, clientY: 200, pointerType: 'touch' }))
    scene(w).dispatchEvent(evenementPointeur('pointerleave', { clientX: 100, clientY: 200, pointerType: 'touch' }))
    await avancer(200)
    expect(w.find('.wisp-guide').exists()).toBe(true)
    await avancer(200)
    expect(w.find('.wisp-guide').exists()).toBe(false)
  })

  it('le toucher suit le feu follet avec le guide et le capture', async () => {
    const w = await monter()
    expect(await suivre(w, 8000, 'touch')).toBeGreaterThan(0)
    expect(invite(w).text()).toContain('(1/3)')
  })

  it('la souris qui quitte la scène retire la visée ; pointercancel aussi ; le stylet relâche', async () => {
    const w = await monter()
    scene(w).dispatchEvent(evenementPointeur('pointermove', { clientX: 5, clientY: 5, pointerType: 'touch' }))
    await avancer(16)
    expect(w.find('.wisp-guide').exists()).toBe(true)
    scene(w).dispatchEvent(evenementPointeur('pointercancel', { clientX: 5, clientY: 5, pointerType: 'touch' }))
    await avancer(16)
    expect(w.find('.wisp-guide').exists()).toBe(false)
    scene(w).dispatchEvent(evenementPointeur('pointermove', { clientX: 5, clientY: 5, pointerType: 'touch' }))
    scene(w).dispatchEvent(evenementPointeur('pointerleave', { clientX: 5, clientY: 5, pointerType: 'mouse' }))
    await avancer(16)
    expect(w.find('.wisp-guide').exists()).toBe(false)
    scene(w).dispatchEvent(evenementPointeur('pointerup', { clientX: 5, clientY: 5, pointerType: 'pen' }))
    scene(w).dispatchEvent(evenementPointeur('pointerup', { clientX: 5, clientY: 5, pointerType: 'mouse' }))
    await avancer(16)
  })
})

describe('WispsActivity : mouvement réduit', () => {
  it('pas de traînée ; le feu follet disparaît en fondu puis saute ailleurs, et reste capturable', async () => {
    mouvementReduit(true)
    const w = await monter()
    expect(w.findAll('.wisp-trail')).toHaveLength(0)
    const departs = new Set<string>()
    let cache = 0
    let visible = 0
    for (let t = 0; t < 6000; t += 100) {
      await avancer(100)
      departs.add(JSON.stringify(position(w)))
      if (orbe(w).classes().includes('wisp-hidden')) cache++
      else visible++
    }
    // Plusieurs sauts en 6 s, avec des périodes cachées et visibles.
    expect(departs.size).toBeGreaterThan(1)
    expect(cache).toBeGreaterThan(0)
    expect(visible).toBeGreaterThan(cache)
    // Tenir le pointeur sur place : la capture se fait quand même.
    for (let t = 0; t < 4000 && !w.find('.wisp-bloom').exists(); t += 16) {
      const p = position(w)!
      scene(w).dispatchEvent(evenementPointeur('pointermove', { clientX: p.x, clientY: p.y }))
      await avancer(16)
    }
    expect(w.find('.wisp-bloom').exists()).toBe(true)
  })

  it('le bouton clavier est ignoré pendant le fondu', async () => {
    mouvementReduit(true)
    const w = await monter()
    for (let t = 0; t < 6000 && !orbe(w).classes().includes('wisp-hidden'); t += 16) await avancer(16)
    expect(orbe(w).classes()).toContain('wisp-hidden')
    await bouton(w).trigger('click')
    expect(invite(w).text()).toContain('(0/3)')
    expect(w.find('.wisp-bloom').exists()).toBe(false)
  })
})

describe('WispsActivity : issue et pause', () => {
  it('sans capture, l’échec arrive à la fin du temps', async () => {
    const w = await monter()
    await avancer(durationOf('wisps') + ACTIVITY_GRACE_MS + 100)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.wisps.fail)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('la pause fige le feu follet et la minuterie ; « Reprendre » les relance', async () => {
    const w = await monter()
    await avancer(300)
    fenetrePerdFocus()
    await avancer(50)
    const a = position(w)!
    await avancer(30_000)
    const b = position(w)!
    expect(b).toEqual(a)
    expect(w.text()).toContain('EN PAUSE')
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.wisps.fail)
    await reprendre(w)
    await avancer(1500)
    const c = position(w)!
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeGreaterThan(1)
  })

  it('le feu follet capturé pendant une pause ne reparaît qu’à la reprise', async () => {
    const w = await monter()
    await bouton(w).trigger('click')
    fenetrePerdFocus()
    await avancer(3000)
    expect(w.find('.wisp-bloom').exists()).toBe(true)
    await reprendre(w)
    await avancer(900)
    expect(w.find('.wisp-bloom').exists()).toBe(false)
    expect(attraper(w).element).toBeTruthy()
  })
})
