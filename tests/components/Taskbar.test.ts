import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import Taskbar from '../../src/components/Taskbar.vue'

const render = async () => {
  const app = createSSRApp({ render: () => h(Taskbar, { level: 1 }) })
  app.use(createPinia())
  return renderToString(app)
}

// Pas de DOM dans l’environnement de test (node) : un EventTarget sans API plein écran = navigateur non compatible.
beforeEach(() => vi.stubGlobal('document', new EventTarget()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Taskbar : plein écran', () => {
  it('sans API plein écran, ni icône ni entrée de menu, et aucun avertissement Vue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = await render()
    expect(html).not.toContain('plein écran')
    expect(html).not.toContain('Plein écran')
    expect(html).toContain('Couper le son')
    expect(warn).not.toHaveBeenCalled()
  })
})
