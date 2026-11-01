// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- doublure de composant dans le test */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { useLocale } from '@vuetify/v0'
import { createAppLocale } from '@/locale'
import { activityFor, loadAbout, prefetch } from '@/lazy'

describe('locale : createAppLocale', () => {
  it('s’installe comme plugin Vue sans avertissement et traduit « Fermer » en français', () => {
    const warn = vi.spyOn(console, 'warn')
    let fermer: string | undefined
    const app = createApp({
      setup() {
        fermer = useLocale().ti('Dialog.close')
        return () => null
      },
    })
    app.use(createAppLocale())
    app.mount(document.createElement('div'))
    expect(fermer).toBe('Fermer')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    app.unmount()
  })
})

describe('lazy : chargeurs', () => {
  it('activityFor : aucune activité sans identifiant ; chaque identifiant charge son propre composant', async () => {
    expect(activityFor(null)).toBeNull()
    const noms = new Set<unknown>()
    for (const id of ['wisps', 'candles', 'ouija', 'windows', 'crystal'] as const) {
      const module = await activityFor(id)!()
      expect(module.default).toBeDefined()
      noms.add(module.default)
    }
    expect(noms.size).toBe(5) // cinq composants distincts, pas le même chargeur répété
  })

  it('prefetch appelle chaque chargeur et n’échoue jamais (réseau coupé)', async () => {
    const ok = vi.fn(() => Promise.resolve(1))
    const ko = vi.fn(() => Promise.reject(new Error('réseau')))
    expect(() => prefetch(ok, ko)).not.toThrow()
    expect(ok).toHaveBeenCalledOnce()
    expect(ko).toHaveBeenCalledOnce()
    await Promise.resolve() // laisse le catch interne consommer le rejet : aucun rejet non géré
  })

  it('loadAbout charge la fenêtre « À propos »', async () => {
    const { default: About } = await loadAbout()
    expect((About as { __name?: string }).__name).toBe('About')
  })
})

describe('main.ts : démarrage', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/App.vue')
    document.body.innerHTML = ''
  })

  it('monte l’application dans #app, avec Pinia et la locale', async () => {
    vi.resetModules()
    vi.doMock('@/App.vue', async () => {
      const { defineComponent, h } = await import('vue')
      const { useProgressStore } = await import('@/stores/progress')
      return {
        default: defineComponent({
          setup() {
            useProgressStore() // échoue sans Pinia installé
            return () => h('p', { id: 'monte' }, 'prêt')
          },
        }),
      }
    })
    document.body.innerHTML = '<div id="app"></div>'
    await import('@/main')
    expect(document.querySelector('#app #monte')?.textContent).toBe('prêt')
  })
})
