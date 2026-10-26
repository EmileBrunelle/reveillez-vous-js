import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import OuijaActivity from '../../src/components/activities/OuijaActivity.vue'
import { mulberry32 } from '../../src/engine/rng'

const render = async () => {
  const app = createSSRApp({ render: () => h(OuijaActivity, { level: 1, rng: mulberry32(42) }) })
  return renderToString(app)
}

// Pas de DOM dans l’environnement de test (node) : un EventTarget suffit pour les écouteurs du composant.
beforeEach(() => vi.stubGlobal('document', new EventTarget()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('OuijaActivity', () => {
  it('se monte sans avertissement Vue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await render()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('annonce le mot une seule fois, dans une région aria-live', async () => {
    const html = await render()
    const live = [...html.matchAll(/<p[^>]*aria-live="polite"[^>]*>([^<]*)<\/p>/g)]
    expect(live).toHaveLength(1)
    expect(live[0][1]).toMatch(/^Épelez le mot .+\.$/)
    expect(html).not.toContain('Mot à épeler')
  })
})
