// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Vigilance from '@/components/Vigilance.vue'

let wrapper: VueWrapper | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const monter = (level = 3) => (wrapper = mount(Vigilance, { props: { level }, attrs: { class: 'barre' } }))
const bouton = () => wrapper!.get('button')

describe('Vigilance : affichage', () => {
  it('annonce le niveau et transmet les attributs au bouton', () => {
    monter(4)
    expect(bouton().classes()).toContain('barre')
    expect(wrapper!.get('[role="img"]').attributes('aria-label')).toBe('Niveau de vigilance : 4 sur 5')
    expect(bouton().attributes('title')).toContain('4 sur 5')
    const id = bouton().attributes('aria-describedby')!
    expect(wrapper!.get(`[id="${id}"]`).text()).toContain('Triple-clic')
    expect(wrapper!.get('[role="status"]').text()).toBe('')
  })
})

describe('Vigilance : gestes de remise à zéro', () => {
  it('un clic simple ou double ne remet rien à zéro', async () => {
    monter()
    await bouton().trigger('click', { detail: 1 })
    await bouton().trigger('click', { detail: 2 })
    expect(wrapper!.emitted('reset')).toBeUndefined()
  })

  it('le triple-clic remet à zéro, annonce « Vigilance réinitialisée » 1,5 s', async () => {
    monter()
    await bouton().trigger('click', { detail: 3 })
    expect(wrapper!.emitted('reset')).toHaveLength(1)
    expect(wrapper!.get('[role="status"]').text()).toBe('Vigilance réinitialisée')
    expect(bouton().classes()).toContain('vigil--reset')
    expect(wrapper!.find('[role="img"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper!.get('[role="status"]').text()).toBe('')
    expect(wrapper!.find('[role="img"]').exists()).toBe(true)
  })

  it('un appui long de 600 ms remet à zéro (anneau de progression pendant l’appui)', async () => {
    monter()
    await bouton().trigger('pointerdown')
    expect(wrapper!.find('svg.vigil-ring').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(599)
    expect(wrapper!.emitted('reset')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(2)
    expect(wrapper!.emitted('reset')).toHaveLength(1)
    expect(wrapper!.find('svg.vigil-ring').exists()).toBe(false)
  })

  it.each(['pointerup', 'pointerleave', 'pointercancel', 'blur'])('%s avant 600 ms annule l’appui long', async (fin) => {
    monter()
    await bouton().trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(300)
    await bouton().trigger(fin)
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper!.emitted('reset')).toBeUndefined()
  })

  it('un second pointerdown pendant l’appui ne relance pas la minuterie', async () => {
    monter()
    await bouton().trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(400)
    await bouton().trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper!.emitted('reset')).toHaveLength(1)
  })

  it('Entrée maintenue 600 ms remet à zéro ; les répétitions et les autres touches ne comptent pas', async () => {
    monter()
    await bouton().trigger('keydown', { key: 'a' })
    await bouton().trigger('keydown', { key: 'Enter', repeat: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper!.emitted('reset')).toBeUndefined()
    await bouton().trigger('keydown', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(650)
    expect(wrapper!.emitted('reset')).toHaveLength(1)
  })

  it('relâcher Entrée avant 600 ms annule ; relâcher une autre touche n’annule pas', async () => {
    monter()
    await bouton().trigger('keydown', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(300)
    await bouton().trigger('keyup', { key: 'a' })
    await vi.advanceTimersByTimeAsync(350)
    expect(wrapper!.emitted('reset')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2000)
    await bouton().trigger('keydown', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(300)
    await bouton().trigger('keyup', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper!.emitted('reset')).toHaveLength(1)
  })

  it('le menu contextuel (appui long tactile) est supprimé', async () => {
    monter()
    const e = new Event('contextmenu', { cancelable: true, bubbles: true })
    bouton().element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})
