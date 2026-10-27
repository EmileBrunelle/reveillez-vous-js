import { describe, expect, it } from 'vitest'
import { finishAnimations } from '../../src/composables/finishAnimations'

describe('finishAnimations (clic pendant l’ouverture de « À propos »)', () => {
  it('mène chaque animation à sa fin avant de l’arrêter, sans quoi la fenêtre reste figée à mi-course', () => {
    const calls: string[] = []
    const a = { complete: () => calls.push('a.complete'), stop: () => calls.push('a.stop') }
    const b = { complete: () => calls.push('b.complete'), stop: () => calls.push('b.stop') }
    finishAnimations([a, b])
    expect(calls).toEqual(['a.complete', 'b.complete', 'a.stop', 'b.stop'])
  })
  it('tolère une animation sans complete()', () => {
    let stopped = false
    finishAnimations([{ stop: () => (stopped = true) }])
    expect(stopped).toBe(true)
  })
})
