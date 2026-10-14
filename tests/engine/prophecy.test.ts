import { describe, expect, it } from 'vitest'
import type { Grammar } from '../../src/../src/engine/grammar'
import { prophecies } from '../../src/content/prophecies'
import { arcaneNameAt, doorLinesFor, nextDoorLine, nextEntrezLine, nextFailLine, nextProphecy, nextTabTitle, nextTitled, templatesFor } from '../../src/../src/engine/prophecy'
import { mulberry32 } from '../../src/../src/engine/rng'
import { pickVariant } from '../../src/../src/engine/variant'
import { BAGS_KEY } from '../../src/engine/shuffleBag'
import { detectBrowser } from '../../src/effects/webgpu'

const g: Grammar = {
  niveau1: ['Q1|{x}|V1', 'Q2|{x}|V2'],
  porte1: ['Toc {x}'],
  rate1: ['Raté {x}'],
  entrez: ['Entrez'],
  x: ['a', 'b'],
}
const store = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('prophecy', () => {
  it('reads niveauN / porteN tables, empty when missing', () => {
    expect(templatesFor(g, 1)).toHaveLength(2)
    expect(templatesFor(g, 3)).toEqual([])
    expect(doorLinesFor(g, 1)).toEqual(['Toc {x}'])
  })
  it('nextProphecy cycles every template before repeating and splits 3 parts', () => {
    const s = store()
    const rng = mulberry32(5)
    const qs = [0, 1].map(() => nextProphecy(g, 1, s, rng).question)
    expect(new Set(qs)).toEqual(new Set(['Q1', 'Q2']))
    expect(nextProphecy(g, 1, s, rng).verse).toMatch(/^V[12]$/)
  })
  it('verses go through a shuffle bag: N draws give N distinct verses', () => {
    const versets = ['A 1:1', 'B 2:2', 'C 3:3', 'D 4:4', 'E 5:5']
    const gv: Grammar = { niveau1: ['Q|corps|{verset}'], verset: versets }
    const s = store()
    const rng = mulberry32(7)
    const seen = versets.map(() => nextProphecy(gv, 1, s, rng).verse)
    expect(new Set(seen)).toEqual(new Set(versets))
  })
  it('generative verses: no repeated book until all seen, format ok, old bag size ignored', () => {
    const livres = ['A', 'B', 'C', 'D', 'E', 'F']
    const gv: Grammar = { niveau1: ['Q|corps|{verset}'], verset_livre: livres, verset_ref: ['1:1', '2:22', '13:13'] }
    const s = store()
    s.setItem(BAGS_KEY, JSON.stringify({ verset: { order: [0, 1], pos: 1 }, verset_livre: { order: [0, 1], pos: 1 } }))
    const rng = mulberry32(11)
    const verses = Array.from({ length: 12 }, () => nextProphecy(gv, 1, s, rng).verse)
    for (const v of verses) expect(v).toMatch(/^[\p{Lu}][^|]* \d{1,2}:\d{1,2}$/u)
    const books = verses.map((v) => v.split(' ')[0])
    expect(new Set(books.slice(0, 6)).size).toBe(6)
    expect(new Set(books.slice(6)).size).toBe(6)
    books.slice(1).forEach((b, i) => expect(b).not.toBe(books[i]))
  })
  it('old `verset` table still works when the new tables are missing', () => {
    const gv: Grammar = { niveau1: ['Q|corps|{verset}'], verset: ['Vieux 1:1'] }
    expect(nextProphecy(gv, 1, store(), mulberry32(1)).verse).toBe('Vieux 1:1')
  })
  it('door line falls back when key is missing', () => {
    expect(nextDoorLine(g, 4, store(), mulberry32(1), 'fallback')).toBe('fallback')
    expect(nextDoorLine(g, 1, store(), mulberry32(1), 'fallback')).toMatch(/^Toc [ab]$/)
  })
  it('fail and give-up lines draw from their tables, with fallback', () => {
    expect(nextFailLine(g, 1, store(), mulberry32(1), 'fb')).toMatch(/^Raté [ab]$/)
    expect(nextFailLine(g, 3, store(), mulberry32(1), 'fb')).toBe('fb')
    expect(nextEntrezLine(g, store(), mulberry32(1), 'fb')).toBe('Entrez')
    expect(nextEntrezLine({}, store(), mulberry32(1), 'fb')).toBe('fb')
  })
})

describe('rappel de la carte précédente', () => {
  const gr: Grammar = {
    porte2: ['Porte {x}'],
    rappel2: ['Rappel {carte} / {carte_caps}'],
    arcane: [
      { numero: 'XIII bis', nom: 'Big Citrouille', symbole: 'pumpkin' },
      { numero: 'XIII ½', nom: 'Le Chat noir', symbole: 'cat' },
      { numero: 'XVIII', nom: 'La Lune', symbole: 'moon' },
    ],
    x: ['a'],
  }
  it('arcaneNameAt maps the integer index back to a name (ties resolved by rng)', () => {
    expect(arcaneNameAt(gr, 18, mulberry32(1))).toBe('La Lune')
    expect(arcaneNameAt(gr, null, mulberry32(1))).toBeNull()
    expect(arcaneNameAt(gr, 99, mulberry32(1))).toBeNull()
    expect(new Set(Array.from({ length: 40 }, (_, s) => arcaneNameAt(gr, 13, mulberry32(s))))).toEqual(new Set(['Big Citrouille', 'Le Chat noir']))
  })
  it('lastArcane null, level 1 or missing table: always the porte line', () => {
    for (let s = 0; s < 60; s++) {
      expect(nextDoorLine(gr, 2, store(), mulberry32(s), 'fb', { lastArcane: null })).toBe('Porte a')
      expect(nextDoorLine(gr, 2, store(), mulberry32(s), 'fb')).toBe('Porte a')
      expect(nextDoorLine({ ...gr, porte1: ['P1'], rappel1: ['R {carte}'] }, 1, store(), mulberry32(s), 'fb', { lastArcane: 18 })).toBe('P1')
      expect(nextDoorLine({ porte2: ['P'], arcane: gr.arcane }, 2, store(), mulberry32(s), 'fb', { lastArcane: 18 })).toBe('P')
    }
  })
  it('lastArcane set: both sources occur, {carte} is substituted, unknown index falls back to porte', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 80; s++) seen.add(nextDoorLine(gr, 2, store(), mulberry32(s), 'fb', { lastArcane: 18 }))
    expect(seen).toEqual(new Set(['Porte a', 'Rappel La Lune / LA LUNE']))
    for (let s = 0; s < 40; s++) expect(nextDoorLine(gr, 2, store(), mulberry32(s), 'fb', { lastArcane: 99 })).toBe('Porte a')
  })
  it('real content: every level 2..5 line expands with a real previous card', () => {
    for (let lvl = 2; lvl <= 5; lvl++) for (let s = 0; s < 80; s++) expect(nextDoorLine(prophecies, lvl, store(), mulberry32(s), 'fb', { lastArcane: 13 })).not.toMatch(/[{}]/)
  })
})

describe('titre d’onglet et bulles', () => {
  it('nextTabTitle draws onglet<N> with fallback', () => {
    const gt: Grammar = { onglet2: ['Revenez'] }
    expect(nextTabTitle(gt, 2, store(), mulberry32(1), 'Base')).toBe('Revenez')
    expect(nextTabTitle(gt, 3, store(), mulberry32(1), 'Base')).toBe('Base')
  })
  it('nextTitled splits « Titre|Texte », null when the table is missing', () => {
    expect(nextTitled({ bulle2: ['Titre|Un texte | avec barre'] }, 'bulle2', store(), mulberry32(1))).toEqual({ title: 'Titre', text: 'Un texte | avec barre' })
    expect(nextTitled({}, 'bulle2', store(), mulberry32(1))).toBeNull()
  })
})

describe('pickVariant', () => {
  const list = [
    { id: 'a', minLevel: 1 },
    { id: 'b', minLevel: 1 },
    { id: 'c', minLevel: 4 },
  ]
  it('respects minLevel and avoids the previous id', () => {
    for (let s = 0; s < 100; s++) {
      const v = pickVariant(list, 1, 'a', mulberry32(s))
      expect(v.id).toBe('b')
    }
    const seen = new Set(Array.from({ length: 200 }, (_, s) => pickVariant(list, 4, 'a', mulberry32(s)).id))
    expect(seen).toEqual(new Set(['b', 'c']))
  })
  it('returns the only eligible one even if it was last', () => {
    expect(pickVariant([{ id: 'a', minLevel: 1 }], 1, 'a', mulberry32(1)).id).toBe('a')
  })
})

describe('detectBrowser', () => {
  it('classifies common UAs', () => {
    expect(detectBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe('firefox')
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('chromium')
    expect(detectBrowser('Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17.0 Safari/605.1.15')).toBe('safari')
  })
})
