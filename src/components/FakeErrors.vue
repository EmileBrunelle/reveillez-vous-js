<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import FakeErrorWindow from '@/components/FakeErrorWindow.vue'
import { useEventListener, useMediaQuery, useTimeoutFn } from '@vueuse/core'
import { prophecies } from '@/content/prophecies'
import { nextFakeError, type ErrorIcon } from '@/engine/prophecy'
import type { ParanoiaLevel } from '@/engine/paranoia'
import { secureRng } from '@/engine/rng'
import { intersects, pickFreeSlot, type Box } from '@/engine/freeZones'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useFreeZones } from '@/composables/useFreeZones'
import { safeStorage } from '@/composables/safeStorage'

// Fausses fenêtres d’erreur Windows 98, purement décoratives (niveau 3+, bureau seulement). Elles n’apparaissent que dans les zones libres,
// mesurées à l’exécution : jamais sur la carte, la porte, un bouton de l’interface ni la barre des tâches.
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

const boxOfWin = (w: Win): Box => ({ left: w.x, top: w.y, right: w.x + WIDTH, bottom: w.y + w.h })

// Fenêtres déjà placées (les autres sont invisibles et n’occupent aucun emplacement).
const placed = () => wins.value.filter((w) => w.ready)
const heightOf = (w: Win) => rootEl.value?.querySelector<HTMLElement>(`[data-id="${w.id}"]`)?.offsetHeight ?? w.h

// Rendue d’abord invisible (visibility:hidden, hors des zones) : on mesure sa vraie hauteur, puis on la place là où elle tient vraiment.
const spawn = async () => {
  if (!desktop.value) return
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
  settle.start() // la carte ou la colonne a pu bouger depuis la mesure : on revérifie peu après
}
// Retour du focus à la fermeture d’une fenêtre (voir useFocusReturn).
const rootEl = useTemplateRef<HTMLElement>('rootEl')
const closeWith = useFocusReturn(rootEl, () => rootEl.value?.querySelector<HTMLButtonElement>('button[aria-label="Fermer la fausse erreur"]') ?? undefined)
const close = (id: number) => closeWith(() => (wins.value = wins.value.filter((w) => w.id !== id)))

// Une fenêtre qui se retrouve sur quelque chose (redimensionnement, carte qui change) disparaît.
const recheck = () => {
  if (!desktop.value) {
    wins.value = []
    return
  }
  const avoid = avoidBoxes()
  const a = area()
  wins.value = wins.value.filter((w) => {
    if (!w.ready) return true
    w.h = heightOf(w) // le texte a pu changer de hauteur (police chargée, zoom)
    // Si le bas dépasse la zone sûre (barre des tâches), on remonte la fenêtre au lieu de la perdre.
    w.y = Math.max(a.top, Math.min(w.y, a.bottom - w.h - 8))
    const b = boxOfWin(w)
    return b.right <= a.right && b.bottom <= a.bottom && !avoid.some((x) => intersects(b, x, 4)) && !placed().some((o) => o.id < w.id && intersects(b, boxOfWin(o)))
  })
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
