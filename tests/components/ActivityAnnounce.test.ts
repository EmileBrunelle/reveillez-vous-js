import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ActivityHud from '../../src/components/activities/ActivityHud.vue'
import WindowsActivity from '../../src/components/activities/WindowsActivity.vue'
import WispsActivity from '../../src/components/activities/WispsActivity.vue'
import CrystalActivity from '../../src/components/activities/CrystalActivity.vue'

const render = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(component, props) }))

// Pas de DOM dans l’environnement de test (node) : un EventTarget suffit pour les écouteurs des composants.
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('document', new EventTarget())
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Contenu de chaque région d’annonce (aria-live ou role=status) du rendu.
const liveTexts = (html: string) => [...html.matchAll(/<p[^>]*(?:aria-live="polite"|role="status")[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').trim())

describe('annonces des activités', () => {
  it('le HUD monte sa région d’issue vide et expose une barre de temps accessible', async () => {
    const html = await render(ActivityHud, { activity: 'ouija', outcome: 'play', startedAt: Date.now() })
    expect(liveTexts(html)).toEqual([''])
    expect(html).toMatch(/role="progressbar"[^>]*aria-label="Temps restant"/)
    expect(html).toMatch(/aria-valuenow="100"/)
  })

  it('le HUD annonce l’issue (seule source)', async () => {
    const html = await render(ActivityHud, { activity: 'wisps', outcome: 'fail', startedAt: Date.now() })
    expect(liveTexts(html)[0]).toBe('Partis au dépanneur.')
  })

  it('Fenêtres : la région d’annonce initiale est vide au montage', async () => {
    const html = await render(WindowsActivity, { level: 1 })
    expect(liveTexts(html).every((t) => !t.includes('Regardez bien'))).toBe(true)
  })

  it('Feux follets : bouton clavier actif et décrit hors de la région live, qui ne contient plus que l’état (rien au repos)', async () => {
    const html = await render(WispsActivity, { level: 1 })
    const button = html.match(/<button[^>]*>\s*Attraper le feu follet/)
    expect(button).not.toBeNull()
    expect(button![0]).not.toContain('aria-disabled')
    const id = button![0].match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`<p id="${id}" class="sr-only"[^>]*>Au clavier`))
    // La consigne n’est dans aucune région aria-live.
    expect(liveTexts(html).some((t) => t.includes('Au clavier'))).toBe(false)
    expect(html).not.toContain('apprivoiser')
  })

  it('Boule de cristal : role=application décrit par un texte d’aide relié', async () => {
    const html = await render(CrystalActivity, { level: 5 })
    const id = html.match(/role="application"[^>]*aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`id="${id}"[^>]*class="sr-only"[^>]*>[^<]*flèches`))
  })
})
