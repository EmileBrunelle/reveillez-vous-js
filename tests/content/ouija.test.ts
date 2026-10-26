import { describe, expect, it } from 'vitest'
import { OUIJA_WORDS } from '../../src/content/ouija'
import { BANNED, INCLUSIVE_BANNED, RELIGION, bannedRe } from './rules'

describe('contenu de la planche Ouija', () => {
  it('4 à 6 lettres, A à Z seulement (sans accents), sans doublon', () => {
    for (const w of OUIJA_WORDS) expect(w, w).toMatch(/^[A-Z]{4,6}$/)
    expect(new Set(OUIJA_WORDS).size).toBe(OUIJA_WORDS.length)
    expect(OUIJA_WORDS.length).toBeGreaterThanOrEqual(12)
  })
  it('mots exclus, religion, néologismes et hommage à Terry absents', () => {
    for (const w of OUIJA_WORDS) {
      for (const b of [...BANNED, ...RELIGION]) expect(w, `${b} dans ${w}`).not.toMatch(bannedRe(b))
      expect(w, w).not.toMatch(INCLUSIVE_BANNED)
      expect(w, w).not.toMatch(/terry|davis|templeos|holyc/i)
    }
  })
})
