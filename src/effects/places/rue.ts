import { perron } from './perron'
import type { PlaceConfig } from './types'

// Provisoire : réutilise le shader du perron (remplacé par le shader de la rue).
export const rue: PlaceConfig = { ...perron, ambience: 'rue' }
