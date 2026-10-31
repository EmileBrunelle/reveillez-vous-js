<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useEventListener, useMediaQuery, useTemplateRefsList, useTimeoutFn } from '@vueuse/core'
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

const boxOfWin = (w: Win): Box => ({ left: w.x, top: w.y, right: w.x + WIDTH, bottom: w.y + w.h })

// Fenêtres déjà placées (les autres sont invisibles et n’occupent aucun emplacement).
const placed = () => wins.value.filter((w) => w.ready)
const winEls = useTemplateRefsList<HTMLElement>()
const heightOf = (w: Win) => winEls.value.find((el) => el.dataset.id === String(w.id))?.offsetHeight ?? w.h

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
    <div
      v-for="w in wins"
      :key="w.id"
      :ref="winEls.set"
      :data-id="w.id"
      class="fake-error win-window absolute pointer-events-auto text-[0.9rem] [font-family:inherit]"
      :class="w.ready ? 'motion-safe:animate-[fake-in_0.25s_ease-out_both]' : 'invisible pointer-events-none'"
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
