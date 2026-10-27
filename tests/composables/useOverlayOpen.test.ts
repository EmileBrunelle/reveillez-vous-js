import { describe, expect, it } from 'vitest'

// Environnement node : on stube Element avant d’importer le module (instanceof Element).
class FakeElement {
  readonly inside: boolean
  readonly isConnected: boolean
  readonly offsetParent: unknown
  constructor(inside: boolean, isConnected = true, offsetParent: unknown = {}) {
    this.inside = inside
    this.isConnected = isConnected
    this.offsetParent = offsetParent
  }
  // Simule un menu : `closest('[role=menu]')` le trouve, `closest('dialog[open]')` non.
  closest(selector: string) {
    return this.inside && selector === '[role=menu]' ? this : null
  }
}
;(globalThis as unknown as { Element: unknown }).Element = FakeElement

const { isOverlayActive } = await import('../../src/composables/useOverlayOpen')

const root = (dialog = false, menus: Array<unknown> = []) => ({
  querySelector: () => (dialog ? {} : null),
  querySelectorAll: () => menus.map((offsetParent) => ({ offsetParent })),
})

describe('isOverlayActive', () => {
  it('rien d’ouvert : la touche passe', () => {
    expect(isOverlayActive(new FakeElement(false), root())).toBe(false)
    expect(isOverlayActive(null, root())).toBe(false)
  })
  it('cible dans un menu visible', () => {
    expect(isOverlayActive(new FakeElement(true), root())).toBe(true)
  })
  it('élément focalisé détaché ou dans un menu masqué : pas d’overlay', () => {
    expect(isOverlayActive(new FakeElement(true, false), root())).toBe(false)
    expect(isOverlayActive(new FakeElement(true, true, null), root())).toBe(false)
  })
  it('un dialogue ouvert prend toutes les touches', () => {
    expect(isOverlayActive(null, root(true))).toBe(true)
  })
  it('menu caché (v-show, offsetParent nul) ignoré, menu visible compte', () => {
    expect(isOverlayActive(null, root(false, [null]))).toBe(false)
    expect(isOverlayActive(null, root(false, [null, {}]))).toBe(true)
  })
  it('cible non-élément (document, fenêtre) ignorée', () => {
    expect(isOverlayActive({}, root())).toBe(false)
  })
})
