import type { RaymarchState, Shader } from '../raymarch'

export type PlaceId = 'perron' | 'foret' | 'cimetiere' | 'rue' | 'nuages'

export interface PlaceConfig {
  shader: Shader
  /** `state.variant` = paramètres de la variante choisie (scenes.ts). */
  params: (s: RaymarchState & { variant?: Record<string, number> }) => Record<string, number>
  /** Ambiance sonore du lieu (audio/ambience.ts). */
  ambience: PlaceId
}
