import { describe, expect, it } from 'vitest'
import { CREDITS, CREDITS_TITLE, FINALE_GREETING, FINALE_STORY, FINALE_TITLE, RESTART_LABEL, WAKE_LABEL, returnGrammar } from '../../src/content/finale'
import { nextReturnLine } from '../../src/engine/prophecy'
import { mulberry32 } from '../../src/engine/rng'
import { BAGS_KEY } from '../../src/engine/shuffleBag'
import { BANNED, INCLUSIVE_BANNED, RELIGION, bannedRe } from './rules'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const all = [...FINALE_TITLE, ...FINALE_STORY, FINALE_GREETING, CREDITS_TITLE, ...CREDITS, RESTART_LABEL, WAKE_LABEL, ...returnGrammar.retour]

describe('contenu de la finale et du retour', () => {
  it('apostrophe typographique, jamais droite', () => {
    for (const t of all) expect(t, t).not.toContain("'")
    expect(all.filter((t) => t.includes('’')).length).toBeGreaterThan(5)
  })

  it('règles inclusives : pas de point médian, pas de néologisme, pas de ils/elles', () => {
    for (const t of all) {
      expect(t, t).not.toContain('·')
      expect(t, t).not.toMatch(INCLUSIVE_BANNED)
      expect(t, t).not.toMatch(/(?<![\p{L}-])(ils|elles)(?![\p{L}])/iu)
    }
  })

  it('mots exclus, religion, anglicisme « bon matin » et hommage à Terry absents', () => {
    for (const t of all) {
      for (const w of [...BANNED, ...RELIGION]) expect(t, `${w} dans ${t}`).not.toMatch(bannedRe(w))
      expect(t, t).not.toMatch(/bon matin|terry|davis|templeos|holyc/i)
    }
  })

  it('le salut final est « Bonjour. » et le bouton de la porte « Réveillez-vous »', () => {
    expect(FINALE_GREETING).toBe('Bonjour.')
    expect(WAKE_LABEL).toBe('Réveillez-vous')
    expect(FINALE_STORY).toHaveLength(5)
  })

  it('le générique cite game-icons CC BY 3.0 et l’IA', () => {
    expect(CREDITS.some((c) => c.includes('game-icons.net') && c.includes('CC BY 3.0'))).toBe(true)
    expect(CREDITS.some((c) => c.includes('Claude Code (IA)'))).toBe(true)
  })
})

describe('nextReturnLine', () => {
  it('tire parmi les trois répliques de retour, sans répétition avant d’avoir tout vu (via le Rng injecté)', () => {
    const store = memStore()
    const rng = mulberry32(7)
    const seen = [0, 1, 2].map(() => nextReturnLine(store, rng, 'x'))
    expect(new Set(seen).size).toBe(3)
    for (const l of seen) expect(returnGrammar.retour).toContain(l)
    expect(store.getItem(BAGS_KEY)).toContain('retour')
  })

  it('est déterministe pour un même Rng', () => {
    expect(nextReturnLine(memStore(), mulberry32(3), 'x')).toBe(nextReturnLine(memStore(), mulberry32(3), 'x'))
  })
})
