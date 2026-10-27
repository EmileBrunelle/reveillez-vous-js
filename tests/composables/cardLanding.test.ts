import { describe, expect, it, vi } from 'vitest'
import { createLanding, RIPPLE_AMP } from '../../src/composables/cardLanding'

const make = (reduced: boolean) => {
  const deps = { reduced: () => reduced, thud: vi.fn(), ripple: vi.fn(), shimmer: vi.fn() }
  return { deps, landing: createLanding(deps) }
}

describe('createLanding', () => {
  it('déclenche son, ondulation et reflet une seule fois par retournement', () => {
    const { deps, landing } = make(false)
    landing.land()
    landing.land()
    expect(deps.thud).toHaveBeenCalledTimes(1)
    expect(deps.ripple).toHaveBeenCalledTimes(1)
    expect(deps.ripple).toHaveBeenCalledWith(RIPPLE_AMP)
    expect(deps.shimmer).toHaveBeenCalledTimes(1)
  })

  it('se réarme avec arm() pour le retournement suivant', () => {
    const { deps, landing } = make(false)
    landing.land()
    landing.arm()
    landing.land()
    expect(deps.thud).toHaveBeenCalledTimes(2)
    expect(deps.ripple).toHaveBeenCalledTimes(2)
  })

  it('mouvement réduit : le son reste, pas d’ondulation ni de reflet', () => {
    const { deps, landing } = make(true)
    landing.land()
    expect(deps.thud).toHaveBeenCalledTimes(1)
    expect(deps.ripple).not.toHaveBeenCalled()
    expect(deps.shimmer).not.toHaveBeenCalled()
  })
})
