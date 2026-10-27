import { describe, expect, it } from 'vitest'
import { isDrag } from '../../src/components/deckTouch'

describe('deckTouch', () => {
  it('distingue tap et glissement', () => {
    expect(isDrag(2, 3)).toBe(false)
    expect(isDrag(9, 0)).toBe(true)
  })
})
