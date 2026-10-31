// Bulles de la barre des tâches liées à la porte : une par visite (niveau 2+), peu après l’arrivée.
import { storeToRefs } from 'pinia'
import { useTimeoutFn } from '@vueuse/core'
import { prophecies, tableKey } from '../content/prophecies'
import { nextTitled } from '../engine/prophecy'
import type { Rng } from '../engine/rng'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { safeStorage } from './safeStorage'

export const useBubbles = (rng: Rng) => {
  const { level } = storeToRefs(useProgressStore())
  const session = useSessionStore()
  // Sur écran étroit, la bulle ne reste pas au-delà de la porte (elle couvrirait la carte ou « Fermer la porte »).
  const { start: startBubble, stop: stopBubble } = useTimeoutFn(
    () => {
      const b = level.value >= 2 ? nextTitled(prophecies, tableKey('bulle', level.value), safeStorage(), rng) : null
      if (b) session.notify(b.title, b.text)
    },
    2500,
    { immediate: false },
  )
  const clearBubbles = () => session.notifications.forEach((n) => session.dismiss(n.id))
  return { startBubble, stopBubble, clearBubbles }
}
