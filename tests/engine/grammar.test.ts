import { describe, expect, it } from 'vitest'
import { expand, expandFields, expandTemplate, isObjectTable, isStringTable, type Grammar } from '../../src/../src/engine/grammar'
import { mulberry32 } from '../../src/../src/engine/rng'

const g: Grammar = {
  start: ['{p.a}/{p.b}/{p.a}'],
  p: [
    { a: 'A1', b: 'B1' },
    { a: 'A2', b: 'B2' },
    { a: 'A3', b: 'B3' },
  ],
}

describe('grammar', () => {
  it('injected rng makes output deterministic', () => {
    for (let s = 0; s < 50; s++) {
      expect(expand(g, 'start', mulberry32(s))).toBe(expand(g, 'start', mulberry32(s)))
    }
  })

  it('paired fields always come from the same entry', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 300; s++) {
      const [a, b, a2] = expand(g, 'start', mulberry32(s)).split('/')
      expect(a).toBe(a2)
      expect(a.slice(1)).toBe(b.slice(1))
      seen.add(a)
    }
    expect(seen.size).toBe(3)
  })

  it('expandTemplate expands a raw template against shared tables', () => {
    for (let s = 0; s < 50; s++) {
      const out = expandTemplate(g, 'Q|{p.a} et {p.b}|V', mulberry32(s))
      const [q, body, v] = out.split('|')
      expect([q, v]).toEqual(['Q', 'V'])
      expect(body).toMatch(/^A(\d) et B\1$/)
    }
  })

  it('expands nested references', () => {
    const n: Grammar = { start: ['{a}'], a: ['x{b}x'], b: ['{c}'], c: ['ok'] }
    expect(expand(n, 'start', mulberry32(1))).toBe('xokx')
    expect(expandTemplate(n, '[{a}]', mulberry32(1))).toBe('[xokx]')
  })

  it('stops on infinite recursion', () => {
    const r: Grammar = { start: ['{start}'] }
    expect(() => expand(r, 'start', mulberry32(1))).not.toThrow()
    expect(() => expandTemplate(r, '{start}', mulberry32(1))).not.toThrow()
  })

  it('au-delà de la profondeur maximale, la référence est laissée telle quelle (aucune boucle)', () => {
    const r: Grammar = { start: ['{start}'], deep: ['a{deep}'] }
    expect(expand(r, 'start', mulberry32(1))).toBe('{start}')
    const out = expand(r, 'deep', mulberry32(1))
    expect(out).toMatch(/^a+\{deep\}$/)
    expect(out.length).toBeLessThan(40)
  })

  it('throws on unknown table or field, naming it', () => {
    const g: Grammar = { start: ['{nope}'], p: [{ a: 'A' }], f: ['{p.b}'] }
    expect(() => expand(g, 'start', mulberry32(1))).toThrow(/nope/)
    expect(() => expand(g, 'f', mulberry32(1))).toThrow(/p\.b/)
    expect(() => expandTemplate(g, 'x {missing.field}', mulberry32(1))).toThrow(/missing/)
  })
})

describe('gardes de table', () => {
  it('table de chaînes : non vide, décidée par le premier élément', () => {
    expect(isStringTable(['a', 'b'])).toBe(true)
    expect(isObjectTable(['a', 'b'])).toBe(false)
  })
  it('table d’objets : non vide, décidée par le premier élément', () => {
    expect(isObjectTable([{ a: '1' }])).toBe(true)
    expect(isStringTable([{ a: '1' }])).toBe(false)
  })
  it('vide ou absente : ni l’une ni l’autre', () => {
    for (const t of [[], undefined]) {
      expect(isStringTable(t)).toBe(false)
      expect(isObjectTable(t)).toBe(false)
    }
  })
  it('table mixte : le premier élément décide ; un null n’est pas une entrée', () => {
    expect(isStringTable(['a', { x: '1' }] as unknown as Grammar[string])).toBe(true)
    expect(isObjectTable([{ x: '1' }, 'a'] as unknown as Grammar[string])).toBe(true)
    expect(isObjectTable([null] as unknown as Grammar[string])).toBe(false)
  })
  it('expand rejette une table vide', () => {
    expect(() => expand({ start: ['{v}'], v: [] }, 'start', mulberry32(1))).toThrow(/v/)
  })
})

describe('expandFields', () => {
  it('développe chaque champ avec une seule mémoïsation : une table à paires citée dans deux champs reste appariée', () => {
    const g: Grammar = {
      objet: [
        { nom: 'la boule', de: 'de la boule' },
        { nom: 'le tarot', de: 'du tarot' },
      ],
    }
    for (let seed = 1; seed <= 40; seed++) {
      const { a, b } = expandFields(g, { a: '{objet.nom}', b: '{objet.de}' }, mulberry32(seed))
      expect(['la boule|de la boule', 'le tarot|du tarot']).toContain(`${a}|${b}`)
    }
  })
})
