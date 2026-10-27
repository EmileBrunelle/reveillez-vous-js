import { beforeEach } from 'vitest'
import { resetSafeStorageCache } from '../src/composables/safeStorage'

// Les tests remplacent localStorage/sessionStorage d’un cas à l’autre : le verdict mémorisé de safeStorage repart de zéro à chaque test.
beforeEach(resetSafeStorageCache)
