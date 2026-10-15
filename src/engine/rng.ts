/** Float in [0, 1). Injected everywhere so tests can pass a deterministic one. */
export type Rng = () => number

/** Production randomness: crypto.getRandomValues-backed. */
export const secureRng = (): Rng => {
  const buf = new Uint32Array(1)
  return () => {
    crypto.getRandomValues(buf)
    return buf[0] / 4294967296
  }
}

/** Rng injecté, ou production par défaut (à appeler une fois ; jamais en défaut de prop Vue, qui prendrait la fabrique pour la valeur). */
export const orSecure = (rng?: Rng): Rng => rng ?? secureRng()

/** mulberry32: small seeded PRNG, for tests only. */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
