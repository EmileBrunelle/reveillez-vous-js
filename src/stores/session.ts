import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTimeoutFn } from '@vueuse/core'

export interface Notification {
  id: number
  /** Vide : bulle sans titre. */
  title: string
  text: string
}

const RELEASE_DELAY_MS = 1000

/** État de la session en cours (non persisté). */
export const useSessionStore = defineStore('session', () => {
  // Impulsion de coup (personne voyante ou personne qui joue) : `seq` change à chaque coup, `at` = performance.now().
  const knock = shallowRef({ seq: 0, amp: 0, at: 0 })
  const pulse = (amp = 1) => {
    knock.value = { seq: knock.value.seq + 1, amp, at: performance.now() }
  }

  // Bulles de la barre des tâches (T6).
  const notifications = ref<Notification[]>([])
  let nextId = 1
  const notify = (title: string, text: string) => {
    const id = nextId++
    notifications.value.push({ id, title, text })
    return id
  }
  const dismiss = (id: number) => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  // Activité en cours : les bulles sont retenues (elles couvriraient la barre de progression, « Passer » et le résultat),
  // puis rendues peu après la fin. Une bulle déjà affichée est simplement masquée, puis réaffichée (délai de 7 s relancé).
  const activityRunning = ref(false)
  const balloonsHeld = ref(false)
  const { start: startRelease, stop: stopRelease } = useTimeoutFn(() => (balloonsHeld.value = false), RELEASE_DELAY_MS, { immediate: false })
  const setActivityRunning = (running: boolean) => {
    activityRunning.value = running
    if (running) {
      stopRelease()
      balloonsHeld.value = true
    } else if (balloonsHeld.value) startRelease()
  }

  return { knock, pulse, notifications, notify, dismiss, activityRunning, balloonsHeld, setActivityRunning }
})
