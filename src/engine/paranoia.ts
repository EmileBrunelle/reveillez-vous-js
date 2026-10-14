export type ParanoiaLevel = 1 | 2 | 3 | 4 | 5

/**
 * Maps the number of times the door was reopened in this browser to a paranoia level.
 *
 * Contract:
 * - `visits` is the count of « Fermer la porte » clicks persisted in this browser; integer, >= 0.
 * - Must return an integer in 1..5 for every `visits` >= 0.
 * - Expected default: monotonic non-decreasing (the tract never gets calmer as visits grow).
 */
export const paranoiaLevel = (visits: number): ParanoiaLevel => {
  // TODO(Émile): design choice — this is your call.
  //  1. How many visits per level? Linear (every 2 visits, as below), front-loaded (quick
  //     escalation: 0,1,3,6,10) or back-loaded (slow burn so level 5 feels earned)?
  //  2. Should it ever go back down (e.g. after a long absence, or randomly to keep players
  //     off balance)? Today it never does; a non-monotonic version would need a timestamp
  //     persisted next to the visits counter.
  // Temporary body so the app works:
  return Math.min(5, 1 + Math.floor(visits / 2)) as ParanoiaLevel
}
