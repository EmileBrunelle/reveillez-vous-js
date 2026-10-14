import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

export interface Notification {
  id: number
  text: string
}

/** État de la session en cours (non persisté). */
export const useSessionStore = defineStore('session', () => {
  // Impulsion de coup (voyant·e ou joueur·euse) : `seq` change à chaque coup, `at` = performance.now().
  const knock = shallowRef({ seq: 0, amp: 0, at: 0 })
  const pulse = (amp = 1) => {
    knock.value = { seq: knock.value.seq + 1, amp, at: performance.now() }
  }

  // Bulles de la barre des tâches (T6).
  const notifications = ref<Notification[]>([])
  let nextId = 1
  const notify = (text: string) => {
    const id = nextId++
    notifications.value.push({ id, text })
    return id
  }
  const dismiss = (id: number) => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  return { knock, pulse, notifications, notify, dismiss }
})
