// Migrations à usage unique, exécutées au démarrage (avant le montage de l’application).
import { VISITS_KEY } from './stores/progress'
import { safeStorage } from './composables/safeStorage'

/** L’ancien compteur de visites persistant (localStorage) est supprimé sans être importé : tout le monde repart au niveau 1. */
export const purgeLegacyVisits = () => safeStorage().removeItem(VISITS_KEY)
