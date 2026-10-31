import { describe, expect, it } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { registerLayoutEl } from '../../src/composables/layoutRefs'

const fakeEl = () => ({}) as HTMLElement

describe('registerLayoutEl', () => {
  it('publie l’élément, puis le libère à la fin du scope (avant que la ref de gabarit passe à null)', () => {
    const target = shallowRef<HTMLElement | null>(null)
    const el = shallowRef<HTMLElement | null>(fakeEl())
    const scope = effectScope()
    scope.run(() => registerLayoutEl(target, el))
    expect(target.value).toBe(el.value)
    scope.stop()
    expect(target.value).toBeNull()
  })
  it('ne libère pas un élément déjà remplacé par un autre composant', () => {
    const target = shallowRef<HTMLElement | null>(null)
    const old = effectScope()
    old.run(() => registerLayoutEl(target, shallowRef(fakeEl())))
    const next = fakeEl()
    target.value = next
    old.stop()
    expect(target.value).toBe(next)
  })
})
