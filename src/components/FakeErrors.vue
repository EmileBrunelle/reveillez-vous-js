<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import FakeErrorWindow from '@/components/FakeErrorWindow.vue'
import { tryOnScopeDispose, useEventListener, useMediaQuery, useTimeoutFn } from '@vueuse/core'
import { prophecies } from '@/content/prophecies'
import { nextFakeError, type ErrorIcon } from '@/engine/prophecy'
import type { ParanoiaLevel } from '@/engine/paranoia'
import { secureRng } from '@/engine/rng'
import { intersects, pickFreeSlot, type Box } from '@/engine/freeZones'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useFreeZones } from '@/composables/useFreeZones'
import { safeStorage } from '@/composables/safeStorage'
import { useWindowsStore } from '@/stores/windows'

// Fausses fenêtres d’erreur Windows 98, purement décoratives (niveau 3+, bureau seulement). Elles n’apparaissent que dans les zones libres,
// mesurées à l’exécution : jamais sur la carte, la porte, un bouton de l’interface ni la barre des tâches.
// Elles sont gérées par le store `windows` (premier plan, réduction, boutons de la barre des tâches) ; ce composant décide seulement quand elles naissent et où.
const { level } = defineProps<{ level: ParanoiaLevel }>()

interface Win {
  id: number
  title: string
  text: string
  icon: ErrorIcon
  buttons: string[]
  x: number
  y: number
  h: number // hauteur réelle mesurée (elle dépend du texte et de la police)
  ready: boolean // false : rendue invisible, le temps de mesurer et de placer
}
const WIDTH = 288
const rng = secureRng()
const wins = ref<Win[]>([])
const seen = new Set<string>() // messages déjà affichés pendant cette visite : jamais deux fois le même
let nextId = 1
const desktop = useMediaQuery('(min-width: 641px)')
const { avoidBoxes, area } = useFreeZones(() => recheck())

const windows = useWindowsStore()
tryOnScopeDispose(windows.clear) // la lecture se termine : plus aucune fenêtre, plus aucun bouton

// Rectangle réel : position de départ + décalage de glissement (connu du store).
const boxOfWin = (w: Win): Box => {
  const { x: dx, y: dy } = windows.find(w.id)?.offset ?? { x: 0, y: 0 }
  return { left: w.x + dx, top: w.y + dy, right: w.x + dx + WIDTH, bottom: w.y + dy + w.h }
}
const moved = (w: Win) => {
  const o = windows.find(w.id)?.offset
  return !!o && (o.x !== 0 || o.y !== 0)
}

// Fenêtres déjà placées (les autres sont invisibles et n’occupent aucun emplacement).
// Une fenêtre réduite n’est pas à l’écran : elle ne compte pas non plus (ni pour placer les suivantes, ni pour en faire disparaître d’autres).
const minimized = (w: Win) => windows.find(w.id)?.minimized ?? false
const placed = () => wins.value.filter((w) => w.ready && !minimized(w))
const heightOf = (w: Win) => rootEl.value?.querySelector<HTMLElement>(`[data-id="${w.id}"]`)?.offsetHeight ?? w.h

// Rendue d’abord invisible (visibility:hidden, hors des zones) : on mesure sa vraie hauteur, puis on la place là où elle tient vraiment.
const MAX_OPEN = 5 // plafond de fenêtres ouvertes en même temps (la barre des tâches doit pouvoir toutes les montrer)
const spawn = async () => {
  if (!desktop.value || wins.value.length >= MAX_OPEN) return
  const line = nextFakeError(prophecies, level, safeStorage(), rng, seen)
  if (!line) return
  const w: Win = { id: nextId++, ...line, x: 0, y: 0, h: 0, ready: false }
  wins.value.push(w)
  await nextTick()
  const h = heightOf(w)
  const slot = h > 0 && desktop.value ? pickFreeSlot(area(), WIDTH, h, [...avoidBoxes(), ...placed().map(boxOfWin)], rng) : null
  const mine = wins.value.find((x) => x.id === w.id) // la réf. du tableau est réactive
  if (!mine) return
  if (!slot) {
    wins.value = wins.value.filter((x) => x.id !== w.id)
    return
  }
  Object.assign(mine, slot, { h, ready: true })
  windows.open({ id: w.id, title: w.title, icon: w.icon })
  settle.start() // la carte ou la colonne a pu bouger depuis la mesure : on revérifie peu après
}
// Retour du focus à la fermeture d’une fenêtre (voir useFocusReturn).
const rootEl = useTemplateRef<HTMLElement>('rootEl')
// Fenêtre suivante : la croix d’une fenêtre visible (une fenêtre réduite est inerte), sinon le bouton d’une fenêtre réduite dans la barre des tâches.
const closeWith = useFocusReturn(
  rootEl,
  () => rootEl.value?.querySelector<HTMLButtonElement>('.fake-error:not([inert]) button[aria-label="Fermer la fausse erreur"]') ?? document.querySelector<HTMLElement>('[data-win-btn]') ?? undefined,
)
const close = (id: number) =>
  closeWith(() => {
    windows.close(id)
    wins.value = wins.value.filter((w) => w.id !== id)
  })

// Une fenêtre qui se retrouve sur quelque chose (redimensionnement, carte qui change) disparaît.
const recheck = () => {
  if (!desktop.value) {
    windows.clear()
    wins.value = []
    return
  }
  const avoid = avoidBoxes()
  const a = area()
  // Une fenêtre que la personne a déplacée reste où elle l’a mise (useWinDrag la borne à l’écran) : ni son ancien emplacement ni le nouveau ne la font disparaître,
  // et elle ne compte pas pour faire disparaître les autres (elles sont comparées entre elles à leur place de départ).
  const resting = () => placed().filter((o) => !moved(o))
  const keep = wins.value.filter((w) => {
    if (!w.ready) return true
    w.h = heightOf(w)
    if (minimized(w)) return true // réduite : invisible, on la garde telle quelle // le texte a pu changer de hauteur (police chargée, zoom)
    if (moved(w)) return true
    // Si le bas dépasse la zone sûre (barre des tâches), on remonte la fenêtre au lieu de la perdre.
    w.y = Math.max(a.top, Math.min(w.y, a.bottom - w.h - 8))
    const b = boxOfWin(w)
    return b.right <= a.right && b.bottom <= a.bottom && !avoid.some((x) => intersects(b, x, 4)) && !resting().some((o) => o.id < w.id && intersects(b, boxOfWin(o)))
  })
  for (const w of wins.value) if (!keep.includes(w)) windows.close(w.id)
  wins.value = keep
}
useEventListener(window, 'resize', recheck)
const settle = useTimeoutFn(recheck, 700, { immediate: false })
const count = level >= 5 ? 3 : level === 4 ? 1 + Math.floor(rng() * 2) : 1
Array.from({ length: level >= 3 ? count : 0 }, (_, i) => useTimeoutFn(spawn, 3500 + i * 2500))
</script>

<template>
  <div ref="rootEl" class="fake-errors fixed inset-0 z-[15] pointer-events-none">
    <FakeErrorWindow
      v-for="w in wins"
      :id="w.id"
      :key="w.id"
      :title="w.title"
      :text="w.text"
      :icon="w.icon"
      :buttons="w.buttons"
      :x="w.x"
      :y="w.y"
      :width="WIDTH"
      :ready="w.ready"
      @close="close(w.id)"
    />
  </div>
</template>
