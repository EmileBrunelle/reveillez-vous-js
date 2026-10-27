import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import { nextProphecy, premiereFor, templatesFor } from '../../src/engine/prophecy'
import { prophecies } from '../../src/content/prophecies'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const g = {
  premiere1: ['Q|Corps A {x}|V'],
  niveau1: ['Q|Corps A {x}|V', 'Q|Corps B {x}|V', 'Q|Corps C {x}|V'],
  seche1: ['Q|Corps sec|V'],
  x: ['a'],
}

describe('première lecture de la session', () => {
  it('tire toujours un gabarit de premiere1, quel que soit le rng', () => {
    for (let seed = 1; seed <= 50; seed++) expect(nextProphecy(g, 1, memStore(), mulberry32(seed), undefined, true).body).toBe('Corps A a')
  })
  it('ne tire jamais la table sèche à la première lecture', () => {
    for (let seed = 1; seed <= 100; seed++) expect(nextProphecy(g, 1, memStore(), mulberry32(seed), undefined, true).body).not.toBe('Corps sec')
  })
  it('la lecture suivante du niveau 1 ne répète pas la première (avant la fin de la ronde)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const store = memStore()
      const rng = mulberry32(seed)
      const first = nextProphecy(g, 1, store, rng, undefined, true).body
      const bodies = [first]
      // Les tirages sont dans le sac niveau1 (3 gabarits) ; on ignore les tirages secs, qui ont leur propre sac.
      for (let i = 0; i < 2; i++) {
        const p = nextProphecy(g, 1, store, rng, undefined, false)
        if (p.body !== 'Corps sec') bodies.push(p.body)
      }
      expect(new Set(bodies).size, `seed ${seed}`).toBe(bodies.length)
    }
  })
  it('sans le drapeau, ou à un autre niveau, la table normale reste utilisée', () => {
    const bodies = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) bodies.add(nextProphecy(g, 1, memStore(), mulberry32(seed), undefined, false).body)
    expect([...bodies].some((b) => b !== 'Corps A a')).toBe(true)
    expect(nextProphecy({ ...g, niveau2: ['Q|N2|V'] }, 2, memStore(), mulberry32(3), undefined, true).body).toBe('N2')
  })
  it('contenu réel : premiere1 est inclus littéralement dans niveau1, sans clin d’œil complotiste', () => {
    const t = premiereFor(prophecies)
    const all = templatesFor(prophecies, 1)
    expect(t.length).toBeGreaterThanOrEqual(5)
    expect(all.length).toBeGreaterThanOrEqual(3)
    for (const tpl of t) {
      expect(all, tpl).toContain(tpl)
      expect(tpl, tpl).not.toMatch(/industrie|dit-on|charisme|fausse fête|coïncidence|vendre/i)
    }
  })
  it('contenu réel : la première lecture vient de premiere1 et jamais de seche1', () => {
    const t = premiereFor(prophecies)
    for (let seed = 1; seed <= 60; seed++) {
      const store = memStore()
      nextProphecy(prophecies, 1, store, mulberry32(seed), undefined, true)
      const bag = JSON.parse(store.getItem('rvj-bags') ?? '{}')
      expect(bag.seche1, `seed ${seed}`).toBeUndefined()
      const idx = bag.niveau1.order[0]
      expect(t).toContain(templatesFor(prophecies, 1)[idx])
    }
  })
})
