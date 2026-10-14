import { perron } from './perron'
import type { PlaceConfig } from './types'

// Provisoire : réutilise le shader du perron (remplacé par le shader des nuages).
export const nuages: PlaceConfig = { ...perron, ambience: 'nuages' }
