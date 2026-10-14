import { describe, expect, it } from 'vitest'
import { expandTemplate, type Grammar, type ObjectTable } from '../../src/engine/grammar'
import { mulberry32 } from '../../src/engine/rng'
import { carteTables } from '../../src/engine/prophecy'
import { prophecies } from '../../src/content/prophecies'
import { BANNED, CONTRACTIONS, RELIGION, bannedRe } from './rules'

describe('T6 tables (rappel, onglet, bulle, erreur)', () => {
  const arcanes = prophecies.arcane as ObjectTable
  const asGrammar = (nom: string): Grammar => ({ ...prophecies, ...carteTables(nom) })
  const tables: { prefix: string; levels: number[]; min: number; max: number }[] = [
    { prefix: 'rappel', levels: [2, 3, 4, 5], min: 6, max: 110 },
    { prefix: 'onglet', levels: [1, 2, 3, 4, 5], min: 3, max: 40 },
    { prefix: 'bulle', levels: [2, 3, 4, 5], min: 4, max: 110 },
    { prefix: 'erreur', levels: [3, 4, 5], min: 4, max: 130 },
  ]
  for (const { prefix, levels, min, max } of tables) {
    it(`${prefix}*: ≥ ${min} lines, ≤ ${max} chars, typography and banned words on every expansion`, () => {
      for (const n of levels) {
        const t = prophecies[`${prefix}${n}`] as string[]
        expect(Array.isArray(t) && typeof t[0] === 'string', `${prefix}${n}`).toBe(true)
        expect(t.length, `${prefix}${n}`).toBeGreaterThanOrEqual(min)
        expect(new Set(t).size, `${prefix}${n} dedupe`).toBe(t.length)
        for (const [i, tpl] of t.entries()) {
          for (const arc of prefix === 'rappel' ? arcanes : [arcanes[0]]) {
            const out = expandTemplate(asGrammar(arc.nom), tpl, mulberry32(i + 1))
            const ctx = `${prefix}${n}[${i}] (${arc.nom}): ${out}`
            expect(out.length, ctx).toBeLessThanOrEqual(max)
            expect(out, ctx).not.toMatch(/[{}]/)
            expect(out, ctx).not.toContain("'")
            expect(out, ctx).not.toMatch(/ {2}/)
            for (const c of CONTRACTIONS) expect(out.toLowerCase(), ctx).not.toContain(c)
            expect(out, ctx).not.toMatch(/\b(ce|le|de|du|que) Halloween/i)
            // « de/à » devant un nom de carte (« de La Lune », « à Le Chat noir ») : contraction impossible, tournure interdite.
            expect(out, ctx).not.toMatch(/\b(de|à) (Le|La|Les|L’)/)
            expect(out, ctx).not.toMatch(/terry|davis|templeos|holyc/i)
            for (const w of [...BANNED, ...RELIGION]) expect(out, `${w} in ${ctx}`).not.toMatch(bannedRe(w))
            if (prefix === 'bulle' || prefix === 'erreur') {
              const [title, ...rest] = out.split('|')
              expect(rest.length, ctx).toBe(1)
              expect(title.trim().length, ctx).toBeGreaterThan(0)
              expect(rest[0].trim().length, ctx).toBeGreaterThan(0)
            } else expect(out, ctx).not.toContain('|')
          }
        }
      }
    })
  }
  it('rappel*: every line mentions the previous card', () => {
    for (const n of [2, 3, 4, 5]) for (const tpl of prophecies[`rappel${n}`] as string[]) expect(tpl).toMatch(/\{carte(_maj|_caps)?\}/)
  })
  it('rappel*: {carte} never starts a sentence (use {carte_maj})', () => {
    for (const n of [2, 3, 4, 5]) for (const tpl of prophecies[`rappel${n}`] as string[]) expect(tpl, tpl).not.toMatch(/(^|[.!?…—] )\{carte\}/)
  })
  it('new tables: no « ils », « iel(s) », « eux » or point médian (épicène wording only)', () => {
    for (const prefix of ['rappel', 'onglet', 'bulle', 'erreur']) {
      for (let n = 1; n <= 5; n++) {
        for (const tpl of (prophecies[`${prefix}${n}`] as string[] | undefined) ?? []) {
          expect(tpl, tpl).not.toMatch(/(?<![\p{L}])(ils|iels?|eux)(?![\p{L}])/iu)
          expect(tpl, tpl).not.toContain('·')
        }
      }
    }
  })
  it('rappel5 is in capitals', () => {
    for (const tpl of prophecies.rappel5 as string[]) {
      const bare = tpl.replace(/\{[^}]+\}/g, '')
      expect(bare).toBe(bare.toLocaleUpperCase('fr-CA'))
    }
  })
})
