import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useFullscreenToggle } from '../../src/composables/useFullscreenToggle'

// Faux document : un EventTarget avec l’API plein écran minimale.
const fauxDocument = (enabled = true) =>
  Object.assign(new EventTarget(), {
    fullscreenEnabled: enabled,
    fullscreenElement: null as unknown,
    exitFullscreen: vi.fn(() => Promise.resolve()),
    documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()) },
  })
const monter = (doc: ReturnType<typeof fauxDocument>) => {
  const scope = effectScope()
  const api = scope.run(() => useFullscreenToggle(doc as unknown as Document))!
  return { api, scope }
}

describe('useFullscreenToggle', () => {
  it('lit la prise en charge et suit fullscreenchange', () => {
    const doc = fauxDocument()
    const { api, scope } = monter(doc)
    expect(api.supported.value).toBe(true)
    expect(api.isFullscreen.value).toBe(false)
    expect(api.label.value).toBe('Passer en plein écran')
    doc.fullscreenElement = {}
    doc.dispatchEvent(new Event('fullscreenchange'))
    expect(api.isFullscreen.value).toBe(true)
    expect(api.label.value).toBe('Quitter le plein écran')
    scope.stop()
    doc.fullscreenElement = null
    doc.dispatchEvent(new Event('fullscreenchange'))
    expect(api.isFullscreen.value).toBe(true) // écouteur retiré à l’arrêt du scope
  })

  it('signale l’API absente', () => {
    expect(monter(fauxDocument(false)).api.supported.value).toBe(false)
  })

  it('demande le plein écran, puis en sort', () => {
    const doc = fauxDocument()
    const { api } = monter(doc)
    api.toggle()
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    doc.fullscreenElement = {}
    api.toggle()
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('ignore un refus du navigateur', async () => {
    const doc = fauxDocument()
    doc.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('refusé')))
    const { api } = monter(doc)
    expect(() => api.toggle()).not.toThrow()
    await Promise.resolve()
  })
})
