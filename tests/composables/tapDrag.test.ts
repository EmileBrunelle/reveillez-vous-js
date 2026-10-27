import { describe, expect, it } from 'vitest'
import { createTapDrag } from '../../src/composables/tapDrag'

describe('createTapDrag', () => {
  it('un tap court (< seuil) n’est pas un glissement', () => {
    const t = createTapDrag(10)
    t.start(100, 100)
    expect(t.move(104, 103)).toBe(false)
    t.end()
    expect(t.moved).toBe(false)
  })
  it('dépasser le seuil marque le glissement, même si le doigt revient', () => {
    const t = createTapDrag(10)
    t.start(0, 0)
    expect(t.move(20, 0)).toBe(true)
    expect(t.move(1, 0)).toBe(true)
  })
  it('ignore les mouvements sans contact et repart à zéro au contact suivant', () => {
    const t = createTapDrag(10)
    expect(t.move(500, 500)).toBe(false)
    t.start(0, 0)
    t.move(50, 0)
    t.end()
    t.start(0, 0)
    expect(t.moved).toBe(false)
    expect(t.active).toBe(true)
  })
})
