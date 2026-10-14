import type { Rng } from './rng'

/** `order` is a permutation of 0..size-1; `pos` is how many of them were already drawn. */
export interface Bag {
  order: number[]
  pos: number
}

export const BAGS_KEY = 'rvj-bags'

/** Fisher-Yates with the supplied rng. */
export const shuffled = (size: number, rng: Rng): number[] => {
  const a = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const valid = (bag: unknown, size: number): bag is Bag => {
  if (!bag || typeof bag !== 'object') return false
  const { order, pos } = bag as Bag
  if (!Array.isArray(order) || order.length !== size) return false
  if (!Number.isInteger(pos) || pos < 0 || pos > size) return false
  const seen = new Set(order)
  return seen.size === size && order.every((n) => Number.isInteger(n) && n >= 0 && n < size)
}

/**
 * Draw the next template index. Every index is used once before the bag is reshuffled.
 * A stale/corrupt bag (or one for a different `size`) is discarded. On reshuffle, the first
 * draw never equals the last one of the previous round (when size > 1).
 */
export const draw = (bag: Bag | undefined | null, size: number, rng: Rng): { index: number; bag: Bag } => {
  if (size <= 0) throw new Error('shuffleBag: size must be > 0')
  let cur: Bag
  if (valid(bag, size) && bag.pos < size) {
    cur = bag
  } else {
    const last = valid(bag, size) ? bag.order[size - 1] : -1
    const order = shuffled(size, rng)
    if (size > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]]
    cur = { order, pos: 0 }
  }
  return { index: cur.order[cur.pos], bag: { order: cur.order, pos: cur.pos + 1 } }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

const load = (storage: Store, key: string): Record<string, Bag> => {
  try {
    const raw = JSON.parse(storage.getItem(key) ?? '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

/** Draw from the persisted bag named `id` (e.g. `niveau3`), saving the new state. Storage failures are non-fatal. */
export const drawPersisted = (storage: Store, id: string, size: number, rng: Rng): number => {
  const bags = load(storage, BAGS_KEY)
  const { index, bag } = draw(bags[id], size, rng)
  bags[id] = bag
  try {
    storage.setItem(BAGS_KEY, JSON.stringify(bags))
  } catch {
    /* ignore */
  }
  return index
}
