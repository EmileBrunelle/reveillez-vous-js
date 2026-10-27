import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import { nextProphecy, premiereFor } from '../../src/engine/prophecy'
import { prophecies } from '../../src/content/prophecies'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const g = { premiere1: ['Q|Corps première {x}|V'], niveau1: ['Q|Corps normal {x}|V'], seche1: ['Q|Corps sec|V'], x: ['a'] }

describe('première lecture de la session', () => {
  it('tire dans premiere1 (jamais niveau1 ni seche1), quel que soit le rng', () => {
    for (let seed = 1; seed <= 50; seed++) expect(nextProphecy(g, 1, memStore(), mulberry32(seed), undefined, true).body).toBe('Corps première a')
  })
  it('sans le drapeau, ou à un autre niveau, la table normale reste utilisée', () => {
    expect(nextProphecy(g, 1, memStore(), mulberry32(3), undefined, false).body).not.toContain('première')
    expect(nextProphecy({ ...g, niveau2: ['Q|N2|V'] }, 2, memStore(), mulberry32(3), undefined, true).body).toBe('N2')
  })
  it('contenu réel : premiere1 existe et reste sans clin d’œil complotiste', () => {
    const t = premiereFor(prophecies)
    expect(t.length).toBeGreaterThanOrEqual(5)
    for (const tpl of t) expect(tpl, tpl).not.toMatch(/industrie|dit-on|charisme|fausse fête|coïncidence|vendre/i)
    for (let seed = 1; seed <= 30; seed++) {
      const p = nextProphecy(prophecies, 1, memStore(), mulberry32(seed), undefined, true)
      expect(p.body.length).toBeGreaterThan(0)
    }
  })
})
