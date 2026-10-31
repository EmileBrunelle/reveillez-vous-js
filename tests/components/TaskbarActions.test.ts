// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Taskbar from '@/components/Taskbar.vue'
import { useSessionStore } from '@/stores/session'
import { REPO_URL } from '@/content/finale'

const son = vi.hoisted(() => ({ muted: { value: false } as { value: boolean } }))
vi.mock('@/audio/sfx', async () => {
  const { ref: r } = await import('vue')
  son.muted = r(false)
  return { muted: son.muted }
})
vi.mock('@/lazy', () => ({ loadAbout: vi.fn(), loadCollection: vi.fn(), loadReset: vi.fn(), loadSound: vi.fn(), prefetch: vi.fn() }))
const plein = vi.hoisted(() => ({ toggle: vi.fn() }))
const supporte = ref(true)
const enPleinEcran = ref(false)
vi.mock('@/composables/useFullscreenToggle', () => ({
  useFullscreenToggle: () => ({ supported: supporte, isFullscreen: enPleinEcran, label: computed(() => (enPleinEcran.value ? 'Quitter le plein écran' : 'Plein écran')), toggle: plein.toggle }),
}))

import { prefetch } from '@/lazy'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 31, 9, 5))
  vi.clearAllMocks()
  son.muted.value = false
  supporte.value = true
  enPleinEcran.value = false
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const monter = (level = 2) => {
  const pinia = createPinia()
  wrapper = mount(Taskbar, { props: { level }, attachTo: document.body, global: { plugins: [pinia] } })
  return { w: wrapper, session: useSessionStore(pinia) }
}
const demarrer = (w: VueWrapper) => w.get('button[aria-haspopup="menu"]')
const entree = (w: VueWrapper, texte: string) => w.findAll('[role="menuitem"]').find((e) => e.text().includes(texte))!

describe('Taskbar : menu Démarrer', () => {
  it.each([
    ['À propos', 'about'],
    ['Collection', 'collection'],
    ['Son…', 'sound'],
    ['Recommencer à zéro', 'reset'],
  ])('« %s » émet %s et referme le menu en rendant le focus à « Démarrer »', async (texte, evenement) => {
    const { w } = monter()
    await demarrer(w).trigger('click')
    await entree(w, texte).trigger('click')
    expect(w.emitted(evenement)).toHaveLength(1)
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(demarrer(w).element)
  })

  it('au niveau 1, pas d’entrée « Recommencer à zéro »', async () => {
    const { w } = monter(1)
    await demarrer(w).trigger('click')
    expect(w.findAll('[role="menuitem"]').map((e) => e.text())).not.toContain('Recommencer à zéro')
  })

  it('le lien « Code source » pointe vers le dépôt et referme le menu', async () => {
    const { w } = monter()
    await demarrer(w).trigger('click')
    const lien = w.get('a[role="menuitem"]')
    expect(lien.attributes('href')).toBe(REPO_URL)
    expect(lien.attributes('rel')).toContain('noopener')
    lien.element.addEventListener('click', (e) => e.preventDefault())
    await lien.trigger('click')
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
  })

  it('un clic hors du menu le referme', async () => {
    const { w } = monter()
    await demarrer(w).trigger('click')
    expect(demarrer(w).attributes('aria-expanded')).toBe('true')
    await vi.advanceTimersByTimeAsync(5) // VueUse ignore un second clic dans le même tour de boucle
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.click()
    await nextTick()
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
  })

  it('ouvrir ou survoler « Démarrer » précharge les fenêtres', async () => {
    const { w } = monter()
    await demarrer(w).trigger('pointerenter')
    expect(prefetch).toHaveBeenCalledTimes(1)
    await demarrer(w).trigger('click')
    expect(prefetch).toHaveBeenCalledTimes(2)
  })

  it('plein écran : entrée de menu qui bascule et referme ; absente si l’API manque', async () => {
    const { w } = monter()
    await demarrer(w).trigger('click')
    await entree(w, 'Plein écran').trigger('click')
    expect(plein.toggle).toHaveBeenCalledTimes(1)
    expect(demarrer(w).attributes('aria-expanded')).toBe('false')
    w.unmount()
    wrapper = undefined
    supporte.value = false
    const { w: w2 } = monter()
    await demarrer(w2).trigger('click')
    expect(w2.findAll('[role="menuitem"]').map((e) => e.text())).not.toContain('Plein écran')
  })

  it('l’icône de la zone de notification bascule aussi le plein écran', async () => {
    const { w } = monter()
    await w.get('button[aria-label="Plein écran"]').trigger('click')
    expect(plein.toggle).toHaveBeenCalledTimes(1)
  })
})

describe('Taskbar : zone de notification', () => {
  it('le bouton de son coupe et rétablit le son, avec son état annoncé', async () => {
    const { w } = monter()
    const b = w.get('button[aria-label="Couper le son"]')
    expect(b.attributes('aria-pressed')).toBe('false')
    expect(b.attributes('title')).toContain('Son actif')
    await b.trigger('click')
    expect(son.muted.value).toBe(true)
    expect(b.attributes('aria-pressed')).toBe('true')
    expect(b.attributes('title')).toContain('Son coupé')
    await b.trigger('click')
    expect(son.muted.value).toBe(false)
  })

  it('le clic droit sur le son ouvre les réglages, sans menu contextuel', async () => {
    const { w } = monter()
    const e = new Event('contextmenu', { cancelable: true, bubbles: true })
    w.get('button[aria-label="Couper le son"]').element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(w.emitted('sound')).toHaveLength(1)
  })

  it('le badge de vigilance relaie la remise à zéro du niveau', async () => {
    const { w } = monter(3)
    await w.get('button[aria-describedby]').trigger('click', { detail: 3 })
    expect(w.emitted('resetLevel')).toHaveLength(1)
  })

  it('l’horloge affiche l’heure locale (hh:mm) et se met à jour toutes les 15 s', async () => {
    const { w } = monter()
    expect(w.get('time').text()).toBe('09:05')
    expect(w.get('time').attributes('datetime')).toMatch(/^2026-10-31T/)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.get('time').text()).toBe('09:06')
  })
})

describe('Taskbar : bulles', () => {
  it('une bulle est annoncée, se ferme à la croix, puis la suivante prend sa place', async () => {
    const { w, session } = monter()
    session.notify('Premier', 'Texte un')
    session.notify('Second', 'Texte deux')
    await nextTick()
    expect(w.get('.balloon').text()).toContain('Premier')
    expect(w.get('[role="status"]').text()).toBe('Premier : Texte un')
    await w.get('button[aria-label="Fermer la notification"]').trigger('click')
    expect(w.get('.balloon').text()).toContain('Second')
    await w.get('button[aria-label="Fermer la notification"]').trigger('click')
    expect(w.find('.balloon').exists()).toBe(false)
    expect(w.get('[role="status"]').text()).toBe('')
  })

  it('une bulle disparaît seule après 7 s', async () => {
    const { w, session } = monter()
    session.notify('Titre', 'Texte')
    await nextTick()
    await vi.advanceTimersByTimeAsync(6900)
    expect(w.find('.balloon').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(w.find('.balloon').exists()).toBe(false)
  })

  it('une bulle sans titre n’affiche que son texte', async () => {
    const { w, session } = monter()
    session.notify('', 'Seulement le texte')
    await nextTick()
    expect(w.find('.balloon strong').exists()).toBe(false)
    expect(w.get('[role="status"]').text()).toBe('Seulement le texte')
  })
})
