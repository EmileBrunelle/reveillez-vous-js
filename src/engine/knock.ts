/** 0 (polite, level 1) .. 1 (frantic, level 5): scales gain and the visual impulse. Level is clamped to 1..5. Pure. */
export const knockIntensity = (level: number): number => (Math.min(5, Math.max(1, Math.round(level))) - 1) / 4
