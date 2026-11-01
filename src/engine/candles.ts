import type { Rng } from './rng'

// Machine d’états des chandelles (allumer, souffler, rallumer, protéger, gagner) : fonctions pures, l’aléa est injecté.
// Le composant ne tient que le temps (minuteries, pause) et le pointeur ; chaque règle de jeu est ici et testée seule.

// Nombre de chandelles de la scène.
export const COUNT = 3
// Durée pendant laquelle la flamme doit rester sur une mèche pour l’allumer.
export const HOLD_MS = 600
// Délai entre la troisième chandelle allumée et le courant d’air.
export const DRAFT_DELAY_MS = 450
// Sans rallumage à la main (niveau 3 seulement), la chandelle soufflée se rallume seule après ce délai.
export const RELIGHT_MS = 4000
// Temps restant minimal pour armer le courant d’air : son délai plus le rallumage, plus une marge.
// En deçà, les trois chandelles allumées valent la victoire tout de suite (aucun échec injuste sur des chandelles allumées).
export const DRAFT_MIN_LEFT_MS = DRAFT_DELAY_MS + RELIGHT_MS + 50
// Même garde-fou au moment où le courant d’air souffle effectivement : il reste de quoi rallumer.
export const DRAFT_FIRE_MIN_LEFT_MS = RELIGHT_MS + 50

// Courant d’air une seule fois, dès le niveau 3 (l’activité peut être rejouée aux niveaux suivants).
export const hasDraft = (level: number) => level >= 3
// Rallumage automatique : niveau 3 seulement. Dès le niveau 4, une chandelle soufflée se rallume à la main.
export const autoRelights = (level: number) => level < 4

export interface CandlesState {
  readonly lit: readonly boolean[]
  // Progression d’allumage (0 à 1) des mèches éteintes ; une chandelle allumée n’a plus de progression (0).
  readonly hold: readonly number[]
  // Indice de la chandelle soufflée par le courant d’air (-1 : aucune).
  readonly snuffed: number
  // Le courant d’air est armé ou déjà passé : il n’arrive qu’une fois.
  readonly draftUsed: boolean
}

export const initCandles = (level: number, count = COUNT): CandlesState => ({
  lit: Array<boolean>(count).fill(false),
  hold: Array<number>(count).fill(0),
  snuffed: -1,
  draftUsed: !hasDraft(level),
})

export const litCount = (s: CandlesState) => s.lit.filter(Boolean).length
export const allLit = (s: CandlesState) => s.lit.every(Boolean)

// Progression d’allumage d’une mèche (0 à 1) : monte pendant le contact, retombe plus vite sinon.
export const advanceHold = (progress: number, touching: boolean, dtMs: number, holdMs = HOLD_MS) => {
  const next = touching ? progress + dtMs / holdMs : progress - (dtMs / holdMs) * 2
  return Math.min(1, Math.max(0, next))
}

// Flamme à portée de la mèche (distance contre un rayon).
export const isNearWick = (fx: number, fy: number, wx: number, wy: number, radius: number) => (fx - wx) ** 2 + (fy - wy) ** 2 <= radius ** 2

// Fait avancer toutes les mèches éteintes d’un pas de temps. `reached` : mèches arrivées à 1 pendant ce pas (à allumer).
// Rend l’état reçu tel quel si rien ne bouge (aucun rendu inutile).
export const advanceHolds = (s: CandlesState, touching: readonly boolean[], dtMs: number): { state: CandlesState; reached: number[] } => {
  const reached: number[] = []
  let changed = false
  const hold = s.hold.map((h, i) => {
    if (s.lit[i]) return h
    const p = advanceHold(h, !!touching[i], dtMs)
    if (p !== h) changed = true
    if (p >= 1) reached.push(i)
    return p
  })
  return { state: changed ? { ...s, hold } : s, reached }
}

// Remet à zéro la progression des mèches éteintes (pointeur annulé).
export const resetHolds = (s: CandlesState): CandlesState => (s.hold.some((h, i) => !s.lit[i] && h !== 0) ? { ...s, hold: s.hold.map((h, i) => (s.lit[i] ? h : 0)) } : s)

export type LightStep = 'none' | 'lit' | 'draft' | 'win'

// Allume la chandelle `i`. `draft` : les trois sont allumées et le courant d’air est armé ; `win` : les trois sont allumées, rien d’autre à faire.
// `leftMs` : temps de jeu restant, pour ne jamais armer un courant d’air qui ne laisse pas le temps de rallumer.
export const lightCandle = (s: CandlesState, i: number, level: number, leftMs: number): { state: CandlesState; step: LightStep } => {
  if (i < 0 || i >= s.lit.length || s.lit[i]) return { state: s, step: 'none' }
  const lit = s.lit.map((on, j) => on || j === i)
  const hold = s.hold.map((h, j) => (j === i ? 0 : h))
  const base = { ...s, lit, hold, snuffed: s.snuffed === i ? -1 : s.snuffed }
  if (!lit.every(Boolean)) return { state: base, step: 'lit' }
  if (!s.draftUsed && hasDraft(level) && leftMs >= DRAFT_MIN_LEFT_MS) return { state: { ...base, draftUsed: true }, step: 'draft' }
  return { state: base, step: 'win' }
}

// Chandelle à éteindre : tirée au hasard parmi les allumées non protégées (survolée, focalisée ou tenue au doigt), -1 s’il n’y en a pas.
export const pickSnuffed = (lit: readonly boolean[], rng: Rng, excluded: ReadonlySet<number> = new Set()) => {
  const idx = lit.flatMap((on, i) => (on && !excluded.has(i) ? [i] : []))
  return idx.length ? idx[Math.floor(rng() * idx.length)] : -1
}

export type SnuffStep = 'snuffed' | 'retry' | 'win'

// Le courant d’air souffle. `retry` : toutes les allumées sont protégées, on réessaie plus tard (tant qu’il reste du temps) ;
// `win` : plus assez de temps pour rallumer, les trois chandelles allumées sont une victoire.
export const snuffStep = (s: CandlesState, rng: Rng, protectedIdx: ReadonlySet<number>, leftMs: number): { state: CandlesState; step: SnuffStep } => {
  if (leftMs < DRAFT_FIRE_MIN_LEFT_MS) return { state: s, step: 'win' }
  const i = pickSnuffed(s.lit, rng, protectedIdx)
  if (i < 0) return { state: s, step: 'retry' }
  return { state: { ...s, lit: s.lit.map((on, j) => on && j !== i), hold: s.hold.map((h, j) => (j === i ? 0 : h)), snuffed: i }, step: 'snuffed' }
}

// Rallumage automatique (niveau 3) : la chandelle soufflée se rallume seule ; si toutes sont alors allumées, c’est la victoire.
export const relightSnuffed = (s: CandlesState): { state: CandlesState; step: 'none' | 'win' } => {
  if (s.snuffed < 0) return { state: s, step: 'none' }
  const lit = s.lit.map((on, j) => on || j === s.snuffed)
  return { state: { ...s, lit, snuffed: -1 }, step: lit.every(Boolean) ? 'win' : 'none' }
}
