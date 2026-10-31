import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSessionStore } from '../../src/stores/session'
import Taskbar from '../../src/components/Taskbar.vue'

const render = async (prepare?: (session: ReturnType<typeof useSessionStore>) => void) => {
  const app = createSSRApp({ render: () => h(Taskbar, { level: 1 }) })
  const pinia = createPinia()
  app.use(pinia)
  if (prepare) prepare(useSessionStore(pinia))
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

describe('Taskbar : bulles', () => {
  it('une bulle notifiée pendant une activité n’est pas affichée', async () => {
    const html = await render((s) => {
      s.setActivityRunning(true)
      s.notify('Titre secret|Texte secret')
    })
    expect(html).not.toContain('Titre secret')
  })

  it('sans activité, la bulle est affichée', async () => {
    const html = await render((s) => void s.notify('Titre visible|Texte visible'))
    expect(html).toContain('Titre visible')
  })
})
