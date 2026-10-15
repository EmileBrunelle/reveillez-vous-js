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

const usable = (get: () => Storage, fallback: SafeStorage): SafeStorage => {
  try {
    const s = get()
    const probe = '__rvj-probe'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return fallback
  }
}

/**
 * `localStorage` when it is usable, else an in-memory Map shared for the page's lifetime.
 * Merely reading `window.localStorage` throws SecurityError when cookies are blocked or in a sandboxed iframe.
 */
export const safeStorage = (): SafeStorage => usable(() => globalThis.localStorage, localFallback)

/** Same as `safeStorage` but on `sessionStorage`: survives a reload, cleared when the tab or browser closes. */
export const safeSessionStorage = (): SafeStorage => usable(() => globalThis.sessionStorage, sessionFallback)
