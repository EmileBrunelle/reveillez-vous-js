import { describe, expect, it } from 'vitest'
import { aimPoint, TOUCH_GRACE_MS, TOUCH_LIFT } from '../../src/composables/touchAim'

const rect = { left: 10, top: 20 }
describe('aimPoint', () => {
  it('décale la cible de 40 px au-dessus du doigt', () => {
    expect(aimPoint({ clientX: 110, clientY: 220, pointerType: 'touch' }, rect)).toEqual({ x: 100, y: 200 - TOUCH_LIFT })
    expect(TOUCH_LIFT).toBe(40)
  })
  it('souris et stylet : aucun décalage', () => {
    expect(aimPoint({ clientX: 110, clientY: 220, pointerType: 'mouse' }, rect)).toEqual({ x: 100, y: 200 })
    expect(aimPoint({ clientX: 110, clientY: 220, pointerType: 'pen' }, rect)).toEqual({ x: 100, y: 200 })
  })
  it('la tolérance du doigt levé est de 300 ms', () => {
    expect(TOUCH_GRACE_MS).toBe(300)
  })
})
