import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, type Component } from 'vue'
import { createPinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import { createAppLocale } from '../../src/locale'
import About from '../../src/components/About.vue'
import SoundWindow from '../../src/components/SoundWindow.vue'
import CollectionWindow from '../../src/components/CollectionWindow.vue'
import ResetConfirm from '../../src/components/ResetConfirm.vue'

const render = async (comp: Component, locale = true) => {
  const app = createSSRApp({ render: () => h(comp, { modelValue: false }) }).use(createPinia())
  if (locale) app.use(createAppLocale())
  return (await renderToString(app)).replace(/<!--[\s\S]*?-->/g, '') // sans les marqueurs de fragments du rendu serveur
}

// Pas de DOM dans l’environnement de test (node) : un EventTarget suffit.
beforeEach(() => vi.stubGlobal('document', new EventTarget()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const closeLabels = (html: string) => [...html.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((m) => m[1])

describe('dialogues v0 : libellé « Fermer » fourni par la locale', () => {
  it.each([
    ['À propos', About],
    ['Son', SoundWindow],
    ['Collection', CollectionWindow],
  ] as const)('%s : les deux boutons de fermeture se nomment « Fermer »', async (_nom, comp) => {
    expect(closeLabels(await render(comp))).toEqual(['Fermer', 'Fermer'])
  })
  it('sans le plugin, v0 retombe sur « Close » (la locale est donc nécessaire)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(closeLabels(await render(About, false))).toEqual(['Close', 'Close'])
  })
})

describe('dialogues v0 : rôle et nom accessible', () => {
  it.each([
    ['À propos', About],
    ['Son', SoundWindow],
    ['Collection', CollectionWindow],
  ] as const)('%s : <dialog role="dialog" aria-modal> avec un titre h2 identifié', async (nom, comp) => {
    const html = await render(comp)
    expect(html).toMatch(/<dialog[^>]*role="dialog"[^>]*aria-modal="true"/)
    // aria-labelledby est posé par v0 au montage du titre (hors rendu serveur) : on vérifie ici le titre et son id.
    const titre = html.match(/<h2 id="[^"]+-title"[^>]*>(?:<span[^>]*>)?([^<]+)/)
    expect(titre?.[1]).toBe(nom)
  })
  it('Collection : la liste est nommée par l’id du titre et reste focusable', async () => {
    const html = await render(CollectionWindow)
    const titleId = html.match(/<h2 id="([^"]+)"/)?.[1]
    expect(titleId).toBeTruthy()
    expect(html).toMatch(new RegExp(`<ul[^>]*tabindex="0"[^>]*aria-labelledby="${titleId}"`))
  })
  it('Son : les quatre curseurs natifs sont conservés', async () => {
    expect((await render(SoundWindow)).match(/type="range"/g)).toHaveLength(4)
  })
  it('Réinitialisation : role="alertdialog", titre, description, « Annuler » avant « Oublier »', async () => {
    const html = await render(ResetConfirm)
    expect(html).toMatch(/<dialog[^>]*role="alertdialog"[^>]*aria-modal="true"/)
    expect(html).toMatch(/<h2 id="[^"]+-title"[^>]*>Tout oublier \?<\/h2>/)
    expect(html).toMatch(/<p id="[^"]+-description"/)
    expect(html.indexOf('Annuler')).toBeGreaterThan(-1)
    expect(html.indexOf('Annuler')).toBeLessThan(html.indexOf('Oublier</button>'))
    expect(html).toContain('reset-in') // animation d’ouverture conservée
  })
})
