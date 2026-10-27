// Pose de la carte après le retournement : une seule fois par retournement (`arm()` réarme).
// Le bruit sourd joue toujours ; l’ondulation CRT et le reflet sont coupés en mouvement réduit.
export type LandingDeps = {
  reduced: () => boolean
  thud: () => void
  ripple: (amp: number) => void
  shimmer: () => void
}

export const RIPPLE_AMP = 0.45 // plus doux qu’un coup à la porte (0,6 à 1)

export const createLanding = ({ reduced, thud, ripple, shimmer }: LandingDeps) => {
  let armed = true
  return {
    arm: () => {
      armed = true
    },
    land: () => {
      if (!armed) return
      armed = false
      thud()
      if (reduced()) return
      ripple(RIPPLE_AMP)
      shimmer()
    },
  }
}
