import type { PlaceId } from '../effects/places/types'

/** Ambiance sonore d’un lieu. Stub : rempli par T5. Renvoie la fonction d’arrêt. */
export const startAmbience = (_place: PlaceId): (() => void) => () => undefined
