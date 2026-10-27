// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import Taskbar from '../../src/components/Taskbar.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const monter = (level = 2) => {
  wrapper = mount(Taskbar, { props: { level }, attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const touche = (w: VueWrapper, key: string) => w.get('[role="menu"]').trigger('keydown', { key })
const libelleFocalise = () => document.activeElement?.textContent?.trim()
const demarrer = (w: VueWrapper) => w.get('button[aria-haspopup="menu"]')

describe('Taskbar : menu Démarrer au clavier', () => {
  it('s’ouvre au clic et place le focus sur la première entrée', async () => {
    const w = monter()
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
    await demarrer(w).trigger('click')
    expect(demarrer(w).attributes('aria-expanded')).toBe('true')
    await w.vm.$nextTick()
    expect(libelleFocalise()).toBe('À propos')
  })

  it('↓ et ↑ circulent entre les entrées, en boucle', async () => {
    const w = monter()
    await demarrer(w).trigger('click')
    await w.vm.$nextTick()
    const entrees = w.findAll('[role="menuitem"]')
    const n = entrees.length
    expect(n).toBeGreaterThan(3)
    await touche(w, 'ArrowDown')
    expect(document.activeElement).toBe(entrees[1].element)
    await touche(w, 'ArrowUp')
    expect(document.activeElement).toBe(entrees[0].element)
    await touche(w, 'ArrowUp') // retour à la dernière
    expect(document.activeElement).toBe(entrees[n - 1].element)
    await touche(w, 'ArrowDown') // et à la première
    expect(document.activeElement).toBe(entrees[0].element)
  })

  it('Fin et Début vont aux extrémités', async () => {
    const w = monter()
    await demarrer(w).trigger('click')
    await w.vm.$nextTick()
    const entrees = w.findAll('[role="menuitem"]')
    await touche(w, 'End')
    expect(document.activeElement).toBe(entrees[entrees.length - 1].element)
    expect(libelleFocalise()).toBe('Recommencer à zéro')
    await touche(w, 'Home')
    expect(document.activeElement).toBe(entrees[0].element)
  })

  it('Échap ferme le menu et rend le focus au bouton Démarrer', async () => {
    const w = monter()
    await demarrer(w).trigger('click')
    await w.vm.$nextTick()
    await touche(w, 'Escape')
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(demarrer(w).element)
  })

  it('Tab ferme le menu sans toucher au focus', async () => {
    const w = monter()
    await demarrer(w).trigger('click')
    await w.vm.$nextTick()
    await touche(w, 'Tab')
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
  })

  it('choisir une entrée émet l’événement et rend le focus à Démarrer', async () => {
    const w = monter()
    await demarrer(w).trigger('click')
    await w.vm.$nextTick()
    await w.findAll('[role="menuitem"]')[2].trigger('click')
    expect(w.emitted('sound')).toHaveLength(1)
    expect(document.activeElement).toBe(demarrer(w).element)
  })

  it('niveau 1 : pas d’entrée « Recommencer à zéro »', async () => {
    const w = monter(1)
    await demarrer(w).trigger('click')
    expect(w.text()).not.toContain('Recommencer à zéro')
  })
})
