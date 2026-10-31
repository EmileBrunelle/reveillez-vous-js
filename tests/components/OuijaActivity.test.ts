import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import OuijaActivity from '../../src/components/activities/OuijaActivity.vue'
import { mulberry32 } from '../../src/engine/rng'

const render = async () => {
  const app = createSSRApp({ render: () => h(OuijaActivity, { level: 1, rng: mulberry32(42) }) }).use(createPinia())
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

  it('monte la région aria-live vide (le texte y entre après le montage, sinon rien n’est annoncé)', async () => {
    const html = await render()
    const live = [...html.matchAll(/<p[^>]*aria-live="polite"[^>]*>([^<]*)<\/p>/g)]
    expect(live).toHaveLength(1)
    expect(live[0][1]).toBe('')
  })

  it('rend le mot à épeler accessible (pas d’aria-hidden sur le mot ni sur ses cases)', async () => {
    const html = await render()
    const word = html.match(/<p class="relative m-0 flex[^>]*>[\s\S]*?<\/p>/)
    expect(word).not.toBeNull()
    expect(word![0]).not.toContain('aria-hidden')
    expect(word![0]).toMatch(/<span[^>]*>[A-ZŒ]<\/span>/)
  })
})
