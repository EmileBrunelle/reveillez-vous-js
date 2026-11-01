// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

// Les boucles de Motion sont remplacées par des contrôles espions : on compte les démarrages et les arrêts.
const motion = vi.hoisted(() => ({ started: [] as { stop: ReturnType<typeof vi.fn> }[] }))
vi.mock('motion-v', async (orig) => ({
  ...(await orig<typeof import('motion-v')>()),
  animate: vi.fn(() => {
    const c = { stop: vi.fn() }
    motion.started.push(c)
    return c
  }),
}))

import Seer from '@/components/Seer.vue'

let wrapper: VueWrapper | undefined
const make = (props: Record<string, unknown> = {}) => (wrapper = mount(Seer, { props }))
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  motion.started.length = 0
})

describe('voyante.svg (le dessin)', () => {
  const svg = readFileSync('src/assets/svg/voyante.svg', 'utf8')
  it('expose les calques que Seer.vue éclaire et anime', () => {
    for (const cls of ['seer-breath', 'seer-body', 'seer-arm-a', 'seer-head', 'seer-eyes', 'seer-orb', 'seer-hand-b', 'seer-flame', 'seer-rim', 'seer-lit-a', 'seer-lit-b']) {
      expect(svg, cls).toContain(`class="${cls}"`)
    }
  })
  it('ne contient aucun filtre ni animation SMIL (une image fixe : aucun coût par image)', () => {
    expect(svg).not.toMatch(/<filter|<feGaussianBlur|<animate|<animateTransform|<set /)
  })
  it('n’utilise jamais de noir pur', () => {
    expect(svg).not.toMatch(/#000(000)?\b|\bblack\b/i)
  })
  it('garde le viewBox 80 × 120 sur lequel reposent les pivots de seerPose (cou 41 54, coude 66 76)', () => {
    expect(svg).toContain('viewBox="0 0 80 120"')
  })
})

describe('Seer.vue', () => {
  it('est décorative : aria-hidden, sans rôle ni texte', () => {
    const w = make()
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.text()).toBe('')
    expect(w.find('svg').exists()).toBe(true)
  })

  it('teinte la lumière selon le lieu', () => {
    const w = make({ place: 'cimetiere' })
    expect(w.attributes('style')).toContain('--seer-rim: #f2e0a0')
  })

  it('porte ouverte : démarre les trois boucles lentes (respiration, flamme, boule)', () => {
    make({ open: 1 })
    expect(motion.started).toHaveLength(3)
  })

  it('porte fermée : aucune boucle ; elles démarrent quand la porte s’ouvre', async () => {
    const w = make({ open: 0 })
    expect(motion.started).toHaveLength(0)
    await w.setProps({ open: 0.4 })
    expect(motion.started).toHaveLength(3)
    await w.setProps({ open: 1 })
    expect(motion.started).toHaveLength(3)
  })

  it('mouvement réduit : aucune boucle, aucun ressort de regard ; la pose reste au repos', async () => {
    const w = make({ open: 1, reduced: true })
    expect(motion.started).toHaveLength(0)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 900, clientY: 100 }))
    await nextTick()
    expect(w.find('.seer-head').attributes('transform')).toBe('translate(0 0) rotate(0 41 54)')
    expect(w.find('.seer-eyes').attributes('transform')).toBe('translate(0 0)')
  })

  it('écrit les transforms des groupes du SVG dès le montage (un seul endroit, valeurs neutres)', () => {
    const w = make({ open: 1 })
    expect(w.find('.seer-breath').attributes('transform')).toContain('scale(1 1)')
    expect(w.find('.seer-hand-b').attributes('transform')).toBe('translate(0 0) rotate(0 66 76)')
    expect(w.find('.seer-arm-a').attributes('transform')).toBe('translate(0 0)')
  })

  it('arrête ses boucles à la destruction', () => {
    const w = make({ open: 1 })
    const loops = [...motion.started]
    w.unmount()
    wrapper = undefined
    for (const c of loops) expect(c.stop).toHaveBeenCalled()
  })

  it('passer reduced à vrai en cours de route coupe les boucles', async () => {
    const w = make({ open: 1 })
    const loops = [...motion.started]
    await w.setProps({ reduced: true })
    for (const c of loops) expect(c.stop).toHaveBeenCalled()
  })

  it('« parle » : démarre et s’arrête sans erreur (le geste est un ressort, sans minuterie fuyante)', async () => {
    vi.useFakeTimers()
    try {
      const w = make({ open: 1, speaking: false })
      await w.setProps({ speaking: true })
      await vi.advanceTimersByTimeAsync(1500)
      await w.setProps({ speaking: false })
      await vi.advanceTimersByTimeAsync(1500)
      expect(w.exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
