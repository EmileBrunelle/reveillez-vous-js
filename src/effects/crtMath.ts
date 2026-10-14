// Miroir TS des termes spatiaux de crt.wgsl (sombre = vignette + biseau, frange = aberration chromatique de bord),
// pour les vérifier numériquement. Garder synchronisé avec le shader. x, y en fraction [0,1] de l’écran.
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const sdRound = (px: number, py: number, bx: number, by: number, r: number) => {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Sombre ajouté (alpha) par biseau + vignette, et force de la frange de bord. `legacy` = formules d’avant le correctif. */
export const crtEdgeTerms = (w: number, h: number, p: number, x: number, y: number, legacy = false) => {
  const aspect = w / h
  const c2x = x - 0.5
  const c2y = y - 0.5
  const rr = 0.05 + 0.02 * p
  const m = Math.min(w, h)
  const cx = (c2x * w) / m
  const cy = (c2y * h) / m
  const hx = w / (2 * m)
  const land = legacy ? 1 : smoothstep(0.7, 1.4, aspect)
  const mix = (a: number, b: number) => a + (b - a) * land
  const sdNew = sdRound(cx, cy, hx, h / (2 * m), rr)
  const sdOld = sdRound(c2x * aspect, c2y, 0.5 * aspect, 0.5, rr)
  const r2 = c2x * c2x + c2y * c2y
  const bezel = mix(smoothstep(-0.05, 0, sdNew), smoothstep(-0.3, 0, sdOld)) * (0.38 + 0.22 * p)
  const vig = mix(smoothstep(0.16 - 0.04 * p, 0.55, r2), smoothstep(0.1 - 0.05 * p, 0.55, r2)) * (0.3 + 0.2 * p)
  const edge = mix(smoothstep(0.04 + 0.02 * p, 0, hx - Math.abs(cx)), smoothstep(0.2 - 0.08 * p, 0.5, Math.abs(c2x))) * (0.14 + 0.26 * p)
  return { dark: bezel + vig, edge }
}
