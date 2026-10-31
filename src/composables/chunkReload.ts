import { realSessionHolds, safeSessionStorage, type SafeStorage } from './safeStorage'

const KEY = 'rvj-chunk-reload'
/** Un seul rechargement automatique par fenêtre : au-delà, l’échec n’est pas un simple déploiement, le repli « Réessayer » prend le relais. */
export const AUTO_RELOAD_WINDOW_MS = 60_000

type Env = { storage?: SafeStorage; now?: number; online?: boolean; reload?: () => void; holds?: (key: string, value: string) => boolean }

/**
 * Chunk introuvable : le cas typique est un onglet resté ouvert pendant un redéploiement (les noms de fichiers hachés ont changé).
 * On recharge alors la page une fois, sans rien demander (recette Vite pour `vite:preloadError`) ; la partie survit (visites en sessionStorage).
 * Hors ligne, déjà rechargé il y a moins d’une minute, ou horodatage qui ne survivrait pas au rechargement (sessionStorage inutilisable : la Map de repli serait perdue, d’où une boucle) : on ne recharge pas (renvoie false) et l’appelant affiche son repli.
 */
export const tryAutoReload = ({
  storage = safeSessionStorage(),
  now = Date.now(),
  online = globalThis.navigator?.onLine === true,
  reload = () => location.reload(),
  holds = realSessionHolds,
}: Env = {}): boolean => {
  if (!online) return false
  const last = Number(storage.getItem(KEY) ?? 0)
  if (now - last < AUTO_RELOAD_WINDOW_MS) return false
  storage.setItem(KEY, String(now))
  if (!holds(KEY, String(now))) return false
  reload()
  return true
}
