import { describe, expect, it } from 'vitest'
import { ACTIVITIES, pickActivity, type ActivityId } from '../../src/engine/activityPick'
import { paranoiaLevel } from '../../src/engine/paranoia'
import { mulberry32 } from '../../src/engine/rng'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const run = (seed: number, upTo = 7) => {
  const store = memStore()
  const rng = mulberry32(seed)
  const seq: (ActivityId | null)[] = []
  let last: ActivityId | null = null
  for (let v = 0; v <= upTo; v++) {
    last = pickActivity(v, last, store, rng)
    seq.push(last)
  }
  return seq
}

describe('pickActivity', () => {
  it('aucune activité au niveau 1 (visites 0 et 1)', () => {
    expect(run(1).slice(0, 2)).toEqual([null, null])
  })
  it('la première visite de chaque niveau joue l’activité introduite', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = run(seed)
      expect([seq[2], seq[3], seq[5], seq[7]]).toEqual(['wisps', 'candles', 'windows', 'crystal'])
    }
  })
  it('jamais deux fois la même d’affilée, seulement des activités débloquées', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const seq = run(seed, 40)
      for (let v = 2; v < seq.length; v++) {
        if (v > 2) expect(seq[v]).not.toBe(seq[v - 1])
        const intro = ACTIVITIES.find((a) => a.id === seq[v])!.introLevel
        expect(intro).toBeLessThanOrEqual(paranoiaLevel(v))
      }
    }
  })
  it('parcours des visites 0 à 7 : les rejeux aux niveaux 3 et 4 changent d’activité', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = run(seed)
      expect(seq[4]).toBe('wisps') // seule autre candidate au niveau 3
      expect(['wisps', 'candles']).toContain(seq[6]) // niveau 4 : pas Fenêtres, jouée à la visite 5
    }
  })
})
