import { describe, expect, it } from 'vitest'
import { ACTIVITY_PROMPTS, PENDULUM_SYMBOLS, PENDULUM_TEXTS } from '@/content/activityPrompts'
import { BANNED, INCLUSIVE_BANNED, bannedRe } from './rules'

// Textes des activités (verbes, réussites, échecs) : mêmes règles que les prophéties (AGENTS.md, « Content rules »).
const prompts = Object.entries(ACTIVITY_PROMPTS).flatMap(([id, p]) => [`${id}.verb`, `${id}.win`, `${id}.fail`].map((key) => ({ key, text: p[key.split('.')[1] as 'verb' | 'win' | 'fail'] })))
// Textes du pendule : libellés, consignes et reprises (avec chaque symbole, avec et sans symbole retenu).
const pendulum = [
  { key: 'pendulum.stop', text: PENDULUM_TEXTS.stop },
  { key: 'pendulum.help', text: PENDULUM_TEXTS.help },
  ...PENDULUM_SYMBOLS.flatMap(({ id, on }) => [
    { key: `pendulum.${id}.ask`, text: PENDULUM_TEXTS.ask(on) },
    { key: `pendulum.${id}.retry`, text: PENDULUM_TEXTS.retry(on, on, 1) },
    { key: `pendulum.${id}.retry2`, text: PENDULUM_TEXTS.retry(null, on, 2) },
  ]),
]
const texts = [...prompts, ...pendulum]

describe('textes des activités', () => {
  it('couvre les six activités', () => {
    expect(prompts).toHaveLength(18)
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
