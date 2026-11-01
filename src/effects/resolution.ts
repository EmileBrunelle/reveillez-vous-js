/** Côté long interne visé sous CRT (budget mobile) ; le canvas est agrandi par le CSS (linéaire). */
export const MAX_LONG = 540
/** Facteur d’échelle sous CRT : ~0,5 pixel interne par pixel CSS. */
export const CRT_SCALE = 0.5
/**
 * Plafond de pixels rendus quand le CRT est éteint (finale). ~2,5 Mpx : 1,6 Mpx à 2000×788 (1×), plafonné en 4K ou sur écran
 * dense. Un iGPU Intel Iris Xe tient une scène calme (30 i/s) à ce coût ; au-delà, le gain visible sous l’étirement CSS est nul.
 */
export const SHARP_MAX_PIXELS = 2_500_000

/** Coefficients de résolution par niveau de qualité (voir `stores/quality.ts`) : échelle sous CRT, plafond de pixels quand le CRT est éteint. */
export const RES_BY_LEVEL = {
  high: { scale: 1, pixels: 1 },
  medium: { scale: 1, pixels: 0.65 },
  low: { scale: 0.75, pixels: 0.4 },
} as const
export type ResLevel = keyof typeof RES_BY_LEVEL

/**
 * Facteur d’échelle (pixels internes par pixel CSS) du fond raymarché.
 * CRT allumé : 0,5 plafonné à 540 px de côté long (rendu pixel voulu). CRT éteint : 1 × DPR de l’appareil,
 * plafonné par `SHARP_MAX_PIXELS` ; jamais en dessous du facteur CRT. `level` réduit les deux (`RES_BY_LEVEL`).
 */
export const placeDpr = (cssW: number, cssH: number, sharp: boolean, deviceDpr: number, level: ResLevel = 'high'): number => {
  const k = RES_BY_LEVEL[level]
  const crt = Math.min(CRT_SCALE, MAX_LONG / Math.max(cssW, cssH, 1)) * k.scale
  if (!sharp) return crt
  const dpr = Math.max(1, Number.isFinite(deviceDpr) ? deviceDpr : 1)
  const cap = Math.sqrt((SHARP_MAX_PIXELS * k.pixels) / Math.max(cssW * cssH, 1))
  return Math.max(crt, Math.min(dpr, cap))
}
