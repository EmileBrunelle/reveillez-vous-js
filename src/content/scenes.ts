import type { Component } from 'vue'
import DoorWood from '~icons/rvj/porte-bois'
import DoorCloset from '~icons/rvj/porte-garde-robe'
import DoorFridge from '~icons/rvj/porte-frigo'
import DoorManor from '~icons/rvj/porte-manoir'
import DoorCrypt from '~icons/rvj/porte-crypte'
import type { PlaceId } from '../effects/places/types'
import { pickVariant } from '../engine/variant'
import type { Rng } from '../engine/rng'

/**
 * A door variant = id + label + renderer + minLevel (paranoia level at which it can appear).
 */
export interface SceneVariant {
  id: string
  label: string
  minLevel: number
  component: Component
  /** Relative pick weight (default 1). */
  weight?: number
  /** Reserved for a future vgpu renderer (shader params). */
  params?: Record<string, number>
}

export const doors: SceneVariant[] = [
  { id: 'bois', label: 'porte de bois de maison', minLevel: 1, component: DoorWood },
  { id: 'garde-robe', label: 'porte de garde-robe', minLevel: 1, component: DoorCloset },
  { id: 'frigo', label: 'porte de frigo géante', minLevel: 2, component: DoorFridge },
  { id: 'manoir', label: 'porte de manoir hanté', minLevel: 3, component: DoorManor },
  { id: 'crypte', label: 'porte de crypte', minLevel: 4, component: DoorCrypt },
]

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
  { id: 'perron', level: 1, variants: [{ id: 'defaut' }] },
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
  { id: 'rue', level: 4, variants: [{ id: 'defaut' }] },
  { id: 'nuages', level: 5, variants: [{ id: 'defaut' }] },
]

// Dev-only: `?bg=<placeId>` forces a place (stripped from production builds).
const forced = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bg') : null

/** Lieu du niveau `level` (ou celui forcé par `?bg=` en dev). */
export const placeForLevel = (level: number): Place => {
  const f = forced ? places.find((p) => p.id === forced) : undefined
  return f ?? places.find((p) => p.level === level) ?? places[places.length - 1]
}

/** Variante tirée au hasard (pondérée) parmi celles d’un lieu, en évitant `lastVariantId` s’il y a le choix. */
export const pickPlaceVariant = (place: Place, lastVariantId: string | null, rng: Rng): PlaceVariant =>
  pickVariant(
    place.variants.map((v) => ({ ...v, minLevel: 1 })),
    1,
    lastVariantId,
    rng,
  )
