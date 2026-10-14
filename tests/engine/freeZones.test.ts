import { describe, expect, it } from 'vitest'
import { intersects, pickFreeSlot, type Box } from '../../src/engine/freeZones'
import { mulberry32 } from '../../src/engine/rng'

const area: Box = { left: 0, top: 0, right: 1280, bottom: 760 }
const card: Box = { left: 450, top: 40, right: 830, bottom: 700 }

describe('pickFreeSlot', () => {
  it('never returns a slot touching an avoided rect, within the area', () => {
    for (let s = 0; s < 100; s++) {
      const slot = pickFreeSlot(area, 288, 176, [card], mulberry32(s))
      expect(slot).not.toBeNull()
      const b = { left: slot!.x, top: slot!.y, right: slot!.x + 288, bottom: slot!.y + 176 }
      expect(intersects(b, card, 12)).toBe(false)
      expect(b.left).toBeGreaterThanOrEqual(0)
      expect(b.right).toBeLessThanOrEqual(1280)
      expect(b.bottom).toBeLessThanOrEqual(760)
    }
  })
  it('returns null when everything is covered or the area is too small', () => {
    expect(pickFreeSlot(area, 288, 176, [{ left: 0, top: 0, right: 1280, bottom: 760 }], mulberry32(1))).toBeNull()
    expect(pickFreeSlot({ left: 0, top: 0, right: 200, bottom: 200 }, 288, 176, [], mulberry32(1))).toBeNull()
  })
  it('intersects honours the margin', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    const b = { left: 14, top: 0, right: 20, bottom: 10 }
    expect(intersects(a, b)).toBe(false)
    expect(intersects(a, b, 5)).toBe(true)
  })
})
