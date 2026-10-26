import type { Component } from 'vue'
import DoorCloset from '~icons/rvj/porte-garde-robe'
import DoorFridge from '~icons/rvj/porte-frigo'
import DoorPorch from '~icons/rvj/porte-perron'
import DoorCabin from '~icons/rvj/porte-cabane'
import DoorMausoleum from '~icons/rvj/porte-mausolee'
import DoorHouse from '~icons/rvj/porte-maison'
import DoorClouds from '~icons/rvj/porte-nuages'
import type { PlaceId } from '../effects/places/types'
import { pickVariant } from '../engine/variant'
import type { Rng } from '../engine/rng'

/**
 * Une porte = id + label + renderer. `place` : lieu dont c’est la porte « principale » ;
 * sans `place`, c’est une variante comique rare qui peut apparaître n’importe où.
 */
export interface SceneVariant {
  id: string
  label: string
  component: Component
  place?: PlaceId
  /** Poids de tirage relatif (défaut 1). */
  weight?: number
  /** Reserved for a future vgpu renderer (shader params). */
  params?: Record<string, number>
}

/** Poids d’une porte principale : les variantes comiques (poids 1 chacune) restent rares (~1 sur 7 en tout). */
const PRIMARY_WEIGHT = 12

export const doors: SceneVariant[] = [
  { id: 'perron', place: 'perron', weight: PRIMARY_WEIGHT, label: 'porte de perron avec contre-porte', component: DoorPorch },
  { id: 'cabane', place: 'foret', weight: PRIMARY_WEIGHT, label: 'porte de cabane en planches', component: DoorCabin },
  { id: 'mausolee', place: 'cimetiere', weight: PRIMARY_WEIGHT, label: 'porte de mausolée en fer', component: DoorMausoleum },
  { id: 'maison', place: 'rue', weight: PRIMARY_WEIGHT, label: 'porte de maison avec imposte', component: DoorHouse },
  { id: 'nuages', place: 'nuages', weight: PRIMARY_WEIGHT, label: 'cadre de porte flottant dans les nuages', component: DoorClouds },
  { id: 'garde-robe', label: 'porte de garde-robe', component: DoorCloset },
  { id: 'frigo', label: 'porte de frigo géante', component: DoorFridge },
]

/** Porte d’un lieu : la porte principale du lieu la plupart du temps, une variante comique rare sinon. Tirage via le `Rng` injecté. */
export const pickDoor = (placeId: PlaceId, rng: Rng): SceneVariant =>
  pickVariant(
    doors.filter((d) => !d.place || d.place === placeId),
    1,
    null,
    rng,
  )

/** Variante d’un lieu : un lieu peut en avoir plusieurs (paramètres de shader différents). */
export interface PlaceVariant {
  id: string
  /** Relative pick weight (default 1). */
  weight?: number
  params?: Record<string, number>
}

/** Un lieu par niveau de paranoïa, de façon déterministe. */
export interface Place {
  id: PlaceId
  level: number
  variants: PlaceVariant[]
}

export const places: Place[] = [
  {
    id: 'perron',
    level: 1,
    variants: [
      { id: 'defaut', params: { mist: 1, moon: 1, rain: 0, leaves: 0, lamp: 0 } },
      { id: 'pluie-feuilles', params: { mist: 1.25, moon: 0.65, rain: 1, leaves: 1, lamp: 0 } },
      { id: 'citrouille', params: { mist: 1.4, moon: 0.5, rain: 0, leaves: 0, lamp: 1 } },
    ],
  },
  {
    id: 'foret',
    level: 2,
    variants: [
      { id: 'lune-claire', params: { mist: 0.7, moon: 1.15, snow: 0 } },
      { id: 'brume-epaisse', params: { mist: 1.7, moon: 0.8, snow: 0 } },
      { id: 'premiere-neige', params: { mist: 1, moon: 0.9, snow: 1 } },
    ],
  },
  {
    id: 'cimetiere',
    level: 3,
    variants: [
      { id: 'brume-basse', params: { mist: 1, moon: 1, rain: 0 } },
      { id: 'pleine-lune', params: { mist: 0.6, moon: 1.4, rain: 0 } },
      { id: 'bruine', params: { mist: 1.4, moon: 0.7, rain: 1 } },
    ],
  },
  {
    id: 'rue',
    level: 4,
    variants: [
      { id: 'claire', weight: 2, params: { weather: 0, cold: 0.2 } },
      { id: 'pluie', params: { weather: 1, cold: 0.15 } },
      { id: 'neige', params: { weather: 2, cold: 0.5 } },
    ],
  },
  {
    id: 'nuages',
    level: 5,
    variants: [
      { id: 'pale', weight: 2, params: { blood: 0, dawn: 0 } },
      { id: 'sang', params: { blood: 1, dawn: 0 } },
      { id: 'aube', weight: 0, params: { blood: 0, dawn: 1 } },
    ],
  },
]

// Dev-only: `?bg=<placeId>` forces a place (stripped from production builds).
const forced = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bg') : null

/** Lieu du niveau `level` (ou celui forcé par `?bg=` en dev). */
export const placeForLevel = (level: number): Place => {
  const f = forced ? places.find((p) => p.id === forced) : undefined
  return f ?? places.find((p) => p.level === level) ?? places[places.length - 1]
}

/** Variante tirée au hasard (pondérée) parmi celles d’un lieu, en évitant `lastVariantId` s’il y a le choix. */
export const pickPlaceVariant = (place: Place, lastVariantId: string | null, rng: Rng): PlaceVariant => pickVariant(place.variants, 1, lastVariantId, rng)
