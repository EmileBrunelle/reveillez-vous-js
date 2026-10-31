import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ErrorIcon } from '@/engine/prophecy'

export interface WinEntry {
  id: number
  title: string
  icon: ErrorIcon
  minimized: boolean
  /** Décalage de glissement (voir useWinDrag) : sert à connaître le rectangle réel de la fenêtre. */
  offset: { x: number; y: number }
}

/**
 * Gestionnaire des fenêtres Windows 98 non modales (les fausses erreurs ; les `<dialog>` modales n’y passent pas).
 * `stack` est l’ordre d’empilement, de l’arrière (index 0) vers l’avant : le `z-index` s’en déduit (`zIndexOf`),
 * il n’y a donc aucun compteur qui grimpe. Non persisté : tout est vidé quand la lecture se termine (`clear`).
 */
export const useWindowsStore = defineStore('windows', () => {
  const stack = ref<WinEntry[]>([])

  // Les boutons de la barre des tâches gardent l’ordre d’ouverture, pas l’ordre d’empilement : le bouton ne saute pas quand on change de fenêtre.
  const openOrder = ref<number[]>([])
  const windows = computed(() => openOrder.value.map((id) => stack.value.find((w) => w.id === id)).filter((w): w is WinEntry => !!w))

  // Fenêtre active : la plus avancée qui n’est pas réduite.
  const activeId = computed(() => stack.value.filter((w) => !w.minimized).at(-1)?.id ?? null)

  const find = (id: number) => stack.value.find((w) => w.id === id)
  const zIndexOf = (id: number) => stack.value.findIndex((w) => w.id === id) + 1
  const toFront = (id: number) => {
    const i = stack.value.findIndex((w) => w.id === id)
    if (i >= 0 && i < stack.value.length - 1) stack.value.push(...stack.value.splice(i, 1))
  }

  /** Ouvre une fenêtre au premier plan (sans effet si elle existe déjà). */
  const open = (w: { id: number; title: string; icon: ErrorIcon }) => {
    if (find(w.id)) return
    stack.value.push({ ...w, minimized: false, offset: { x: 0, y: 0 } })
    openOrder.value.push(w.id)
  }
  const close = (id: number) => {
    stack.value = stack.value.filter((w) => w.id !== id)
    openOrder.value = openOrder.value.filter((x) => x !== id)
  }
  /** Passe une fenêtre visible au premier plan (une fenêtre réduite se restaure, pas se « focalise »). */
  const focus = (id: number) => {
    if (find(id)?.minimized === false) toFront(id)
  }
  const minimize = (id: number) => {
    const w = find(id)
    if (w) w.minimized = true
  }
  /** Restaure une fenêtre réduite et la place devant. */
  const restore = (id: number) => {
    const w = find(id)
    if (!w) return
    w.minimized = false
    toFront(id)
  }
  /** Bouton de la barre des tâches : la fenêtre active se réduit, toute autre (réduite ou derrière) se restaure devant. */
  const toggle = (id: number) => {
    if (activeId.value === id) minimize(id)
    else restore(id)
  }
  const setOffset = (id: number, offset: { x: number; y: number }) => {
    const w = find(id)
    if (w) w.offset = { ...offset }
  }
  const clear = () => {
    stack.value = []
    openOrder.value = []
  }

  return { windows, activeId, find, zIndexOf, open, close, focus, minimize, restore, toggle, setOffset, clear }
})
