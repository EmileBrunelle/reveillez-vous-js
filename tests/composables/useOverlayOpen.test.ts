import { describe, expect, it } from 'vitest'

// Environnement node : on stube Element avant d’importer le module (instanceof Element).
class FakeElement {
  readonly inside: boolean
  constructor(inside: boolean) {
    this.inside = inside
  }
  closest() {
    return this.inside ? this : null
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
    expect(isOverlayActive(new FakeElement(false), new FakeElement(false), root())).toBe(false)
    expect(isOverlayActive(null, null, root())).toBe(false)
  })
  it('cible dans une fenêtre ou un menu', () => {
    expect(isOverlayActive(new FakeElement(true), null, root())).toBe(true)
  })
  it('focus dans une fenêtre ou un menu', () => {
    expect(isOverlayActive(null, new FakeElement(true), root())).toBe(true)
  })
  it('un dialogue ouvert prend toutes les touches', () => {
    expect(isOverlayActive(null, null, root(true))).toBe(true)
  })
  it('menu caché (v-show, offsetParent nul) ignoré, menu visible compte', () => {
    expect(isOverlayActive(null, null, root(false, [null]))).toBe(false)
    expect(isOverlayActive(null, null, root(false, [null, {}]))).toBe(true)
  })
  it('cible non-élément (document, fenêtre) ignorée', () => {
    expect(isOverlayActive({}, undefined, root())).toBe(false)
  })
})
