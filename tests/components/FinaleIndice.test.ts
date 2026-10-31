// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Finale from '../../src/components/Finale.vue'

// Pas d’audio réel : la séquence sonore est remplacée par des fonctions vides.
vi.mock('../../src/audio/finale', () => ({
  BELL_DELAY: 1,
  startFinaleAudio: () => ({ powerDown: () => {}, dawn: () => {}, bell: () => {}, fadePad: () => {}, stop: () => {} }),
}))

let wrapper: VueWrapper | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const indice = () => document.body.textContent?.includes('pour passer') ?? false

describe('Finale : indice « pour passer »', () => {
  it('apparaît après 1,5 s, puis disparaît une fois la séquence passée', async () => {
    wrapper = mount(Finale, { attachTo: document.body, global: { plugins: [createPinia()] } })
    expect(indice()).toBe(false)
    await vi.advanceTimersByTimeAsync(1600)
    expect(indice()).toBe(true)
    expect(document.body.textContent).toContain('Cliquez ou appuyez sur Entrée pour passer')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    expect(indice()).toBe(false)
  })
})
