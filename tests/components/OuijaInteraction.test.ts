// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import OuijaActivity from '../../src/components/activities/OuijaActivity.vue'
import { useOverlayStore } from '../../src/stores/overlay'
import { mulberry32 } from '../../src/engine/rng'

let wrapper: VueWrapper | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const monter = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(OuijaActivity, { props: { level: 1, rng: mulberry32(42) }, attachTo: document.body, global: { plugins: [pinia] } })
  return wrapper
}
const annonce = (w: VueWrapper) => w.get('p[aria-live="polite"]')
// Première lettre du mot à épeler : première case du mot (le paragraphe de cases, après « Épelez le mot »).
const premiereLettre = (w: VueWrapper) => w.findAll('p')[2].find('span').text()
const frapper = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('OuijaActivity : interactions', () => {
  it('la région aria-live est montée vide, puis remplie après le délai (useTimeout de VueUse serait déjà prêt)', async () => {
    const w = monter()
    expect(annonce(w).text()).toBe('')
    await vi.advanceTimersByTimeAsync(149)
    expect(annonce(w).text()).toBe('')
    await vi.advanceTimersByTimeAsync(2)
    expect(annonce(w).text()).toMatch(/^Épelez le mot /)
  })

  it('une touche juste est acceptée et annoncée', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(200)
    frapper(premiereLettre(w).toLowerCase())
    await vi.advanceTimersByTimeAsync(0)
    expect(annonce(w).text()).toMatch(/^Lettre [A-Z]\. 1 sur \d\.$/)
  })

  it('une touche est ignorée quand un dialogue ouvert a la main, acceptée une fois fermé', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(200)
    const avant = annonce(w).text()
    const id = 999
    useOverlayStore().register(id)
    frapper(premiereLettre(w).toLowerCase())
    await vi.advanceTimersByTimeAsync(0)
    expect(annonce(w).text()).toBe(avant)

    useOverlayStore().unregister(id)
    frapper(premiereLettre(w).toLowerCase())
    await vi.advanceTimersByTimeAsync(0)
    expect(annonce(w).text()).toMatch(/^Lettre /)
  })

  it('une touche avec Ctrl est ignorée', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(200)
    const avant = annonce(w).text()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: premiereLettre(w).toLowerCase(), ctrlKey: true, bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(annonce(w).text()).toBe(avant)
  })
})
