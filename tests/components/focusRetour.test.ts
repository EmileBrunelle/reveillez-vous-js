// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '../../src/locale'
import SoundWindow from '../../src/components/SoundWindow.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// Hôte minimal : un bouton ouvreur et la fenêtre pilotée par un v-model, comme dans App.vue.
const Hote = defineComponent({
  setup: () => {
    const ouvert = ref(false)
    return () => [
      h('button', { id: 'ouvreur', onClick: () => (ouvert.value = true) }, 'Ouvrir'),
      h(SoundWindow, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) }),
    ]
  },
})

describe('SoundWindow : focus à l’ouverture et à la fermeture', () => {
  it('ouvre sur « Fermer » puis rend le focus à l’ouvreur', async () => {
    wrapper = mount(Hote, { attachTo: document.body, global: { plugins: [createPinia(), createAppLocale()] } })
    const ouvreur = wrapper.get<HTMLButtonElement>('#ouvreur')
    ouvreur.element.focus()
    expect(document.activeElement).toBe(ouvreur.element)

    await ouvreur.trigger('click')
    await nextTick()
    await nextTick()
    const dialogue = document.querySelector('dialog') as HTMLDialogElement
    expect(dialogue.hasAttribute('open')).toBe(true)
    expect(document.activeElement?.textContent?.trim()).toBe('Fermer')

    // Fermeture par le bouton « Fermer » du pied de fenêtre.
    ;(document.activeElement as HTMLElement).click()
    await nextTick()
    await nextTick()
    expect(dialogue.hasAttribute('open')).toBe(false)
    expect(document.activeElement).toBe(ouvreur.element)
  })
})
