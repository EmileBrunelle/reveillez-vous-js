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

const RANGE = 25 // degrés d’inclinaison du téléphone = inclinaison max de la carte
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

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
  let base: { x: number; y: number; angle: number } | null = null
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
    if (!base || base.angle !== angle) base = { x, y, angle }
    tx = clamp((x - base.x) / RANGE)
    ty = clamp((y - base.y) / RANGE)
    if (!raf) raf = requestAnimationFrame(step)
  })

  // Onglet caché : on repart d’une nouvelle référence au retour.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') base = null
  })

  onScopeDispose(() => cancelAnimationFrame(raf))
}
