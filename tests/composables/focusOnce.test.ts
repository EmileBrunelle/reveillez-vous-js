import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFocusOnce } from '../../src/composables/focusOnce'

class FakeEl {}
beforeEach(() => vi.stubGlobal('HTMLElement', FakeEl))
afterEach(() => vi.unstubAllGlobals())

describe('createFocusOnce', () => {
  it('ne focalise qu’une fois par élément malgré les rappels du ref fonction', () => {
    const focus = vi.fn()
    const ref = createFocusOnce(focus)
    const a = new FakeEl()
    ref(a)
    ref(a)
    ref(a)
    expect(focus).toHaveBeenCalledTimes(1)
  })
  it('refocalise un nouvel élément (réapparition) et ignore null', () => {
    const focus = vi.fn()
    const ref = createFocusOnce(focus)
    ref(new FakeEl())
    ref(null)
    ref(new FakeEl())
    expect(focus).toHaveBeenCalledTimes(2)
  })
})
