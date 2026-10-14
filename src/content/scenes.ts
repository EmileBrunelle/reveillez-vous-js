import type { Component } from 'vue'
import DoorWood from '../components/doors/DoorWood.vue'
import DoorCloset from '../components/doors/DoorCloset.vue'
import DoorFridge from '../components/doors/DoorFridge.vue'
import DoorManor from '../components/doors/DoorManor.vue'
import DoorCrypt from '../components/doors/DoorCrypt.vue'
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
  { id: 'foret', level: 2, variants: [{ id: 'defaut' }] },
  { id: 'cimetiere', level: 3, variants: [{ id: 'defaut' }] },
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
