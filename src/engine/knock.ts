export interface KnockPlan {
  /** Seconds after the start of the cycle, one entry per hit. */
  offsets: number[]
  /** 0 (polite) .. 1 (frantic): scales gain and the visual impulse. */
  intensity: number
}

/** Level 1 = 3 polite knocks (0.30 s apart); level 5 = 7 frantic ones (0.14 s apart). Pure. */
export const knockPlan = (level: number, lead = 0.1): KnockPlan => {
  const l = Math.min(5, Math.max(1, Math.round(level)))
  const count = l + 2
  const gap = 0.3 - 0.04 * (l - 1)
  return { offsets: Array.from({ length: count }, (_, i) => lead + i * gap), intensity: (l - 1) / 4 }
}
