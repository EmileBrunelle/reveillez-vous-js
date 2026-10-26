import { paranoiaLevel } from './paranoia'
import { drawPersisted } from './shuffleBag'
import type { Rng } from './rng'

export type ActivityId = 'wisps' | 'candles' | 'windows' | 'crystal'

/** Activités avec leur niveau d’introduction : chaque mécanique est présentée une fois, dans l’ordre. */
export const ACTIVITIES: readonly { id: ActivityId; introLevel: number }[] = [
  { id: 'wisps', introLevel: 2 },
  { id: 'candles', introLevel: 3 },
  { id: 'windows', introLevel: 4 },
  { id: 'crystal', introLevel: 5 },
]

type Store = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Activité de la visite numéro `visits` (null au niveau 1).
 * - Première visite d’un niveau (le niveau diffère de celui de `visits - 1`) : l’activité introduite à ce niveau.
 * - Sinon : tirage au sac sans répétition parmi les activités débloquées, jamais `last` (activité de la visite précédente).
 */
export const pickActivity = (visits: number, last: ActivityId | null, storage: Store, rng: Rng): ActivityId | null => {
  const level = paranoiaLevel(visits)
  const unlocked = ACTIVITIES.filter((a) => a.introLevel <= level)
  if (unlocked.length === 0) return null
  if (visits > 0 && paranoiaLevel(visits - 1) !== level) return unlocked[unlocked.length - 1].id
  if (unlocked.length === 1) return unlocked[0].id
  // Le sac évite déjà les répétitions ; la boucle écarte le cas où le tirage retombe sur `last` (sac neuf après un changement de niveau).
  for (let i = 0; i <= unlocked.length; i++) {
    const id = unlocked[drawPersisted(storage, `activite${level}`, unlocked.length, rng)].id
    if (id !== last) return id
  }
  return unlocked.find((a) => a.id !== last)!.id
}
