import { describe, expect, it } from 'vitest'
import { expandTemplate, type Grammar, type ObjectTable } from '../../src/engine/grammar'
import { mulberry32 } from '../../src/engine/rng'
import { prophecies } from '../../src/../src/content/prophecies'
import { BANNED, CONTRACTIONS, RELIGION, bannedRe } from './rules'
import raw from '../../src/../src/content/prophecies.ts?raw'

const SEEDS = 60
const levels = [1, 2, 3, 4, 5]

/** Every (key, template, seed) expansion of the real content. */
// eslint-disable-next-line func-style -- générateur : func-style n’exempte pas `function*`
function* expansions(prefix: 'niveau' | 'porte' | 'rate') {
  for (const n of levels) {
    const key = `${prefix}${n}`
    const templates = prophecies[key] as string[]
    for (const [i, tpl] of templates.entries()) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        yield { key, i, seed, out: expandTemplate(prophecies, tpl.replaceAll('{verset}', '{verset_livre} {verset_ref}'), mulberry32(seed * 7919 + i)) }
      }
    }
  }
}

/** Single-table keys (no level suffix) joined to the same checks. */
// eslint-disable-next-line func-style -- générateur : func-style n’exempte pas `function*`
function* entrezExpansions() {
  for (const [i, tpl] of (prophecies.entrez as string[]).entries()) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      yield { key: 'entrez', i, seed, out: expandTemplate(prophecies, tpl, mulberry32(seed * 7919 + i)) }
    }
  }
}

const allExpansions = function* (prefixes: ('niveau' | 'porte' | 'rate')[]) {
  for (const p of prefixes) yield* expansions(p)
  yield* entrezExpansions()
}

describe('prophecies content', () => {
  it('has niveau1..5 and porte1..5 as non-empty string tables', () => {
    for (const p of ['niveau', 'porte', 'rate']) {
      for (const n of levels) {
        const t = prophecies[`${p}${n}`]
        expect(Array.isArray(t) && t.length > 0 && typeof t[0] === 'string', `${p}${n}`).toBe(true)
      }
    }
  })

  it('rate1..5 have at least 4 short lines each; entrez has 3', () => {
    for (const n of levels) {
      const t = prophecies[`rate${n}`] as string[]
      expect(t.length, `rate${n}`).toBeGreaterThanOrEqual(4)
      for (const l of t) expect(l.length, l).toBeLessThanOrEqual(110)
    }
    expect(prophecies.entrez).toHaveLength(3)
  })

  for (const prefix of ['niveau', 'porte', 'rate', 'entrez'] as const) {
    it(`${prefix}*: typography and grammar of every expansion`, () => {
      let count = 0
      for (const { key, i, seed, out } of prefix === 'entrez' ? entrezExpansions() : expansions(prefix)) {
        const ctx = `${key}[${i}] seed ${seed}: ${out}`
        count++
        expect(out, ctx).not.toMatch(/[{}]/)
        expect(out, ctx).not.toContain("'")
        expect(out, ctx).not.toMatch(/ {2}/)
        for (const c of CONTRACTIONS) expect(out.toLowerCase(), ctx).not.toContain(c)
        // Halloween : h muet (« l’Halloween »), jamais « ce/le/de Halloween ».
        expect(out, ctx).not.toMatch(/\b(ce|le|de|du|que) Halloween/i)
      }
      expect(count).toBeGreaterThanOrEqual((prefix === 'rate' ? 5 * 4 : prefix === 'entrez' ? 3 : 5 * 9) * SEEDS)
    })
  }

  it('niveau*: exactly 3 non-empty parts split on |', () => {
    for (const { key, i, seed, out } of expansions('niveau')) {
      const parts = out.split('|')
      const ctx = `${key}[${i}] seed ${seed}: ${out}`
      expect(parts, ctx).toHaveLength(3)
      for (const p of parts) expect(p.trim(), ctx).not.toBe('')
    }
  })

  it('porte*, rate*, entrez: no | in output', () => {
    for (const { key, i, seed, out } of allExpansions(['porte', 'rate'])) {
      expect(out, `${key}[${i}] seed ${seed}: ${out}`).not.toContain('|')
    }
  })

  describe('paired tables stay coherent', () => {
    const objectTables = Object.entries(prophecies).filter(([, t]) => typeof t[0] === 'object') as [string, ObjectTable][]

    it('finds the expected object tables', () => {
      expect(objectTables.map(([k]) => k).sort()).toEqual(['arcane', 'fete', 'industrie', 'lieu_inexistant', 'objet'])
    })

    for (const [name, table] of objectTables) {
      it(`${name}: all fields in one expansion come from the same entry`, () => {
        const fields = Object.keys(table[0])
        for (const e of table) expect(Object.keys(e).sort()).toEqual([...fields].sort())
        const key = (vals: string[]) => vals.join('§')
        const valid = new Set(table.map((e) => key(fields.map((f) => e[f]))))
        const sentinel: Grammar = { ...prophecies, probe: [fields.map((f) => `{${name}.${f}}`).join('§')] }
        const seen = new Set<string>()
        for (let seed = 1; seed <= 300; seed++) {
          const out = expandTemplate(sentinel, '{probe}', mulberry32(seed))
          expect(valid.has(out), `${name}: ${out}`).toBe(true)
          seen.add(out)
        }
        expect(seen.size).toBeGreaterThan(1)
      })
    }

    it('two-field template pair (industrie.nom / industrie.cible) matches an entry', () => {
      const table = prophecies.industrie as ObjectTable
      const valid = new Set(table.map((e) => `${e.nom}§${e.cible}`))
      for (let seed = 1; seed <= 100; seed++) {
        expect(valid.has(expandTemplate(prophecies, '{industrie.nom}§{industrie.cible}', mulberry32(seed)))).toBe(true)
      }
    })
  })

  describe('arcane', () => {
    const table = prophecies.arcane as ObjectTable
    const SYMBOLES = [
      'fool',
      'wheel',
      'star',
      'moon',
      'sun',
      'lantern',
      'tower',
      'pumpkin',
      'cone',
      'bridge',
      'crystal',
      'cat',
      'signpost',
      'ghost',
      'eye',
      'beaver',
      'hourglass',
      'web',
      'bat',
      'snowman',
      'antenna',
    ]
    it('has ~15 entries with numero, nom and a known symbole', () => {
      expect(table.length).toBeGreaterThanOrEqual(12)
      for (const a of table) {
        expect(a.numero.trim()).not.toBe('')
        expect(a.nom.trim()).not.toBe('')
        expect(SYMBOLES).toContain(a.symbole)
      }
      expect(new Set(table.map((a) => a.nom)).size).toBe(table.length)
    })
    it('every level has at least 3 preferred arcana', () => {
      for (const n of levels) expect(table.filter((a) => a.niveaux.includes(String(n))).length, `niveau ${n}`).toBeGreaterThanOrEqual(3)
    })
    it('typography, no | and no banned or religious words', () => {
      for (const a of table) {
        for (const v of Object.values(a)) {
          expect(v).not.toContain("'")
          expect(v).not.toContain('|')
          expect(v).not.toMatch(/ {2}/)
          for (const w of [...BANNED, ...RELIGION]) expect(v, `${w} in ${v}`).not.toMatch(bannedRe(w))
        }
      }
    })
  })

  describe('homage separation', () => {
    it('no prophecy, arcane or knock text mentions Terry, Davis, TempleOS or HolyC', () => {
      expect(raw).not.toMatch(/terry|davis|templeos|holyc/i)
    })
  })

  describe('banned words', () => {
    for (const w of BANNED) {
      it(`"${w}" absent from raw file`, () => {
        expect(raw).not.toMatch(bannedRe(w))
      })
    }
    it('absent from every expanded output', () => {
      for (const { key, i, seed, out } of allExpansions(['niveau', 'porte', 'rate'])) {
        for (const w of BANNED) expect(out, `${w} in ${key}[${i}] seed ${seed}`).not.toMatch(bannedRe(w))
      }
    })
  })
})

describe('versets (livre + référence)', () => {
  const livres = prophecies.verset_livre as string[]
  const refs = prophecies.verset_ref as string[]
  it('tables are deduped and well formed', () => {
    expect(livres.length).toBeGreaterThanOrEqual(35)
    expect(refs.length).toBeGreaterThanOrEqual(20)
    expect(new Set(livres).size).toBe(livres.length)
    expect(new Set(refs).size).toBe(refs.length)
    for (const r of refs) expect(r).toMatch(/^\d{1,2}:\d{1,2}$/)
    expect(refs).not.toContain('9:11')
    expect(refs).not.toContain('4:20')
  })
  it('every book × reference matches the verse format and no banned word', () => {
    for (const l of livres)
      for (const r of refs) {
        const v = `${l} ${r}`
        expect(v).toMatch(/^[\p{Lu}][^|]* \d{1,2}:\d{1,2}$/u)
        expect(v).not.toContain("'")
        for (const w of BANNED) expect(v).not.toMatch(bannedRe(w))
      }
  })
})
