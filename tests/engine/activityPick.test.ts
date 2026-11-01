import { describe, expect, it } from 'vitest'
import { ACTIVITIES, ACTIVITY_SEEN_KEY, parseActivityId, parsePlayed, parseSeen, pickActivity, recordActivitySeen, type ActivityId } from '@/engine/activityPick'
import { mulberry32 } from '@/engine/rng'

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
  // Ancien ordre figé (wisps, candles, ouija, windows, crystal imposés par niveau) retiré : les tests suivants vérifient la variété.
  it('jamais deux fois la même d’affilée, toutes les activités éligibles dès le niveau 2', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const seq = run(seed, 40)
      for (let v = 2; v < seq.length; v++) {
        expect(seq[v]).not.toBeNull()
        if (v > 2) expect(seq[v]).not.toBe(seq[v - 1])
      }
    }
  })
  it('une partie présente chaque activité une fois avant de rejouer (visites 2 à 6)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(new Set(run(seed, 6).slice(2)).size).toBe(5)
    }
  })
  it('200 parties : chaque activité ouvre la partie au moins 10 % du temps (sans mémoire entre parties)', () => {
    const first = new Map<ActivityId, number>()
    for (let seed = 1; seed <= 200; seed++) {
      const id = run(seed)[2]!
      first.set(id, (first.get(id) ?? 0) + 1)
    }
    for (const { id } of ACTIVITIES) expect((first.get(id) ?? 0) / 200).toBeGreaterThanOrEqual(0.1)
  })
  it('200 parties enchaînées avec la mémoire : chaque activité ouvre ≥ 10 % du temps, jamais de répétition d’affilée', () => {
    const store = memStore()
    const rng = mulberry32(2026)
    const first = new Map<ActivityId, number>()
    for (let game = 0; game < 200; game++) {
      let last: ActivityId | null = null
      const played: ActivityId[] = []
      for (let v = 0; v <= 8; v++) {
        const id = pickActivity(v, last, store, rng, played)
        if (id) {
          expect(id).not.toBe(last)
          recordActivitySeen(store, id)
          if (!played.includes(id)) played.push(id)
          if (v === 2) first.set(id, (first.get(id) ?? 0) + 1)
        }
        last = id
      }
    }
    for (const { id } of ACTIVITIES) expect((first.get(id) ?? 0) / 200).toBeGreaterThanOrEqual(0.1)
  })
  it('la mémoire entre parties change la première activité : la moins vue ressort', () => {
    const counts = new Map<ActivityId, number>()
    for (let seed = 1; seed <= 200; seed++) {
      const store = memStore()
      store.setItem(ACTIVITY_SEEN_KEY, JSON.stringify({ wisps: 6, candles: 6, ouija: 6, windows: 6 }))
      const id = pickActivity(2, null, store, mulberry32(seed), [])!
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    // Les deux jamais vues (boule de cristal et pendule) se partagent presque tous les tirages.
    expect(((counts.get('crystal') ?? 0) + (counts.get('pendulum') ?? 0)) / 200).toBeGreaterThan(0.8)
  })
  it('la découverte pèse double : l’activité du niveau courant sort plus souvent à poids de mémoire égal', () => {
    let wisps = 0
    for (let seed = 1; seed <= 400; seed++) if (pickActivity(2, null, memStore(), mulberry32(seed), []) === 'wisps') wisps++
    expect(wisps / 400).toBeGreaterThan(0.25) // 2 / 7 attendu, contre 1 / 6 sans bonus
  })
  it('préfère une activité débloquée pas encore jouée ; sans liste, retombe sur le sac sans répétition', () => {
    expect(['ouija', 'windows', 'crystal']).toContain(pickActivity(4, 'candles', memStore(), mulberry32(1), ['wisps', 'candles']))
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

describe('parseSeen', () => {
  it('relit des compteurs entiers connus, vide si illisible', () => {
    expect(parseSeen('{"ouija":2,"nope":5,"wisps":-1,"candles":1.5}')).toEqual({ ouija: 2 })
    for (const raw of [null, '', '{', '[1]', '3']) expect(parseSeen(raw)).toEqual({})
  })
  it('recordActivitySeen incrémente et survit à une relecture', () => {
    const store = memStore()
    recordActivitySeen(store, 'ouija')
    recordActivitySeen(store, 'ouija')
    expect(parseSeen(store.getItem(ACTIVITY_SEEN_KEY))).toEqual({ ouija: 2 })
  })
})

describe('parseActivityId', () => {
  it('relit un identifiant connu, ignore le reste', () => {
    expect(parseActivityId('candles')).toBe('candles')
    for (const raw of [null, '', 'nope', '{"a":1}']) expect(parseActivityId(raw)).toBeNull()
  })
})
