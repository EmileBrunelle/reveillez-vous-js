// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CrystalActivity from '@/components/activities/CrystalActivity.vue'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, durationOf } from '@/engine/activityTiming'
import { createCrystal } from '@/effects/crystal'
import { avancer, evenementPointeur, fenetrePerdFocus, horloge, mouvementReduit, rect, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) : le HUD appelle `animate`, on le neutralise.
vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })) }))

// Effet GPU : le composable est remplacé (pas de WebGPU ici) ; le test garde l’initialiseur du composant et l’état « perdu » pour les piloter.
type DemarrageGpu = (canvas: HTMLCanvasElement, onLost: () => void) => Promise<{ stop: () => void }>
const gpu = vi.hoisted(() => ({ demarrage: null as unknown, options: null as unknown, lost: null as unknown }))
vi.mock('@/composables/useGpuEffect', async () => {
  const { ref: r } = await import('vue')
  return {
    useGpuEffect: (_canvas: unknown, demarrage: unknown, options: unknown) => {
      gpu.demarrage = demarrage
      gpu.options = options
      gpu.lost = r(false)
      return { status: r('starting'), lost: gpu.lost }
    },
  }
})
vi.mock('@/effects/crystal', () => ({ createCrystal: vi.fn(async () => ({ stop: vi.fn() })) }))
// Son de frottement : espion (le vrai crée des nœuds Web Audio).
const son = vi.hoisted(() => ({ move: vi.fn(), rest: vi.fn(), stop: vi.fn() }))
vi.mock('@/composables/useWipeSound', () => ({ useWipeSound: () => son }))

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  horloge()
  son.move.mockClear()
  son.rest.mockClear()
  son.stop.mockClear()
  vi.mocked(createCrystal).mockClear()
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

const monter = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(CrystalActivity, { props: { level: 5 }, attachTo: document.body, global: { plugins: [pinia] } })
  const boule = wrapper.get('[role="application"]').element as HTMLElement
  boule.getBoundingClientRect = () => rect(0, 0, 200, 200)
  await avancer(200)
  return wrapper
}
const boule = (w: VueWrapper) => w.get('[role="application"]')
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')
const invite = (w: VueWrapper) => w.get('p[aria-live="polite"]')
const perdu = () => gpu.lost as Ref<boolean>
// Coordonnées du disque unité → pixels de la boule de 200 px.
const px = (u: number) => ((u + 1) / 2) * 200
const evt = (w: VueWrapper, type: string, x: number, y: number, extra: { buttons?: number; pointerType?: string } = {}) =>
  boule(w).element.dispatchEvent(evenementPointeur(type, { clientX: px(x), clientY: px(y), ...extra }))

// Essuie la boule en serpentin à la souris (bouton enfoncé) jusqu’à la réussite.
const serpentin = async (w: VueWrapper) => {
  evt(w, 'pointerdown', -0.9, -0.9, { buttons: 1 })
  for (let r = 0, y = -0.9; y <= 0.9 && !hud(w).text().includes(ACTIVITY_PROMPTS.crystal.win); r++, y += 0.15) {
    const xs = Array.from({ length: 19 }, (_, i) => -0.9 + i * 0.1)
    for (const x of r % 2 ? xs.reverse() : xs) evt(w, 'pointermove', x, y, { buttons: 1 })
    await avancer(16)
  }
}

describe('CrystalActivity : essuyage au pointeur', () => {
  it('l’invite demande d’essuyer ; la boule est un « application » nommé, décrit par sa consigne', async () => {
    const w = await monter()
    expect(invite(w).text()).toBe('Essuyez la boule de cristal')
    expect(boule(w).attributes('aria-label')).toBe('Boule de cristal embrumée')
    const aide = w.get(`#${boule(w).attributes('aria-describedby')}`)
    expect(aide.text()).toContain('Glissez')
  })

  it('un glissé couvrant la boule réussit : issue, brume dissipée, son coupé, fin émise', async () => {
    const w = await monter()
    await serpentin(w)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.crystal.win)
    expect(son.stop).toHaveBeenCalled()
    expect(invite(w).classes()).toContain('invisible')
    expect(w.emitted('done')).toBeUndefined()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('un seul point essuyé ne suffit pas', async () => {
    const w = await monter()
    evt(w, 'pointerdown', 0, 0, { buttons: 1 })
    await avancer(100)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.crystal.win)
  })

  it('le frottement joue le son (distance parcourue) et se calme au relâchement', async () => {
    const w = await monter()
    evt(w, 'pointerdown', -0.5, 0, { buttons: 1 })
    expect(son.move).toHaveBeenLastCalledWith(0) // premier point : aucune distance
    evt(w, 'pointermove', 0, 0, { buttons: 1 })
    expect(son.move).toHaveBeenLastCalledWith(0.5)
    evt(w, 'pointerup', 0, 0)
    expect(son.rest).toHaveBeenCalledTimes(1)
    evt(w, 'pointercancel', 0, 0)
    expect(son.rest).toHaveBeenCalledTimes(2)
  })

  it('la souris sans bouton enfoncé n’essuie pas ; le toucher sans appui non plus', async () => {
    const w = await monter()
    evt(w, 'pointermove', 0, 0, { buttons: 0 })
    evt(w, 'pointermove', 0.3, 0.3, { buttons: 0, pointerType: 'touch' })
    expect(son.move).not.toHaveBeenCalled()
  })

  it('au toucher, après l’appui, le doigt qui glisse essuie', async () => {
    const w = await monter()
    evt(w, 'pointerdown', 0, 0, { buttons: 1, pointerType: 'touch' })
    son.move.mockClear()
    evt(w, 'pointermove', 0.4, 0, { buttons: 1, pointerType: 'touch' })
    expect(son.move).toHaveBeenCalledTimes(1)
  })

  it('un point hors du disque est ramené sur le bord (pas d’erreur, brume de secours comprise)', async () => {
    const w = await monter()
    perdu().value = true
    await avancer(16)
    evt(w, 'pointerdown', 5, 5, { buttons: 1 })
    await avancer(16)
    expect(w.find('.fb-fog').exists()).toBe(true)
  })
})

describe('CrystalActivity : clavier', () => {
  const touche = async (w: VueWrapper, key: string) => boule(w).trigger('keydown', { key })

  it('les flèches déplacent le chiffon (repère visible) sans quitter le disque', async () => {
    const w = await monter()
    expect(w.find('.border-white\\/70').exists()).toBe(false)
    await touche(w, 'ArrowRight')
    const repere = () => w.get('.border-white\\/70').attributes('style') ?? ''
    expect(repere()).toContain('left: 60%')
    expect(repere()).toContain('top: 50%')
    await touche(w, 'ArrowDown')
    expect(repere()).toContain('top: 60%')
    await touche(w, 'ArrowLeft')
    await touche(w, 'ArrowLeft')
    expect(repere()).toContain('left: 40%')
    await touche(w, 'ArrowUp')
    expect(repere()).toContain('top: 50%')
    for (let i = 0; i < 12; i++) await touche(w, 'ArrowRight')
    // Plafonné au bord : 100 % au plus.
    expect(Number(/left: ([\d.]+)%/.exec(repere())?.[1])).toBeLessThanOrEqual(100)
    expect(son.move).toHaveBeenCalled()
  })

  it('une autre touche est ignorée (et n’est pas interceptée)', async () => {
    const w = await monter()
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true })
    boule(w).element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
    expect(w.find('.border-white\\/70').exists()).toBe(false)
    const f = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true })
    boule(w).element.dispatchEvent(f)
    expect(f.defaultPrevented).toBe(true)
  })

  it('un balayage en serpentin aux flèches réussit', async () => {
    const w = await monter()
    for (let i = 0; i < 5; i++) await touche(w, 'ArrowLeft')
    for (let i = 0; i < 5; i++) await touche(w, 'ArrowUp')
    for (let r = 0; r < 10 && !hud(w).text().includes(ACTIVITY_PROMPTS.crystal.win); r++) {
      for (let i = 0; i < 10; i++) await touche(w, r % 2 ? 'ArrowLeft' : 'ArrowRight')
      await touche(w, 'ArrowDown')
    }
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.crystal.win)
  })

  it('le pointeur reprend la main sur le repère du clavier', async () => {
    const w = await monter()
    await touche(w, 'ArrowRight')
    expect(w.find('.border-white\\/70').exists()).toBe(true)
    evt(w, 'pointerdown', 0, 0, { buttons: 1 })
    await avancer(16)
    expect(w.find('.border-white\\/70').exists()).toBe(false)
  })
})

describe('CrystalActivity : brume de secours (GPU perdu)', () => {
  it('sans GPU, la brume CSS apparaît, son opacité baisse avec la couverture, un masque ouvre un trou', async () => {
    const w = await monter()
    expect(w.find('.fb-fog').exists()).toBe(false)
    perdu().value = true
    await avancer(16)
    const brume = () => w.get('.fb-fog').attributes('style') ?? ''
    expect(brume()).toContain('opacity: 1')
    expect(w.find('canvas').attributes('style')).toContain('display: none')
    evt(w, 'pointerdown', 0, 0, { buttons: 1 })
    await avancer(16)
    expect(brume()).toMatch(/opacity: 0\.9\d*/)
    expect(brume()).toContain('mask-image')
    expect(brume()).not.toContain('transition: none')
  })

  it('mouvement réduit : la brume ne s’anime pas', async () => {
    mouvementReduit(true)
    const w = await monter()
    perdu().value = true
    await avancer(16)
    expect(w.get('.fb-fog').attributes('style')).toContain('transition: none')
  })

  it('la réussite dissipe la brume (opacité 0)', async () => {
    const w = await monter()
    perdu().value = true
    await serpentin(w)
    await avancer(16)
    expect(w.get('.fb-fog').attributes('style')).toContain('opacity: 0')
  })
})

describe('CrystalActivity : effet GPU', () => {
  const lancer = async (w: VueWrapper) => {
    const onLost = vi.fn()
    const canvas = w.get('canvas').element as HTMLCanvasElement
    const boucle = await (gpu.demarrage as DemarrageGpu)(canvas, onLost)
    const reglages = vi.mocked(createCrystal).mock.calls[0][1] as unknown as {
      motion: () => boolean
      points: () => number[]
      grid: () => number[]
      done: () => number
      seed: number
      onLost: () => void
    }
    return { canvas, boucle, reglages, onLost }
  }

  it('l’initialiseur charge createCrystal avec le canevas et les accesseurs du jeu', async () => {
    const w = await monter()
    const { canvas, boucle, reglages, onLost } = await lancer(w)
    expect(createCrystal).toHaveBeenCalledWith(canvas, expect.any(Object))
    expect(boucle).toEqual({ stop: expect.any(Function) })
    expect(reglages.motion()).toBe(true)
    expect(reglages.points()).toHaveLength(32)
    expect(reglages.grid()).toHaveLength(16)
    expect(reglages.grid().every((r) => r === 0)).toBe(true)
    expect(reglages.done()).toBe(0)
    expect(reglages.seed).toBeGreaterThanOrEqual(0)
    expect(reglages.seed).toBeLessThan(10)
    reglages.onLost()
    expect(onLost).toHaveBeenCalledTimes(1)
    expect((gpu.options as { warning: string }).warning).toContain('brume CSS')
  })

  it('les points et la grille suivent l’essuyage', async () => {
    const w = await monter()
    const { reglages } = await lancer(w)
    evt(w, 'pointerdown', 0, 0, { buttons: 1 })
    // Un point récent au centre : poids 1, âge 0 ; la grille a des cellules essuyées.
    expect(reglages.points().some((v) => v !== 0)).toBe(true)
    expect(reglages.grid().some((r) => r > 0)).toBe(true)
  })

  it('la dissipation monte de 0 à 1 en 0,8 s après la réussite', async () => {
    const w = await monter()
    const { reglages } = await lancer(w)
    await serpentin(w)
    expect(reglages.done()).toBeGreaterThanOrEqual(0)
    expect(reglages.done()).toBeLessThan(1)
    await avancer(400)
    expect(reglages.done()).toBeGreaterThan(0.4)
    expect(reglages.done()).toBeLessThan(1)
    await avancer(500)
    expect(reglages.done()).toBe(1)
  })

  it('mouvement réduit : pas de mouvement GPU et brume dissipée d’un coup', async () => {
    mouvementReduit(true)
    const w = await monter()
    const { reglages } = await lancer(w)
    expect(reglages.motion()).toBe(false)
    await serpentin(w)
    expect(reglages.done()).toBe(1)
  })
})

describe('CrystalActivity : issue et pause', () => {
  it('sans essuyage, l’échec arrive : le son est coupé, la brume reste et le frottement est ignoré', async () => {
    const w = await monter()
    await avancer(durationOf('crystal') + ACTIVITY_GRACE_MS + 100)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.crystal.fail)
    expect(son.stop).toHaveBeenCalled()
    son.move.mockClear()
    evt(w, 'pointerdown', 0, 0, { buttons: 1 })
    await boule(w).trigger('keydown', { key: 'ArrowRight' })
    expect(son.move).not.toHaveBeenCalled()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('la pause fige la minuterie jusqu’à « Reprendre »', async () => {
    const w = await monter()
    fenetrePerdFocus()
    await avancer(60_000)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.crystal.fail)
    await reprendre(w)
    await avancer(durationOf('crystal') + ACTIVITY_GRACE_MS + 100)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.crystal.fail)
  })
})
