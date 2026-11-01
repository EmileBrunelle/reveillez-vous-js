import { describe, expect, it } from 'vitest'
import { createShadowBudget, cutShadowsForSession, resetShadowVerdict, shadowsCutForSession, SHADOWS_OFF_MEDIA, SHADOW_BUDGET_MS, SHADOW_WINDOW } from '@/effects/shadowQuality'

describe('qualité des ombres', () => {
  it('coupe les ombres sur pointeur grossier et sous 641 px de large', () => {
    expect(SHADOWS_OFF_MEDIA).toContain('(pointer: coarse)')
    expect(SHADOWS_OFF_MEDIA).toContain('(max-width: 640px)')
  })

  it('reste actif tant que la moyenne d’une fenêtre tient dans le budget', () => {
    const b = createShadowBudget(SHADOW_BUDGET_MS)
    for (let i = 0; i < SHADOW_WINDOW * 3; i++) b.push(SHADOW_BUDGET_MS - 1)
    expect(b.over).toBe(false)
  })

  it('un à-coup isolé ne coupe pas, une fenêtre trop chère coupe pour de bon', () => {
    const b = createShadowBudget(10, 10)
    for (let i = 0; i < 9; i++) b.push(5)
    b.push(100) // moyenne 14,5 sur la fenêtre : dépasse
    expect(b.over).toBe(true)
    for (let i = 0; i < 50; i++) b.push(1) // pas de va-et-vient
    expect(b.over).toBe(true)
    const c = createShadowBudget(10, 10)
    for (let i = 0; i < 9; i++) c.push(5)
    c.push(40) // moyenne 8,5 : tient
    expect(c.over).toBe(false)
  })

  it('ignore les mesures invalides ou celles d’une reprise après pause', () => {
    const b = createShadowBudget(10, 3)
    for (const v of [Number.NaN, -1, 5000, Infinity]) b.push(v)
    b.push(1)
    b.push(1)
    b.push(1)
    expect(b.over).toBe(false)
  })

  it('le verdict de session se retient et se remet à zéro', () => {
    resetShadowVerdict()
    expect(shadowsCutForSession()).toBe(false)
    cutShadowsForSession()
    expect(shadowsCutForSession()).toBe(true)
    resetShadowVerdict()
    expect(shadowsCutForSession()).toBe(false)
  })
})
