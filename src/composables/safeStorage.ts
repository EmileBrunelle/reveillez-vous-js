export type SafeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const memoryFallback = (): SafeStorage => {
  const memory = new Map<string, string>()
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, String(v)),
    removeItem: (k) => void memory.delete(k),
  }
}
const localFallback = memoryFallback()
const sessionFallback = memoryFallback()

/** Sonde le stockage une seule fois (écriture + suppression d’une clé) puis mémorise le résultat : les 20 et quelques appels du jeu ne retouchent plus au disque. */
const memoUsable = (get: () => Storage, fallback: SafeStorage) => {
  let chosen: SafeStorage | undefined
  const read = () => {
    if (chosen) return chosen
    try {
      const s = get()
      const probe = '__rvj-probe'
      s.setItem(probe, '1')
      s.removeItem(probe)
      chosen = s
    } catch {
      chosen = fallback
    }
    return chosen
  }
  return Object.assign(read, { reset: () => void (chosen = undefined) })
}

const local = memoUsable(() => globalThis.localStorage, localFallback)
const session = memoUsable(() => globalThis.sessionStorage, sessionFallback)

/**
 * `localStorage` s’il est utilisable, sinon une Map en mémoire partagée pour la durée de la page.
 * Le simple fait de lire `window.localStorage` lève une SecurityError quand les témoins sont bloqués ou dans un iframe isolé.
 * Le verdict est mémorisé au premier appel (le stockage ne change pas de nature en cours de page).
 */
export const safeStorage = (): SafeStorage => local()

/** Comme `safeStorage`, sur `sessionStorage` : survit à un rechargement, effacé à la fermeture de l’onglet ou du navigateur. */
export const safeSessionStorage = (): SafeStorage => session()

/** Pour les tests seulement : oublie les verdicts mémorisés. */
export const resetSafeStorageCache = () => {
  local.reset()
  session.reset()
}
