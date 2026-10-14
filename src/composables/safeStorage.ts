export type SafeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const memory = new Map<string, string>()
const fallback: SafeStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, String(v)),
  removeItem: (k) => void memory.delete(k),
}

/**
 * `localStorage` when it is usable, else an in-memory Map shared for the page's lifetime.
 * Merely reading `window.localStorage` throws SecurityError when cookies are blocked or in a sandboxed iframe.
 */
export const safeStorage = (): SafeStorage => {
  try {
    const s = globalThis.localStorage
    const probe = '__rvj-probe'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return fallback
  }
}
