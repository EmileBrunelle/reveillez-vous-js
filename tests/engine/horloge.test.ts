import { describe, expect, it } from 'vitest'
import { HORLOGE_LIGNES } from '../../src/content/horloge'
import { fenetreHoraire, heureQc, HORLOGE_CHANCE, HORLOGE_KEY, nextClockLine } from '../../src/engine/horloge'

const at = (h: number, m = 0, month = 10, day = 12) => new Date(2026, month - 1, day, h, m)
const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const always = () => 0
const never = () => 0.99

describe('heureQc', () => {
  it('formats Québec style', () => {
    expect(heureQc(at(3, 12))).toBe('3\u00a0h\u00a012')
    expect(heureQc(at(23, 5))).toBe('23\u00a0h\u00a005')
    expect(heureQc(at(0, 0))).toBe('0\u00a0h\u00a000')
  })
})

describe('fenetreHoraire', () => {
  it('selects windows', () => {
    expect(fenetreHoraire(at(3, 12))).toBe('nuit')
    expect(fenetreHoraire(at(4, 59))).toBe('nuit')
    expect(fenetreHoraire(at(0, 30))).toBe('nuit')
    expect(fenetreHoraire(at(5, 0))).toBe('matin')
    expect(fenetreHoraire(at(8, 59))).toBe('matin')
    expect(fenetreHoraire(at(9, 0))).toBeNull()
    expect(fenetreHoraire(at(14, 0))).toBeNull()
    expect(fenetreHoraire(at(18, 0))).toBe('soir')
    expect(fenetreHoraire(at(23, 49))).toBe('soir')
  })
  it('minuit-ish wins over night and evening', () => {
    expect(fenetreHoraire(at(23, 50))).toBe('minuit')
    expect(fenetreHoraire(at(0, 0))).toBe('minuit')
    expect(fenetreHoraire(at(0, 10))).toBe('minuit')
    expect(fenetreHoraire(at(0, 11))).toBe('nuit')
  })
  it('31 October wins at any hour', () => {
    expect(fenetreHoraire(at(14, 0, 10, 31))).toBe('halloween')
    expect(fenetreHoraire(at(3, 0, 10, 31))).toBe('halloween')
    expect(fenetreHoraire(at(14, 0, 10, 30))).toBeNull()
    expect(fenetreHoraire(at(14, 0, 11, 1))).toBeNull()
  })
})

describe('nextClockLine', () => {
  it('shows the real time in the line', () => {
    const line = nextClockLine(at(3, 12), always, memStore())
    expect(line).toContain('3\u00a0h\u00a012')
    expect(line).not.toContain('{heure}')
  })
  it('returns null outside windows without consuming the session gate', () => {
    const store = memStore()
    expect(nextClockLine(at(14), always, store)).toBeNull()
    expect(store.getItem(HORLOGE_KEY)).toBeNull()
  })
  it('respects the chance, and a failed roll does not consume the gate', () => {
    const store = memStore()
    expect(nextClockLine(at(3), never, store)).toBeNull()
    expect(store.getItem(HORLOGE_KEY)).toBeNull()
    expect(nextClockLine(at(3), () => HORLOGE_CHANCE - 0.01, store)).not.toBeNull()
  })
  it('at most once per session', () => {
    const store = memStore()
    expect(nextClockLine(at(3), always, store)).not.toBeNull()
    expect(nextClockLine(at(3), always, store)).toBeNull()
  })
  it('31 October: certain even with an unlucky rng, once', () => {
    const store = memStore()
    expect(nextClockLine(at(14, 7, 10, 31), never, store)).toContain('14\u00a0h\u00a007')
    expect(nextClockLine(at(14, 8, 10, 31), never, store)).toBeNull()
  })
  it('survives a throwing store', () => {
    const bad = {
      getItem: () => {
        throw new Error('x')
      },
      setItem: () => {
        throw new Error('x')
      },
    }
    expect(nextClockLine(at(3), always, bad)).toBeNull()
  })
})

describe('contenu horloge', () => {
  const all = Object.entries(HORLOGE_LIGNES).flatMap(([k, ls]) => ls.map((l) => [k, l] as const))
  it('3 à 5 lignes par fenêtre, chacune avec {heure}', () => {
    for (const ls of Object.values(HORLOGE_LIGNES)) {
      expect(ls.length).toBeGreaterThanOrEqual(3)
      expect(ls.length).toBeLessThanOrEqual(5)
    }
    for (const [k, l] of all) expect(l, k).toContain('{heure}')
  })
  it('apostrophes typographiques, pas de point médian, pas de néologisme ni ils/elles', () => {
    for (const [k, l] of all) {
      expect(l, k).not.toContain("'")
      expect(l, k).not.toContain('·')
      expect(l, k).not.toMatch(/\b(iels?|celleux|toustes|ils|elles)\b/i)
    }
  })
})
