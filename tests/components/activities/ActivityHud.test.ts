// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import ActivityHud from '@/components/activities/ActivityHud.vue'
import ActivitySkip from '@/components/activities/ActivitySkip.vue'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, durationOf } from '@/engine/activityTiming'
import { playStinger } from '@/audio/stinger'
import { releaseMusicTension, setMusicTension } from '@/audio/music'
import { avancer, horloge, mouvementReduit } from './aide'

vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })) }))
vi.mock('@/audio/stinger', () => ({ playStinger: vi.fn(() => vi.fn()) }))
vi.mock('@/audio/music', () => ({ setMusicTension: vi.fn(), releaseMusicTension: vi.fn() }))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  horloge()
  vi.mocked(playStinger).mockClear()
  vi.mocked(setMusicTension).mockClear()
  vi.mocked(releaseMusicTension).mockClear()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

type Props = { activity: 'candles' | 'ouija'; outcome: 'play' | 'win' | 'fail'; startedAt: number; paused?: boolean; elapsed?: () => number; graceLeft?: () => number }
const monter = (props: Partial<Props> = {}) => {
  wrapper = mount(ActivityHud, { props: { activity: 'candles', outcome: 'play', startedAt: Date.now(), ...props } as Props, attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const valeur = (w: VueWrapper) => Number(w.get('[role="progressbar"]').attributes('aria-valuenow'))
const barre = (w: VueWrapper) => w.get('.drain')

describe('ActivityHud : barre de temps', () => {
  it('affiche le verbe de l’activité et une barre pleine au départ', () => {
    const w = monter()
    expect(w.text()).toContain(ACTIVITY_PROMPTS.candles.verb)
    expect(valeur(w)).toBe(100)
    expect(w.get('[role="progressbar"]').attributes('aria-valuetext')).toBe('100 %')
    expect(barre(w).attributes('style')).toContain(`animation-delay: ${ACTIVITY_GRACE_MS}ms`)
  })

  it('la valeur accessible baisse avec le temps de jeu, après la grâce', async () => {
    const w = monter()
    await avancer(ACTIVITY_GRACE_MS + durationOf('candles') / 2)
    expect(valeur(w)).toBeGreaterThan(40)
    expect(valeur(w)).toBeLessThan(60)
    expect(setMusicTension).toHaveBeenLastCalledWith(expect.any(Number))
    const t = vi.mocked(setMusicTension).mock.calls.at(-1)![0]
    expect(t).toBeGreaterThan(0.4)
    expect(t).toBeLessThan(0.6)
  })

  it('monté en retard, la barre est déjà entamée (délai réduit, éventuellement négatif)', () => {
    const w = monter({ startedAt: Date.now() - 1500 })
    expect(barre(w).attributes('style')).toContain('animation-delay: -500ms')
  })

  it('suit `elapsed` quand l’activité le fournit (pause comprise)', async () => {
    let ecoule = 0
    const w = monter({ elapsed: () => ecoule })
    ecoule = durationOf('candles') / 4
    await avancer(600)
    expect(valeur(w)).toBe(75)
  })

  it('en pause la barre se fige ; à la reprise elle est recréée avec le délai recalculé', async () => {
    let ecoule = 0
    const w = monter({ paused: false, elapsed: () => ecoule, graceLeft: () => 0 })
    const avant = barre(w).element
    expect(barre(w).classes()).not.toContain('paused')
    await w.setProps({ paused: true })
    expect(barre(w).classes()).toContain('paused')
    ecoule = 4000
    await w.setProps({ paused: false })
    expect(barre(w).element).not.toBe(avant)
    expect(barre(w).attributes('style')).toContain('animation-delay: -4000ms')
  })

  it('reprise pendant la grâce : le délai restant de la grâce est repris', async () => {
    const w = monter({ elapsed: () => 0, graceLeft: () => 400 })
    await w.setProps({ paused: true })
    await w.setProps({ paused: false })
    expect(barre(w).attributes('style')).toContain('animation-delay: 400ms')
  })

  it('sans `graceLeft`, la reprise pendant la grâce retombe sur la grâce entière', async () => {
    const w = monter({ elapsed: () => 0 })
    await w.setProps({ paused: true })
    await w.setProps({ paused: false })
    expect(barre(w).attributes('style')).toContain(`animation-delay: ${ACTIVITY_GRACE_MS}ms`)
  })
})

describe('ActivityHud : issue', () => {
  it('la réussite fige la barre, annonce le texte, joue le jingle (avec son délai) et relâche la tension', async () => {
    const w = monter({ activity: 'ouija' })
    await avancer(ACTIVITY_GRACE_MS + 3000)
    await w.setProps({ outcome: 'win' })
    await avancer(1)
    expect(w.get('[role="status"]').text()).toBe(ACTIVITY_PROMPTS.ouija.win)
    expect(barre(w).classes()).toContain('paused')
    expect(playStinger).toHaveBeenCalledWith('win', ACTIVITY_PROMPTS.ouija.winStingerDelay)
    expect(releaseMusicTension).toHaveBeenCalledWith('win')
    // Valeur finale exacte, puis la minuterie s’arrête (plus de mise à jour).
    const v = valeur(w)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(100)
    await avancer(5000)
    expect(valeur(w)).toBe(v)
    expect(w.text()).toContain(ACTIVITY_PROMPTS.ouija.win)
  })

  it('l’échec vide la barre et joue le jingle d’échec sans délai', async () => {
    const w = monter()
    await w.setProps({ outcome: 'fail' })
    await avancer(1)
    expect(valeur(w)).toBe(0)
    expect(w.get('[role="status"]').text()).toBe(ACTIVITY_PROMPTS.candles.fail)
    expect(playStinger).toHaveBeenCalledWith('fail', 0)
    expect(releaseMusicTension).toHaveBeenCalledWith('fail')
  })

  it('mouvement réduit : l’issue s’affiche sans animation de surgissement', async () => {
    mouvementReduit(true)
    const w = monter()
    await w.setProps({ outcome: 'win' })
    await avancer(1)
    expect(w.text()).toContain(ACTIVITY_PROMPTS.candles.win)
  })

  it('abandon en cours de jeu : la tension de la musique est relâchée au démontage, pas après une issue', () => {
    const w = monter()
    w.unmount()
    wrapper = undefined
    expect(releaseMusicTension).toHaveBeenCalledTimes(1)
    vi.mocked(releaseMusicTension).mockClear()
    const apres = monter({ outcome: 'win' })
    apres.unmount()
    wrapper = undefined
    expect(releaseMusicTension).not.toHaveBeenCalled()
  })
})

describe('ActivitySkip', () => {
  it('invisible tant que `show` est faux, puis monté ; un clic émet « skip »', async () => {
    const w = mount(ActivitySkip, { props: { show: false } })
    expect(w.find('button').exists()).toBe(false)
    await w.setProps({ show: true })
    expect(w.get('button').text()).toBe('Passer')
    expect(w.get('button').attributes('aria-disabled')).toBeUndefined()
    await w.get('button').trigger('click')
    expect(w.emitted('skip')).toHaveLength(1)
  })

  it('une fois affiché, le bouton reste monté mais devient inerte quand `show` repasse à faux', async () => {
    const w = mount(ActivitySkip, { props: { show: true } })
    await w.setProps({ show: false })
    const bouton = w.get('button')
    expect(bouton.attributes('aria-disabled')).toBe('true')
    expect(bouton.classes()).toContain('cursor-default')
    expect(bouton.classes()).toContain('pointer-events-none')
    expect(bouton.attributes('aria-hidden')).toBe('true')
    expect(bouton.attributes('tabindex')).toBe('-1')
    await bouton.trigger('click')
    expect(w.emitted('skip')).toBeUndefined()
  })
})
