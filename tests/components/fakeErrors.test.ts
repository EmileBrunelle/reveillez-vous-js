// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import FakeErrors from '@/components/FakeErrors.vue'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('innerHeight', 720)
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }) as unknown as MediaQueryList,
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('FakeErrors : hauteur réelle', () => {
  it('une fenêtre de 300 px de haut (texte long) reste au-dessus du bas de la zone sûre', async () => {
    // happy-dom ne fait pas de mise en page : on simule un texte long qui rend 300 px (l’ancienne hypothèse fixe était de 176 px).
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300)
    wrapper = mount(FakeErrors, { props: { level: 5 }, global: { plugins: [createPinia()] }, attachTo: document.body })
    await vi.advanceTimersByTimeAsync(12000)
    await nextTick()
    const fenetres = wrapper.findAll('.fake-error')
    expect(fenetres.length).toBeGreaterThan(0)
    for (const f of fenetres) {
      const el = f.element as HTMLElement
      expect(el.classList.contains('invisible')).toBe(false)
      expect(parseFloat(el.style.top) + 300).toBeLessThanOrEqual(720)
    }
  })
})
