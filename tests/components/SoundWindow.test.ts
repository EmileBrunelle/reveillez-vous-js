import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { createPinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import SoundWindow from '../../src/components/SoundWindow.vue'

const render = async () => renderToString(createSSRApp({ render: () => h(SoundWindow, { modelValue: false }) }).use(createPinia()))

// Pas de DOM dans l’environnement de test (node) : un EventTarget suffit.
beforeEach(() => vi.stubGlobal('document', new EventTarget()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SoundWindow', () => {
  it('se rend sans avertissement Vue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await render()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
  it('un curseur étiqueté par catégorie, avec sa valeur en %, et le bouton par défaut', async () => {
    const html = await render()
    expect(html.match(/type="range"/g)).toHaveLength(4)
    for (const label of ['Volume général', 'Ambiance', 'Effets', 'Finale']) expect(html).toContain(`>${label}</label>`)
    expect(html).toContain('100 %')
    expect(html).toContain('Valeurs par défaut')
    expect(html).toContain('aria-labelledby="sound-title"')
  })
})
