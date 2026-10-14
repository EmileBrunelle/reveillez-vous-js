import { describe, expect, it } from 'vitest'
import { prophecies } from '../../src/content/prophecies'
import { INCLUSIVE_BANNED, PRONOUN_ALLOWLIST, runningTextEntries } from './rules'

describe('écriture inclusive (UQAM) : textes courants de prophecies.ts', () => {
  const entries = runningTextEntries(prophecies)

  it('scans a meaningful number of entries', () => {
    expect(entries.length).toBeGreaterThan(300)
  })

  it('no point médian (« · »), no « ·e·s »', () => {
    for (const { key, text } of entries) expect(text, `${key}: ${text}`).not.toContain('·')
  })

  it('no iel / iels / celleux / toustes', () => {
    for (const { key, text } of entries) expect(text, `${key}: ${text}`).not.toMatch(INCLUSIVE_BANNED)
  })

  it('no « ils » / « elles » (except the commented allowlist of objects and animals)', () => {
    const used = new Set<string>()
    for (const { key, text } of entries) {
      if (!/(?<![\p{L}-])(ils|elles)(?![\p{L}])/iu.test(text)) continue
      const hit = PRONOUN_ALLOWLIST.find((snippet) => text.includes(snippet))
      expect(hit, `${key}: ${text}`).toBeDefined()
      used.add(hit!)
    }
    for (const snippet of PRONOUN_ALLOWLIST) expect(used.has(snippet), `stale allowlist entry: ${snippet}`).toBe(true)
  })
})
