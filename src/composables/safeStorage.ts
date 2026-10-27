export type SafeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type MemoryStorage = SafeStorage & { clear: () => void }

const memoryFallback = (): MemoryStorage => {
  const memory = new Map<string, string>()
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, String(v)),
    removeItem: (k) => void memory.delete(k),
    clear: () => memory.clear(),
  }
}
const localFallback = memoryFallback()
const sessionFallback = memoryFallback()

/**
 * Stockage réel dont une écriture refusée après coup (quota plein, mode privé) bascule vers la Map en mémoire au lieu de lever chez l’appelant.
 * La Map prime à la lecture : elle ne contient que ce que le stockage réel a refusé.
 */
const guarded = (real: Storage, fallback: SafeStorage): SafeStorage => ({
  getItem: (k) => {
    const kept = fallback.getItem(k)
    if (kept !== null) return kept
    try {
      return real.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      real.setItem(k, v)
      fallback.removeItem(k) // l’écriture a réussi : une valeur de repli plus ancienne ne doit plus la masquer
    } catch {
      fallback.setItem(k, v)
    }
  },
  removeItem: (k) => {
    fallback.removeItem(k)
    try {
      real.removeItem(k)
    } catch {
      // rien à retirer de plus
    }
  },
})

/** Sonde le stockage une seule fois (écriture + suppression d’une clé) puis mémorise le verdict : les appels du jeu ne retouchent plus au disque. */
const memoUsable = (get: () => Storage, fallback: MemoryStorage) => {
  let chosen: SafeStorage | undefined
  const read = () => {
    if (chosen) return chosen
    try {
      const s = get()
      const probe = '__rvj-probe'
      s.setItem(probe, '1')
      s.removeItem(probe)
      chosen = guarded(s, fallback)
    } catch {
      chosen = fallback
    }
    return chosen
  }
  return Object.assign(read, {
    reset: () => {
      chosen = undefined
      fallback.clear()
    },
  })
}

const local = memoUsable(() => globalThis.localStorage, localFallback)
const session = memoUsable(() => globalThis.sessionStorage, sessionFallback)

/**
 * `localStorage` s’il est utilisable, sinon une Map en mémoire partagée pour la durée de la page.
 * Le simple fait de lire `window.localStorage` lève une SecurityError quand les témoins sont bloqués ou dans un iframe isolé.
 * Le verdict est mémorisé au premier appel ; une écriture refusée plus tard (quota plein) bascule vers la Map, sans lever.
 */
export const safeStorage = (): SafeStorage => local()

/** Comme `safeStorage`, sur `sessionStorage` : survit à un rechargement, effacé à la fermeture de l’onglet ou du navigateur. */
export const safeSessionStorage = (): SafeStorage => session()

/** Pour les tests seulement : oublie les verdicts mémorisés et vide les Maps de repli. */
export const resetSafeStorageCache = () => {
  local.reset()
  session.reset()
}
