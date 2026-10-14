import type { Component } from 'vue'
import DoorWood from '../components/doors/DoorWood.vue'
import DoorCloset from '../components/doors/DoorCloset.vue'
import DoorFridge from '../components/doors/DoorFridge.vue'
import DoorManor from '../components/doors/DoorManor.vue'
import DoorCrypt from '../components/doors/DoorCrypt.vue'
import BgMoonStreet from '../components/backgrounds/BgMoonStreet.vue'
import BgSnow from '../components/backgrounds/BgSnow.vue'
import BgFog from '../components/backgrounds/BgFog.vue'
import BgAlley from '../components/backgrounds/BgAlley.vue'
import BgPorch from '../components/backgrounds/BgPorch.vue'
import BgVoid from '../components/backgrounds/BgVoid.vue'

/**
 * A scene variant = id + label + renderer + minLevel (paranoia level at which it can appear).
 * `component` renders it with CSS/SVG today; a vgpu raymarched scene can replace it later
 * (swap `component`, or add a `gpu` entry with its params) without touching callers.
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

const allBackgrounds: SceneVariant[] = [
  { id: 'perron', label: 'perron sous la lune (raymarching)', minLevel: 1, weight: 4, component: BgPorch },
  { id: 'rue-lune', label: 'rue de quartier sous la pleine lune', minLevel: 1, component: BgMoonStreet },
  { id: 'neige', label: 'tempête de neige', minLevel: 1, component: BgSnow },
  { id: 'ruelle', label: 'ruelle avec cônes orange', minLevel: 2, component: BgAlley },
  { id: 'brouillard', label: 'brouillard de cimetière', minLevel: 3, component: BgFog },
  { id: 'vide', label: 'vide cosmique', minLevel: 4, component: BgVoid },
]

// Dev-only: `?bg=<id>` forces a background (stripped from production builds).
const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('bg') : null
export const backgrounds: SceneVariant[] = forced && allBackgrounds.some((b) => b.id === forced) ? allBackgrounds.filter((b) => b.id === forced) : allBackgrounds
