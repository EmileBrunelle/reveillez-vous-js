// Tap court vs glissement au doigt : au-delà de TAP_SLOP px depuis le point de contact, ce n’est plus un tap.
export const TAP_SLOP = 10

export const createTapDrag = (slop = TAP_SLOP) => {
  let sx = 0
  let sy = 0
  let down = false
  let moved = false
  return {
    start: (x: number, y: number) => {
      sx = x
      sy = y
      down = true
      moved = false
    },
    // Vrai dès que le doigt a dépassé le seuil (et le reste jusqu’à la fin du contact).
    move: (x: number, y: number) => {
      if (down && !moved && Math.hypot(x - sx, y - sy) > slop) moved = true
      return moved
    },
    end: () => {
      down = false
    },
    get active() {
      return down
    },
    get moved() {
      return moved
    },
  }
}
