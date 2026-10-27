import { ACTIVITY_PROMPTS, type TimedActivity } from '../content/activityPrompts'

/** Plafond de durée d’une activité chronométrée (ms). */
export const MAX_ACTIVITY_MS = 20_000
/** Durée d’affichage de l’issue (réussite ou échec) avant de passer à la suite (ms). */
export const OUTCOME_MS = 1000

/**
 * Délai de grâce (ms) avant que la minuterie ne coule : le temps que le verbe géant du HUD surgisse (ressort) et se range
 * (rangement à 800 ms + ~200 ms de ressort). La barre reste pleine pendant ce délai.
 */
export const ACTIVITY_GRACE_MS = 1000

export type Outcome = 'win' | 'fail'
export type Phase = 'play' | Outcome

/** Durée retenue d’une activité (ms), bornée à [1 s ; plafond]. */
export const durationOf = (id: TimedActivity): number => Math.min(MAX_ACTIVITY_MS, Math.max(1000, ACTIVITY_PROMPTS[id].ms))

/** Issue : réussite seulement si la réussite survient avant la fin du temps imparti ; sinon échec. */
export const outcomeAt = (elapsedMs: number, durationMs: number, won: boolean): Outcome => (won && elapsedMs < durationMs ? 'win' : 'fail')

/** Durée d’affichage de l’issue d’une activité (ms). */
export const outcomeMsOf = (id: TimedActivity): number => ACTIVITY_PROMPTS[id].outcomeMs ?? OUTCOME_MS

/** Texte de l’issue (annoncé et affiché par le HUD) : vide tant que l’activité se joue, donc une seule mise à jour de la région d’annonce, à l’issue. */
export const outcomeText = (id: TimedActivity, phase: Phase): string => (phase === 'win' ? ACTIVITY_PROMPTS[id].win : phase === 'fail' ? ACTIVITY_PROMPTS[id].fail : '')

/** Part de temps restante, de 1 (début) à 0 (fin). */
export const timeLeft = (elapsedMs: number, durationMs: number): number => (durationMs <= 0 ? 0 : Math.min(1, Math.max(0, 1 - elapsedMs / durationMs)))
