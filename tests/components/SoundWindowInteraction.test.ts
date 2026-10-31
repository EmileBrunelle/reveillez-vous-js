// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '@/locale'
import SoundWindow from '@/components/SoundWindow.vue'
import { useAudioStore } from '@/stores/audio'

const preview = vi.hoisted(() => vi.fn())
vi.mock('@/audio/sfx', () => ({ previewEffects: preview }))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const monter = async () => {
  const pinia = createPinia()
  const ouvert = ref(true)
  const Hote = defineComponent({ setup: () => () => h(SoundWindow, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) }) })
  wrapper = mount(Hote, { attachTo: document.body, global: { plugins: [pinia, createAppLocale()] } })
  await nextTick()
  await nextTick()
  return useAudioStore(pinia)
}
const curseur = (i: number) => document.querySelectorAll('input[type="range"]')[i] as HTMLInputElement
const regler = (el: HTMLInputElement, v: number) => {
  el.value = String(v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('SoundWindow : réglages', () => {
  it('quatre curseurs reflètent les volumes et leur valeur textuelle', async () => {
    const audio = await monter()
    expect([...document.querySelectorAll('input[type="range"]')].map((c) => (c as HTMLInputElement).value)).toEqual(
      (['general', 'ambiance', 'effets', 'finale'] as const).map((k) => String(Math.round(audio.volumes[k] * 100))),
    )
    expect(curseur(0).getAttribute('aria-valuetext')).toMatch(/^\d+ %$/)
  })

  it('déplacer un curseur change le volume du store et la valeur affichée', async () => {
    const audio = await monter()
    regler(curseur(1), 40)
    await nextTick()
    expect(audio.volumes.ambiance).toBeCloseTo(0.4)
    expect(document.querySelectorAll('output')[1].textContent).toBe('40 %')
    expect(curseur(1).getAttribute('aria-valuetext')).toBe('40 %')
  })

  it('l’aperçu sonore ne joue qu’au relâchement du curseur des effets', async () => {
    await monter()
    curseur(0).dispatchEvent(new Event('change', { bubbles: true }))
    curseur(1).dispatchEvent(new Event('change', { bubbles: true }))
    expect(preview).not.toHaveBeenCalled()
    curseur(2).dispatchEvent(new Event('change', { bubbles: true }))
    expect(preview).toHaveBeenCalledTimes(1)
  })

  it('« Valeurs par défaut » remet tous les volumes', async () => {
    const audio = await monter()
    const defaut = { ...audio.volumes }
    regler(curseur(0), 10)
    regler(curseur(3), 20)
    await nextTick()
    expect(audio.volumes.general).not.toBe(defaut.general)
    ;([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Valeurs par défaut') as HTMLButtonElement).click()
    await nextTick()
    expect({ ...audio.volumes }).toEqual(defaut)
    expect(curseur(0).value).toBe(String(Math.round(defaut.general * 100)))
  })
})
