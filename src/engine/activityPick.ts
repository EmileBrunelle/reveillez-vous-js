import { paranoiaLevel } from './paranoia'
import { drawPersisted } from './shuffleBag'
import type { Rng } from './rng'

export type ActivityId = 'wisps' | 'candles' | 'ouija' | 'windows' | 'crystal'

/** Activités avec leur niveau d’introduction : chaque mécanique est présentée une fois, dans l’ordre. */
export const ACTIVITIES: readonly { id: ActivityId; introLevel: number }[] = [
  { id: 'wisps', introLevel: 2 },
  { id: 'candles', introLevel: 3 },
  { id: 'ouija', introLevel: 3 },
  { id: 'windows', introLevel: 4 },
  { id: 'crystal', introLevel: 5 },
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

/**
 * Activité de la visite numéro `visits` (null au niveau 1).
 * - Première visite d’un niveau (le niveau diffère de celui de `visits - 1`) : l’activité introduite à ce niveau (la première de la liste si plusieurs partagent le niveau).
 * - Sinon : une activité débloquée pas encore jouée (`played`), tirée au hasard ; s’il n’y en a plus, tirage au sac sans répétition, jamais `last` (activité de la visite précédente).
 */
export const pickActivity = (visits: number, last: ActivityId | null, storage: Store, rng: Rng, played: readonly ActivityId[] = []): ActivityId | null => {
  const level = paranoiaLevel(visits)
  const unlocked = ACTIVITIES.filter((a) => a.introLevel <= level)
  if (unlocked.length === 0) return null
  if (visits > 0 && paranoiaLevel(visits - 1) !== level) return unlocked.find((a) => a.introLevel === level)!.id
  if (unlocked.length === 1) return unlocked[0].id
  const fresh = unlocked.filter((a) => !played.includes(a.id) && a.id !== last)
  if (fresh.length > 0) return fresh[Math.floor(rng() * fresh.length)].id
  // Le sac évite déjà les répétitions ; la boucle écarte le cas où le tirage retombe sur `last` (sac neuf après un changement de niveau).
  for (let i = 0; i <= unlocked.length; i++) {
    const id = unlocked[drawPersisted(storage, `activite${level}`, unlocked.length, rng)].id
    if (id !== last) return id
  }
  return unlocked.find((a) => a.id !== last)!.id
}
