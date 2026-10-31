// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChunkFailed from '@/components/ChunkFailed.vue'
import KnockPattern from '@/components/KnockPattern.vue'
import SparkPool from '@/components/SparkPool.vue'
import TarotCardBack from '@/components/TarotCardBack.vue'
import TarotEmblem from '@/components/TarotEmblem.vue'
import TarotFallback from '@/components/TarotFallback.vue'
import WebGpuGate from '@/components/WebGpuGate.vue'
import { REPO_URL } from '@/content/finale'

const animate = vi.hoisted(() => vi.fn(() => ({ stop: vi.fn() })))
vi.mock('motion-v', async (orig) => ({ ...(await orig<typeof import('motion-v')>()), animate }))

let wrapper: VueWrapper | undefined
beforeEach(() => animate.mockClear())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('ChunkFailed', () => {
  it('« Réessayer » émet retry ; sans skippable, pas de bouton « Passer »', async () => {
    wrapper = mount(ChunkFailed)
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Réessayer'])
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('skippable : « Passer » émet skip', async () => {
    wrapper = mount(ChunkFailed, { props: { skippable: true } })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('skip')).toHaveLength(1)
  })

  it('focus() place le focus sur « Réessayer »', () => {
    wrapper = mount(ChunkFailed, { attachTo: document.body })
    ;(wrapper.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement?.textContent).toBe('Réessayer')
  })
})

describe('KnockPattern', () => {
  it('dessine un point de plus que de pauses, avec un trait pour les pauses longues', () => {
    wrapper = mount(KnockPattern, { props: { pattern: ['court', 'long'], lit: 0, filled: 0, mode: 'listen' } })
    expect(wrapper.findAll('[data-dot]')).toHaveLength(3)
    expect(wrapper.findAll('[data-gap]').map((g) => g.attributes('data-gap'))).toEqual(['court', 'long'])
    expect(wrapper.get('[data-gap="long"]').classes()).toContain('w-10')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('écoute : les points allumés suivent `lit` (accent)', () => {
    wrapper = mount(KnockPattern, { props: { pattern: ['court', 'court'], lit: 2, filled: 3, mode: 'listen' } })
    const allumes = wrapper.findAll('[data-dot]').map((d) => d.attributes('data-on') !== undefined)
    expect(allumes).toEqual([true, true, false])
    expect(wrapper.get('[data-dot="0"]').classes()).toContain('bg-accent')
  })

  it('répétition : les points remplis suivent `filled` (couleur alternative)', () => {
    wrapper = mount(KnockPattern, { props: { pattern: ['court', 'court'], lit: 3, filled: 1, mode: 'repeat' } })
    const remplis = wrapper.findAll('[data-dot]').map((d) => d.attributes('data-on') !== undefined)
    expect(remplis).toEqual([true, false, false])
    expect(wrapper.get('[data-dot="0"]').classes()).toContain('bg-alt')
    expect(wrapper.get('[data-dot="2"]').classes()).toContain('bg-transparent')
  })
})

describe('SparkPool', () => {
  it('emit anime une étincelle de la réserve à la position donnée', () => {
    wrapper = mount(SparkPool)
    expect(wrapper.findAll('span')).toHaveLength(24)
    ;(wrapper.vm as unknown as { emit: (x: number, y: number) => void }).emit(10, 20)
    expect(animate).toHaveBeenCalledTimes(1)
    const [el, frames] = animate.mock.calls[0] as unknown as [Element, { x: number[]; y: number[]; opacity: number[] }]
    expect(el).toBe(wrapper.findAll('span')[0].element)
    expect(frames.x[0]).toBe(10)
    expect(frames.y[0]).toBe(20)
    expect(frames.opacity).toEqual([1, 0])
  })

  it('la réserve tourne : la 25e étincelle réutilise (et arrête) la première', () => {
    wrapper = mount(SparkPool)
    const emit = (wrapper.vm as unknown as { emit: (x: number, y: number) => void }).emit
    for (let i = 0; i < 25; i++) emit(i, i)
    expect(animate).toHaveBeenCalledTimes(25)
    const appels = animate.mock.calls as unknown as unknown[][]
    expect(appels[24][0]).toBe(appels[0][0])
    const premier = animate.mock.results[0].value as { stop: ReturnType<typeof vi.fn> }
    expect(premier.stop).toHaveBeenCalledTimes(1)
  })

  it('mouvement réduit : un simple fondu sur place', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
    wrapper = mount(SparkPool)
    ;(wrapper.vm as unknown as { emit: (x: number, y: number) => void }).emit(5, 6)
    const [, frames, options] = animate.mock.calls[0] as unknown as [Element, Record<string, unknown>, { duration: number }]
    expect(frames).toEqual({ x: 5, y: 6, opacity: [0.8, 0] })
    expect(options.duration).toBe(0.2)
  })
})

describe('TarotCardBack, TarotEmblem, TarotFallback', () => {
  it('le dos porte la classe de son paquet (nuit par défaut) et `fill`', () => {
    wrapper = mount(TarotCardBack)
    expect(wrapper.classes()).toContain('back--nuit')
    expect(wrapper.classes()).not.toContain('back--fill')
    wrapper.unmount()
    wrapper = mount(TarotCardBack, { props: { fill: true, paquet: 'brume' }, slots: { default: '<i class="marque" />' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['back--fill', 'back--brume']))
    expect(wrapper.find('.marque').exists()).toBe(true)
  })

  it('l’emblème rend un SVG, y compris pour un symbole inconnu (œil par défaut)', () => {
    wrapper = mount(TarotEmblem, { props: { symbole: 'moon' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    wrapper.unmount()
    wrapper = mount(TarotEmblem, { props: { symbole: 'inconnu' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('le repli texte affiche titre, texte et vers', () => {
    wrapper = mount(TarotFallback, { props: { title: 'Titre', body: 'Corps', verse: 'Vers' } })
    expect(wrapper.get('h2').text()).toBe('Titre')
    expect(wrapper.text()).toContain('Corps')
    expect(wrapper.text()).toContain('— Vers')
  })
})

describe('WebGpuGate', () => {
  it('annonce l’exigence WebGPU, émet retry et about, et pointe vers le code source', async () => {
    wrapper = mount(WebGpuGate)
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.get('h1').text()).toContain('WebGPU')
    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.emitted('about')).toHaveLength(1)
    const lien = wrapper.get('a')
    expect(lien.attributes('href')).toBe(REPO_URL)
    expect(lien.attributes('rel')).toContain('noopener')
  })
})
