import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import DeckCut from '../../src/components/DeckCut.vue'
import Vigilance from '../../src/components/Vigilance.vue'
import { mulberry32 } from '../../src/engine/rng'

// Pas de DOM dans l’environnement de test (node) : on vérifie le balisage rendu côté serveur (l’état initial de chaque composant).
const render = (component: object, props: Record<string, unknown>) => {
  const app = createSSRApp({ render: () => h(component, props) })
  app.use(createPinia())
  return renderToString(app)
}

// DeckCut écoute `window` dès sa mise en place : un EventTarget suffit côté serveur.
beforeEach(() => vi.stubGlobal('window', new EventTarget()))
afterEach(() => vi.unstubAllGlobals())

describe('annonces uniques pour les lecteurs d’écran', () => {
  it('DeckCut : une seule région live, et une cible de focus muette (ni rôle ni nom) pour après le choix', async () => {
    const html = await render(DeckCut, { level: 1, rng: mulberry32(1) })
    expect(html.match(/role="status"/g)).toHaveLength(1)
    const sink = html.match(/<span[^>]*tabindex="-1"[^>]*>/)?.[0] ?? ''
    expect(sink).not.toBe('')
    expect(sink).not.toMatch(/role=|aria-label/)
  })

  it('DeckCut : aucun commentaire HTML avant la racine du gabarit (sinon, en dev, le statut est écrit deux fois)', () => {
    const source = readFileSync(new URL('../../src/components/DeckCut.vue', import.meta.url), 'utf8')
    const template = source.slice(source.indexOf('<template>') + '<template>'.length).trimStart()
    expect(template.startsWith('<div')).toBe(true)
  })

  it('Vigilance : la région live est présente et vide au départ (pas insérée déjà remplie)', async () => {
    const html = await render(Vigilance, { level: 2 })
    expect(html).toMatch(/<span[^>]*role="status"[^>]*><\/span>/)
    expect(html).not.toContain('Vigilance réinitialisée')
  })
})
