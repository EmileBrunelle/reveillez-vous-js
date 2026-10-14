import { onScopeDispose } from 'vue'
import { useDocumentVisibility, useEventListener } from '@vueuse/core'

// iOS 13+ exige un geste utilisateur pour activer deviceorientation. Ailleurs : no-op.
// Ne jamais appeler hors d’un geste ; un refus est ignoré en silence.
export const requestOrientationPermission = () => {
  const D = (typeof DeviceOrientationEvent === 'undefined' ? undefined : DeviceOrientationEvent) as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
    | undefined
  if (typeof D?.requestPermission !== 'function') return
  try {
    void D.requestPermission().catch(() => {})
  } catch {
    // ignoré
  }
}

const RANGE = 15 // degrés d’inclinaison du téléphone pour atteindre l’inclinaison max de la carte
const TAU_MS = 2500 // constante de temps de la référence qui dérive vers la lecture
const MAX_JUMP = 90 // écart absurde (saut de beta/gamma au retournement) : on repart de zéro
const SETTLE_MS = 500 // lectures ignorées après une rotation d’écran
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export type Point = { x: number; y: number }

// Écart (en degrés) par rapport à la référence, puis la référence glisse vers la lecture
// (filtre exponentiel indépendant de la cadence). Un mouvement rapide donne un grand écart ;
// immobile, la carte revient à plat en quelques secondes ; une mauvaise référence se corrige seule.
export const stepBaseline = (base: Point, reading: Point, dtMs: number) => {
  const dx = reading.x - base.x
  const dy = reading.y - base.y
  if (Math.abs(dx) > MAX_JUMP || Math.abs(dy) > MAX_JUMP) {
    return { base: { x: reading.x, y: reading.y }, dx: 0, dy: 0 }
  }
  const k = 1 - Math.exp(-Math.max(0, dtMs) / TAU_MS)
  return { base: { x: base.x + dx * k, y: base.y + dy * k }, dx, dy }
}

type Options = {
  // Faux : on ignore les événements (mouvement réduit, carte pas posée, souris en usage…).
  enabled: () => boolean
  // nx, ny dans [-1, 1], déjà lissés ; `done` quand le mouvement est revenu au repos.
  apply: (nx: number, ny: number) => void
}

// Inclinaison via gyroscope/accéléromètre : la référence (baseline) est prise au premier événement valide,
// l’écran en paysage échange les axes, un rAF lisse (lerp), pause quand l’onglet est caché.
export const useDeviceTilt = ({ enabled, apply }: Options) => {
  const visibility = useDocumentVisibility()
  let base: (Point & { angle: number }) | null = null
  let lastT = 0
  let ignoreUntil = 0
  let tx = 0
  let ty = 0
  let cx = 0
  let cy = 0
  let raf = 0

  const step = () => {
    cx += (tx - cx) * 0.15
    cy += (ty - cy) * 0.15
    apply(cx, cy)
    raf = Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0
  }

  useEventListener(window, 'deviceorientation', (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null || visibility.value === 'hidden' || !enabled()) return
    const angle = ((screen.orientation?.angle ?? 0) % 360 + 360) % 360
    // Axes écran selon la rotation : x = vers la droite de l’écran, y = vers le bas.
    const x = angle === 90 ? e.beta : angle === 180 ? -e.gamma : angle === 270 ? -e.beta : e.gamma
    const y = angle === 90 ? -e.gamma : angle === 180 ? -e.beta : angle === 270 ? e.gamma : e.beta
    const now = performance.now()
    if (now < ignoreUntil) return
    if (!base || base.angle !== angle) {
      base = { x, y, angle }
      lastT = now
    }
    const r = stepBaseline(base, { x, y }, now - lastT)
    lastT = now
    base = { ...r.base, angle }
    tx = clamp(r.dx / RANGE)
    ty = clamp(r.dy / RANGE)
    if (!raf) raf = requestAnimationFrame(step)
  })

  // Rotation d’écran : transitoire instable, on oublie la référence et on ignore ~500 ms.
  const onRotate = () => {
    base = null
    ignoreUntil = performance.now() + SETTLE_MS
    tx = 0
    ty = 0
    if (!raf) raf = requestAnimationFrame(step)
  }
  if (typeof screen !== 'undefined' && screen.orientation) useEventListener(screen.orientation, 'change', onRotate)
  else useEventListener(window, 'orientationchange', onRotate)

  // Onglet caché : on repart d’une nouvelle référence au retour.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') base = null
  })

  onScopeDispose(() => cancelAnimationFrame(raf))
}
