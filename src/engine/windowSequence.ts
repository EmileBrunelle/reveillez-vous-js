import type { Rng } from './rng'

/** Séquence de `length` fenêtres distinctes parmi `windows` (tirage Fisher-Yates partiel, Rng injecté). */
export const makeSequence = (rng: Rng, length = 3, windows = 6): number[] => {
  const pool = Array.from({ length: windows }, (_, i) => i)
  const n = Math.min(length, windows)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (windows - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

export type InputState = { step: number; misses: number }
export type StepResult = 'ok' | 'done' | 'wrong'

export const startInput = (): InputState => ({ step: 0, misses: 0 })

/** Vérifie un coup. Erreur : retour au début de la séquence, les ratés s’accumulent (jamais punitif). */
export const checkStep = (seq: readonly number[], state: InputState, windowIndex: number): { state: InputState; result: StepResult } => {
  if (windowIndex !== seq[state.step]) return { state: { step: 0, misses: state.misses + 1 }, result: 'wrong' }
  const step = state.step + 1
  return { state: { step, misses: state.misses }, result: step >= seq.length ? 'done' : 'ok' }
}

/** Après 2 ratés, la prochaine fenêtre attendue reste faiblement marquée. */
export const hintFor = (seq: readonly number[], state: InputState, after = 2): number | null => (state.misses >= after ? (seq[state.step] ?? null) : null)
