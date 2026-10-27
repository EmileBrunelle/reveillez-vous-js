import { ref, type Ref } from 'vue'
import { useCssVar, useElementBounding, useEventListener, useRafFn, useTimeoutFn } from '@vueuse/core'
import { createTapDrag } from './tapDrag'
import { useDeviceTilt } from './useTilt'

// Inclinaison de la carte : pointeur (souris/stylet, 8° max), doigt (glissement) ou gyroscope, avec un reflet qui suit le point visé.
// Les variables CSS (--rx, --ry, --gx, --gy, --glare) sont écrites hors du rendu Vue (useCssVar sur l’élément, une écriture par image) :
// à 60 Hz, passer par l’état re-rendrait la carte entière. Seul point d’écriture : setTilt / restTilt.
const MAX_TILT = 8
const GYRO_TILT = 20 // plus ample que le pointeur : à 8°, sur un téléphone, ça ne se voyait presque pas
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

type Tilt = { rx: number; ry: number; gx: number; gy: number; glare: number }
type Options = {
  root: Readonly<Ref<HTMLElement | null>> // la carte : repère de position du pointeur et cible des gestes
  tilt: Readonly<Ref<HTMLElement | null>> // l’élément qui porte les variables et la transformation d’inclinaison
  settled: Readonly<Ref<boolean>> // la carte est posée : avant, aucune inclinaison
  reduced: Readonly<Ref<boolean>>
}

export const useCardTilt = ({ root, tilt, settled, reduced }: Options) => {
  const ry = useCssVar('--ry', tilt, { initialValue: '0deg' })
  const rx = useCssVar('--rx', tilt, { initialValue: '0deg' })
  const gx = useCssVar('--gx', tilt, { initialValue: '50%' })
  const gy = useCssVar('--gy', tilt, { initialValue: '50%' })
  const glare = useCssVar('--glare', tilt, { initialValue: '0' })
  const setTilt = (t: Tilt) => {
    ry.value = `${t.ry}deg`
    rx.value = `${t.rx}deg`
    gx.value = `${t.gx}%`
    gy.value = `${t.gy}%`
    glare.value = `${t.glare}`
  }
  const restTilt = () => {
    ry.value = '0deg'
    rx.value = '0deg'
    glare.value = '0'
  }

  // Une seule écriture par image : le dernier point reçu l’emporte.
  let pending: Tilt | null = null
  const { resume, pause } = useRafFn(
    () => {
      pause()
      if (pending) setTilt(pending)
    },
    { immediate: false },
  )
  const cancelPending = () => {
    pending = null
    pause()
  }

  const bounds = useElementBounding(root) // mesuré par VueUse (taille, défilement) : plus de getBoundingClientRect à chaque mouvement
  const touchDrag = createTapDrag()
  const fingerDown = ref(false) // le doigt est le seul maître de l’inclinaison pendant le contact
  let finePointer = false // une souris/stylet a bougé : le pointeur l’emporte sur le gyroscope

  const onMove = (e: PointerEvent) => {
    const touch = e.pointerType === 'touch'
    if (!touch) finePointer = true
    if (touch && (!touchDrag.active || !touchDrag.move(e.clientX, e.clientY))) return
    if (reduced.value || (touch && !fingerDown.value) || !settled.value || !tilt.value) return
    const { left, top, width, height } = bounds
    const dx = clamp((e.clientX - (left.value + width.value / 2)) / width.value)
    const dy = clamp((e.clientY - (top.value + height.value / 2)) / height.value)
    pending = { rx: -dy * MAX_TILT, ry: dx * MAX_TILT, gx: 50 + dx * 60, gy: 50 + dy * 60, glare: 1 }
    resume()
  }
  const onLeave = () => {
    cancelPending()
    restTilt()
  }

  // Gyroscope : mêmes variables que le pointeur ; la carte reste « fixe » dans le monde (sens inverse du téléphone).
  useDeviceTilt({
    enabled: () => !reduced.value && !finePointer && settled.value && !fingerDown.value,
    apply: (nx, ny) => setTilt({ rx: ny * GYRO_TILT, ry: -nx * GYRO_TILT, gx: 50 - nx * 60, gy: 50 - ny * 60, glare: 1 }),
  })

  const onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touchDrag.start(e.clientX, e.clientY)
    if (reduced.value || !settled.value) return
    fingerDown.value = true
    try {
      root.value?.setPointerCapture(e.pointerId)
    } catch {
      // capture refusée : le glissement continue de remonter jusqu’à window
    }
  }
  // Relâché : retour au repos sur ressort doux (transition plus longue posée le temps du retour).
  const releasing = ref(false)
  const { start: startRelease, stop: stopRelease } = useTimeoutFn(() => (releasing.value = false), 650, { immediate: false })
  const onTouchUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touchDrag.end()
    if (!fingerDown.value) return
    fingerDown.value = false
    cancelPending()
    if (!tilt.value) return
    releasing.value = true
    restTilt()
    stopRelease()
    startRelease()
  }

  useEventListener(window, 'pointermove', onMove)
  useEventListener(window, 'pointerup', onTouchUp)
  useEventListener(window, 'pointercancel', onTouchUp)
  useEventListener(document, 'pointerleave', onLeave)

  return {
    releasing,
    onTouchDown,
    /** Vrai si le doigt a glissé pendant ce contact : ce n’était pas un tap. */
    wasDrag: () => touchDrag.moved,
  }
}
