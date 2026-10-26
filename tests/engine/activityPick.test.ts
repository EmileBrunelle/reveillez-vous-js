import { describe, expect, it } from 'vitest'
import { ACTIVITIES, parseActivityId, parsePlayed, pickActivity, type ActivityId } from '../../src/engine/activityPick'
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
  const played: ActivityId[] = []
  for (let v = 0; v <= upTo; v++) {
    last = pickActivity(v, last, store, rng, played)
    if (last && !played.includes(last)) played.push(last)
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
  it('séquence des visites 0 à 7 : Feux, Chandelles, Ouija (pas encore jouée), Fenêtres, une rejouée, Cristal', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = run(seed)
      expect(seq.slice(0, 6)).toEqual([null, null, 'wisps', 'candles', 'ouija', 'windows'])
      expect(['wisps', 'candles', 'ouija']).toContain(seq[6]) // déjà jouée, mais pas Fenêtres (visite précédente)
      expect(seq[7]).toBe('crystal')
    }
  })
  it('préfère une activité débloquée pas encore jouée ; sans liste, retombe sur le sac sans répétition', () => {
    expect(pickActivity(4, 'candles', memStore(), mulberry32(1), ['wisps', 'candles'])).toBe('ouija')
    for (let seed = 1; seed <= 30; seed++) {
      expect(pickActivity(4, 'candles', memStore(), mulberry32(seed))).not.toBe('candles')
    }
  })
})

describe('parsePlayed', () => {
  it('relit une liste d’identifiants connus, vide si illisible', () => {
    expect(parsePlayed('["ouija","nope","wisps","ouija"]')).toEqual(['wisps', 'ouija'])
    for (const raw of [null, '', '{', '{"a":1}', '3']) expect(parsePlayed(raw)).toEqual([])
  })
})

describe('parseActivityId', () => {
  it('relit un identifiant connu, ignore le reste', () => {
    expect(parseActivityId('candles')).toBe('candles')
    for (const raw of [null, '', 'nope', '{"a":1}']) expect(parseActivityId(raw)).toBeNull()
  })
})
