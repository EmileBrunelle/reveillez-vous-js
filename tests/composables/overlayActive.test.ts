import { describe, expect, it } from 'vitest'
import { isOverlayActive } from '../../src/composables/overlayActive'

const root = (dialog = false, menus: Array<unknown> = []) => ({
  querySelector: () => (dialog ? {} : null),
  querySelectorAll: () => menus.map((offsetParent) => ({ offsetParent })),
})

describe('isOverlayActive', () => {
  it('rien d’ouvert : la touche passe', () => {
    expect(isOverlayActive(root())).toBe(false)
  })
  it('un dialogue ouvert prend toutes les touches', () => {
    expect(isOverlayActive(root(true))).toBe(true)
  })
  it('menu caché (v-show, offsetParent nul) ignoré, menu visible compte', () => {
    expect(isOverlayActive(root(false, [null]))).toBe(false)
    expect(isOverlayActive(root(false, [null, {}]))).toBe(true)
  })
})
