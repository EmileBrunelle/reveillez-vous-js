import type { PlaceConfig, PlaceId } from './types'

export type { PlaceConfig, PlaceId } from './types'

/** Chargeurs paresseux : chaque lieu (et son shader) forme son propre chunk. */
export const placeLoaders: Record<PlaceId, () => Promise<PlaceConfig>> = {
  perron: () => import('./perron').then((m) => m.perron),
  foret: () => import('./foret').then((m) => m.foret),
  cimetiere: () => import('./cimetiere').then((m) => m.cimetiere),
  rue: () => import('./rue').then((m) => m.rue),
  nuages: () => import('./nuages').then((m) => m.nuages),
}
