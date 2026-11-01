// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import DoorShading from '@/components/DoorShading.vue'
import DoorGround from '@/components/DoorGround.vue'
import { doorLooks, lookFor } from '@/engine/doorLook'
import { doors } from '@/content/scenes'

describe('doorLook', () => {
  it('décrit l’éclairage de chaque porte du jeu', () => {
    doors.forEach((d) => expect(doorLooks[d.id], d.id).toBeDefined())
  })
  it('garde des valeurs utilisables par les filtres', () => {
    Object.values(doorLooks).forEach((l) => {
      expect(l.azimuth).toBeGreaterThanOrEqual(0)
      expect(l.azimuth).toBeLessThan(360)
      expect(l.gain).toBeGreaterThan(0.5)
      expect(l.gain).toBeLessThan(1.3)
      expect(l.contact).toBeGreaterThanOrEqual(0)
      expect(l.contact).toBeLessThanOrEqual(1)
      expect(l.edge).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })
  it('retombe sur un éclairage par défaut pour une porte inconnue', () => {
    expect(lookFor('inconnue')).toBe(doorLooks.perron)
  })
})

describe('DoorShading', () => {
  it('enveloppe le contenu dans un filtre SVG dont l’identifiant est celui référencé', () => {
    const w = mount(DoorShading, { props: { doorId: 'cabane' }, slots: { default: () => h('p', { class: 'contenu' }, 'porte') } })
    const id = w.get('filter').attributes('id')
    expect(id).toMatch(/^door-shade-/)
    expect(w.get('div.block > div').attributes('style')).toContain(`url(#${id})`)
    expect(w.get('.contenu').text()).toBe('porte')
  })
  it('reste décoratif : le filtre est caché des technologies d’assistance', () => {
    const w = mount(DoorShading, { props: { doorId: 'frigo' } })
    expect(w.get('svg').attributes('aria-hidden')).toBe('true')
  })
})

describe('DoorGround', () => {
  it('rend l’ombre au sol et la brume, sans intercepter les gestes', () => {
    ;(['sol', 'brume'] as const).forEach((layer) => {
      const w = mount(DoorGround, { props: { doorId: 'maison', layer } })
      expect(w.classes()).toContain('pointer-events-none')
      expect(w.attributes('aria-hidden')).toBe('true')
    })
  })
})

describe('DoorShading en qualité `low` (flat)', () => {
  const contenu = { default: () => h('p', { class: 'contenu' }, 'porte') }
  it('aucun filtre SVG n’est appliqué : ni <filter>, ni propriété `filter` ; le contenu est rendu', () => {
    const w = mount(DoorShading, { props: { doorId: 'cabane', flat: true, mask: '/m.svg' }, slots: contenu })
    expect(w.find('filter').exists()).toBe(false)
    expect(w.find('svg').exists()).toBe(false)
    expect(w.html()).not.toMatch(/filter\s*:/)
    expect(w.get('.contenu').text()).toBe('porte')
  })
  it('l’ombrage statique est découpé sur la silhouette : teinte, lumière, biseau (dégradés CSS)', () => {
    const w = mount(DoorShading, { props: { doorId: 'perron', flat: true, mask: '/m.svg' }, slots: contenu })
    const calques = w.findAll('[aria-hidden="true"]')
    expect(calques.length).toBeGreaterThanOrEqual(3)
    expect(calques.every((c) => c.attributes('style')?.includes('mask-image'))).toBe(true)
    expect(w.html()).toContain('linear-gradient')
    expect(w.html()).toContain('box-shadow')
  })
  it('sans masque (cadre) : le contenu seul, sans calque', () => {
    const w = mount(DoorShading, { props: { doorId: 'maison', flat: true }, slots: contenu })
    expect(w.findAll('[aria-hidden="true"]')).toHaveLength(0)
    expect(w.find('filter').exists()).toBe(false)
  })
  it('par défaut (high, medium), le filtre est bien là', () => {
    expect(
      mount(DoorShading, { props: { doorId: 'cabane' } })
        .find('filter')
        .exists(),
    ).toBe(true)
  })
})
