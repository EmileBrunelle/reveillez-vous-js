import { perron } from './perron'
import type { PlaceConfig } from './types'

// Provisoire : réutilise le shader du perron (remplacé par le shader du cimetière).
export const cimetiere: PlaceConfig = { ...perron, ambience: 'cimetiere' }
