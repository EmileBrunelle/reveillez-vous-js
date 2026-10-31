// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '@/locale'
import Taskbar from '@/components/Taskbar.vue'
import SoundWindow from '@/components/SoundWindow.vue'
import { useActivityDone } from '@/composables/useActivityDone'

vi.mock('@/audio/sfx', () => ({ previewEffects: vi.fn(), muted: { value: false } }))

// Branchement de bout en bout : ouvrir le menu Démarrer ou une fenêtre (WinDialog) met en pause l’activité, la fermeture la reprend seule.
let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const activite = (pinia = createPinia()) => {
  setActivePinia(pinia)
  const api = effectScope().run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
  return { pinia, api }
}

describe('menus et fenêtres : pause des activités', () => {
  it('le menu Démarrer ouvert met l’activité en pause sans voile, sa fermeture la reprend', async () => {
    const { pinia, api } = activite()
    wrapper = mount(Taskbar, { props: { level: 2 }, attachTo: document.body, global: { plugins: [pinia] } })
    expect(api.paused.value).toBe(false)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(false)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    expect(api.paused.value).toBe(false)
  })

  it('une fenêtre WinDialog ouverte (Son) met l’activité en pause, sa fermeture la reprend', async () => {
    const { pinia, api } = activite()
    const ouvert = ref(false)
    const Hote = defineComponent({ setup: () => () => h(SoundWindow, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) }) })
    wrapper = mount(Hote, { attachTo: document.body, global: { plugins: [pinia, createAppLocale()] } })
    expect(api.paused.value).toBe(false)
    ouvert.value = true
    await nextTick()
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(false)
    ouvert.value = false
    await nextTick()
    expect(api.paused.value).toBe(false)
  })
})
