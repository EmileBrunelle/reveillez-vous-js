import { describe, expect, it } from 'vitest'
import { clampOffset, GRAB } from '@/composables/useWinDrag'

// Fenêtre de 400 px centrée dans un écran de 1280×800 : gauche 440, haut 200. Barre des tâches 44 px, barre de titre 28 px.
const rest = { left: 440, top: 200, width: 400 }
const b = { vw: 1280, vh: 800, taskbar: 44, bar: 28, grab: GRAB }

describe('clampOffset', () => {
  it('laisse passer un déplacement dans la zone visible', () => {
    expect(clampOffset({ x: 200, y: 100 }, rest, b)).toEqual({ x: 200, y: 100 })
  })
  it('la barre de titre ne sort pas par le haut', () => {
    expect(clampOffset({ x: 0, y: -999 }, rest, b).y).toBe(-200)
  })
  it('la barre de titre ne passe pas sous la barre des tâches', () => {
    // bas de la barre de titre = 800 - 44 : haut de la fenêtre au plus à 728, soit un décalage de 528
    expect(clampOffset({ x: 0, y: 9999 }, rest, b).y).toBe(800 - 44 - 28 - 200)
  })
  it('garde de quoi saisir la fenêtre à droite et à gauche', () => {
    expect(clampOffset({ x: 9999, y: 0 }, rest, b).x).toBe(1280 - GRAB - 440)
    expect(clampOffset({ x: -9999, y: 0 }, rest, b).x).toBe(GRAB - 440 - 400)
  })
})

describe('clampOffset après rétrécissement du viewport', () => {
  it('un décalage valide à 1280 px devient borné à 900 px', () => {
    const wide = clampOffset({ x: 700, y: 0 }, rest, b)
    expect(wide.x).toBe(700) // valide à 1280 px : bord gauche à 1140
    // à 900 px, la fenêtre recentrée (gauche 250) ne peut aller que jusqu’à 900 - GRAB - 250
    const narrowRest = { left: 250, top: 200, width: 400 }
    const after = clampOffset(wide, narrowRest, { ...b, vw: 900 })
    expect(after.x).toBe(900 - GRAB - 250)
    expect(250 + after.x).toBeLessThanOrEqual(900 - GRAB)
  })
})

describe('clampOffset avec un écran plus bas que la barre des tâches et la barre de titre', () => {
  it('garde la borne haute : la fenêtre ne sort pas par le haut', () => {
    expect(clampOffset({ x: 0, y: 50 }, rest, { ...b, vh: 60 }).y).toBe(-200)
  })
})
