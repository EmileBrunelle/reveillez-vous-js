import { describe, expect, it } from 'vitest'
import { finaleActive } from '../../src/engine/finaleFlow'

describe('finaleActive', () => {
  it('n’accepte les événements de la finale que pendant la phase finale', () => {
    expect(finaleActive('finale')).toBe(true)
    // Reset depuis le menu pendant la finale : la phase passe à « door », un `collapsed` ou `restart` tardif est ignoré.
    for (const p of ['door', 'activity', 'cut', 'reading']) expect(finaleActive(p)).toBe(false)
  })
})
