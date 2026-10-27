/** Flottant dans [0, 1). Injecté partout pour que les tests puissent en passer un déterministe. */
export type Rng = () => number

/** Aléa de production : appuyé sur crypto.getRandomValues. */
export const secureRng = (): Rng => {
  const buf = new Uint32Array(1)
  return () => {
    crypto.getRandomValues(buf)
    return buf[0] / 4294967296
  }
}

/** Rng injecté, ou production par défaut (à appeler une fois ; jamais en défaut de prop Vue, qui prendrait la fabrique pour la valeur). */
export const orSecure = (rng?: Rng): Rng => rng ?? secureRng()

/** mulberry32 : petit PRNG à graine, pour les tests seulement. */
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
