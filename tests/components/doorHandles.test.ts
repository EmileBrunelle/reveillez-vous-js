import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { doorLooks, lookFor } from '@/components/doorLook'
import { doors } from '@/content/scenes'

// Nombre d’éléments `.door-handle` dans le SVG source de la porte (l’ordre de doorLook.handles suit celui du document).
const handleCount = (id: string) => (readFileSync(`src/assets/svg/porte-${id}.svg`, 'utf8').match(/class="door-handle"/g) ?? []).length

describe('poignées des portes', () => {
  it('décrit un mécanisme pour chaque poignée du SVG de chaque porte', () => {
    doors.forEach((d) => expect(lookFor(d.id).handles, d.id).toHaveLength(handleCount(d.id)))
  })
  it('ne fait pas tourner les poignées du frigo : barres fixes, battant qui se décolle', () => {
    expect(doorLooks.frigo.handles).toEqual(['bar', 'bar'])
    expect(doorLooks.frigo.tug).toBeGreaterThan(0)
  })
  it('ne fait tirer que les portes à joint', () => {
    Object.entries(doorLooks).forEach(([id, l]) => {
      if (id !== 'frigo') expect(l.tug, id).toBe(0)
    })
  })
  it('garde les boutons ronds, les béquilles et les barres à leur place', () => {
    expect(doorLooks.perron.handles).toEqual(['knob', 'bar'])
    expect(doorLooks.cabane.handles).toEqual(['lever'])
    ;(['mausolee', 'maison', 'nuages', 'garde-robe'] as const).forEach((id) => doorLooks[id].handles.forEach((h) => expect(h, id).toBe('knob')))
  })
})
