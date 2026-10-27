/** 0 (poli, niveau 1) .. 1 (frénétique, niveau 5) : règle le gain et l’impulsion visuelle. Le niveau est borné à 1..5. Pure. */
export const knockIntensity = (level: number): number => (Math.min(5, Math.max(1, Math.round(level))) - 1) / 4
