import { describe, expect, it } from 'vitest'
import { ACTIVITY_PROMPTS } from '../../src/content/activityPrompts'
import { BANNED, INCLUSIVE_BANNED, bannedRe } from './rules'

// Textes des activités (verbes, réussites, échecs) : mêmes règles que les prophéties (AGENTS.md, « Content rules »).
const texts = Object.entries(ACTIVITY_PROMPTS).flatMap(([id, p]) => [`${id}.verb`, `${id}.win`, `${id}.fail`].map((key) => ({ key, text: p[key.split('.')[1] as 'verb' | 'win' | 'fail'] })))

describe('textes des activités', () => {
  it('couvre les quatre activités', () => {
    expect(texts).toHaveLength(12)
  })

  it('aucun point médian, aucun néologisme, aucun ils/elles', () => {
    for (const { key, text } of texts) {
      expect(text, key).not.toContain('·')
      expect(text, key).not.toMatch(INCLUSIVE_BANNED)
      expect(text, key).not.toMatch(/(?<![\p{L}-])(ils|elles)(?![\p{L}])/iu)
    }
  })

  it('aucun mot exclu (maladie mentale, conspirations)', () => {
    for (const { key, text } of texts) for (const w of BANNED) expect(text, `${key}: ${w}`).not.toMatch(bannedRe(w))
  })

  it('apostrophe typographique seulement', () => {
    for (const { key, text } of texts) expect(text, key).not.toContain("'")
  })
})
