<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useEventListener, useMediaQuery, useTemplateRefsList, useTimeoutFn } from '@vueuse/core'
import { prophecies } from '../content/prophecies'
import { nextFakeError, type ErrorIcon } from '../engine/prophecy'
import { secureRng } from '../engine/rng'
import { intersects, pickFreeSlot, type Box } from '../engine/freeZones'
import { useFocusReturn } from '../composables/useFocusReturn'
import { useFreeZones } from '../composables/useFreeZones'
import { safeStorage } from '../composables/safeStorage'

// Fausses fenêtres d’erreur Windows 98, purement décoratives (niveau 3+, bureau seulement). Elles n’apparaissent que dans les zones libres,
// mesurées à l’exécution : jamais sur la carte, la porte, un bouton de l’interface ni la barre des tâches.
const { level } = defineProps<{ level: number }>()

interface Win {
  id: number
  title: string
  text: string
  icon: ErrorIcon
  buttons: string[]
  x: number
  y: number
}
const WIDTH = 288
const HEIGHT = 176
const rng = secureRng()
const wins = ref<Win[]>([])
const seen = new Set<string>() // messages déjà affichés pendant cette visite : jamais deux fois le même
// Icône Windows 98 : disque rouge (×), triangle jaune (!), bulle bleue (i) ou point d’interrogation (?). Classes en littéraux complets (scanner UnoCSS).
const ICON: Record<ErrorIcon, { glyph: string; cls: string }> = {
  stop: { glyph: '×', cls: 'rounded-full bg-[#c00] text-white' },
  warn: { glyph: '!', cls: 'bg-[#ffd800] text-black [clip-path:polygon(50%_0,100%_100%,0_100%)] pt-2' },
  info: { glyph: 'i', cls: 'rounded-full bg-[#0000a8] text-white' },
  question: { glyph: '?', cls: 'rounded-full bg-[#0000a8] text-white' },
}
let nextId = 1
const desktop = useMediaQuery('(min-width: 641px)')
const { avoidBoxes, area } = useFreeZones(() => recheck())

const boxOfWin = (w: Win): Box => ({ left: w.x, top: w.y, right: w.x + WIDTH, bottom: w.y + HEIGHT })

const spawn = () => {
  if (!desktop.value) return
  const line = nextFakeError(prophecies, level, safeStorage(), rng, seen)
  if (!line) return
  const slot = pickFreeSlot(area(), WIDTH, HEIGHT, [...avoidBoxes(), ...wins.value.map(boxOfWin)], rng)
  if (slot) {
    wins.value.push({ id: nextId++, ...line, ...slot })
    settle.start() // la carte ou la colonne a pu bouger depuis la mesure : on revérifie peu après
  }
}
// Retour du focus à la fermeture d’une fenêtre (voir useFocusReturn).
const rootEl = useTemplateRef<HTMLElement>('rootEl')
const closeBtns = useTemplateRefsList<HTMLButtonElement>()
const closeWith = useFocusReturn(rootEl, () => closeBtns.value[0])
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
    const b = boxOfWin(w)
    return b.right <= a.right && b.bottom <= a.bottom && !avoid.some((x) => intersects(b, x, 4))
  })
}
useEventListener(window, 'resize', recheck)
const settle = useTimeoutFn(recheck, 700, { immediate: false })
const count = level >= 5 ? 3 : level === 4 ? 1 + Math.floor(rng() * 2) : 1
Array.from({ length: level >= 3 ? count : 0 }, (_, i) => useTimeoutFn(spawn, 3500 + i * 2500))
</script>

<template>
  <div ref="rootEl" class="fake-errors fixed inset-0 z-[15] pointer-events-none">
    <div
      v-for="w in wins"
      :key="w.id"
      class="fake-error win-window absolute pointer-events-auto text-[0.9rem] [font-family:inherit] motion-safe:animate-[fake-in_0.25s_ease-out_both]"
      :style="{ left: `${w.x}px`, top: `${w.y}px`, width: `${WIDTH}px` }"
      role="group"
      :aria-label="`Fausse erreur : ${w.title}`"
    >
      <div class="flex items-center justify-between gap-2 px-[3px] min-h-6 text-white font-bold bg-gradient-to-r from-[#000080] to-[#1084d0]">
        <span class="truncate">{{ w.title }}</span>
        <button
          :ref="closeBtns.set"
          class="win-btn grid place-items-center min-w-6 min-h-6 p-0 leading-none border-0 text-[1rem]"
          type="button"
          aria-label="Fermer la fausse erreur"
          @click="close(w.id)"
        >
          ×
        </button>
      </div>
      <div class="flex items-start gap-3 px-3 pt-4 pb-3">
        <span class="flex-none grid place-items-center w-8 h-8 font-bold text-[1.2rem] leading-none" :class="ICON[w.icon].cls" aria-hidden="true">{{ ICON[w.icon].glyph }}</span>
        <p class="m-0 text-black">{{ w.text }}</p>
      </div>
      <div class="flex justify-center gap-2 pb-2">
        <button
          v-for="b in w.buttons"
          :key="b"
          class="win-btn min-w-[4.5rem] px-2 min-h-[1.75rem] border-0 [font:inherit] focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-5px]"
          type="button"
          @click="close(w.id)"
        >
          {{ b }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fake-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
