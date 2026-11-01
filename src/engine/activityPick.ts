import { paranoiaLevel } from './paranoia'
import type { Rng } from './rng'

export type ActivityId = 'wisps' | 'candles' | 'ouija' | 'windows' | 'crystal' | 'pendulum'

/**
 * Activités avec leur niveau d’introduction. Ce n’est pas un palier de difficulté : toutes sont jouables dès le niveau 2.
 * Le niveau d’introduction sert seulement à favoriser la découverte (poids double tant que l’activité n’est pas jouée à ce niveau).
 */
export const ACTIVITIES: readonly { id: ActivityId; introLevel: number }[] = [
  { id: 'wisps', introLevel: 2 },
  { id: 'candles', introLevel: 3 },
  { id: 'ouija', introLevel: 3 },
  { id: 'windows', introLevel: 4 },
  { id: 'crystal', introLevel: 5 },
  { id: 'pendulum', introLevel: 4 },
]

/** Clé sessionStorage de la dernière activité jouée (survit à un rechargement en pleine visite). */
export const LAST_ACTIVITY_KEY = 'rvj-last-activity'

/** Relit une valeur stockée : un identifiant d’activité connu, sinon null. */
export const parseActivityId = (raw: string | null): ActivityId | null => ACTIVITIES.find((a) => a.id === raw)?.id ?? null

/** Clé sessionStorage des activités jouées depuis le début de la partie (JSON : liste d’identifiants, sans doublon). */
export const PLAYED_ACTIVITIES_KEY = 'rvj-played-activities'

/** Relit la liste stockée : seulement des identifiants connus, sans doublon ; vide si le contenu est illisible. */
export const parsePlayed = (raw: string | null): ActivityId[] => {
  try {
    const list: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(list) ? ACTIVITIES.map((a) => a.id).filter((id) => list.includes(id)) : []
  } catch {
    return []
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Clé localStorage du nombre de fois où chaque activité a été vue, toutes parties confondues (survit à « Recommencer »). */
export const ACTIVITY_SEEN_KEY = 'rvj-activity-seen'

/** Relit les compteurs stockés : seulement des identifiants connus, des entiers ≥ 0 ; vide si le contenu est illisible. */
export const parseSeen = (raw: string | null): Partial<Record<ActivityId, number>> => {
  try {
    const obj: unknown = JSON.parse(raw ?? '{}')
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {}
    const seen: Partial<Record<ActivityId, number>> = {}
    for (const { id } of ACTIVITIES) {
      const n = (obj as Record<string, unknown>)[id]
      if (typeof n === 'number' && Number.isInteger(n) && n > 0) seen[id] = Math.min(n, 1000)
    }
    return seen
  } catch {
    return {}
  }
}

/** Note qu’une activité vient d’être présentée (mémoire entre les parties). */
export const recordActivitySeen = (storage: Store, id: ActivityId) => {
  const seen = parseSeen(storage.getItem(ACTIVITY_SEEN_KEY))
  seen[id] = (seen[id] ?? 0) + 1
  try {
    storage.setItem(ACTIVITY_SEEN_KEY, JSON.stringify(seen))
  } catch {
    // stockage refusé : la mémoire entre parties est un confort, pas une nécessité
  }
}

/**
 * Activité de la visite numéro `visits` (null au niveau 1).
 * - Éligibles : toutes dès le niveau 2, jamais `last` (activité de la visite précédente).
 * - Parmi elles, celles pas encore jouées dans la partie (`played`) ; s’il n’en reste aucune, toutes les autres.
 * - Poids : 1 / (1 + vues)² d’après la mémoire entre parties (les moins vues d’abord), doublé pour l’activité introduite au niveau courant tant qu’elle n’est pas jouée.
 */
export const pickActivity = (visits: number, last: ActivityId | null, storage: Store, rng: Rng, played: readonly ActivityId[] = []): ActivityId | null => {
  const level = paranoiaLevel(visits)
  if (level < 2) return null
  const others = ACTIVITIES.filter((a) => a.id !== last)
  const fresh = others.filter((a) => !played.includes(a.id))
  const pool = fresh.length > 0 ? fresh : others
  const seen = parseSeen(storage.getItem(ACTIVITY_SEEN_KEY))
  const weights = pool.map((a) => (1 / (1 + (seen[a.id] ?? 0)) ** 2) * (a.introLevel === level && !played.includes(a.id) ? 2 : 1))
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll < 0) return pool[i].id
  }
  return pool[pool.length - 1].id
}
