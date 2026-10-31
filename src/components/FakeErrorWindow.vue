<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { ErrorIcon } from '@/engine/prophecy'
import WinIcon from '@/components/WinIcon.vue'
import { useWinDrag } from '@/composables/useWinDrag'
import { useWinFlight } from '@/composables/useWinFlight'
import { useWindowsStore } from '@/stores/windows'

// Une fausse fenêtre d’erreur Windows 98 : un composable de glissement par instance (la liste est un v-for).
// Non modale : la racine se déplace par sa barre de titre, n’importe où dans l’écran visible (même sur la carte).
// Client du gestionnaire de fenêtres (stores/windows) : un appui n’importe où la passe au premier plan, `_` la réduit vers la barre des tâches, son z-index vient de l’ordre d’empilement.
const { id, title, text, icon, buttons, x, y, width, ready } = defineProps<{
  id: number
  title: string
  text: string
  icon: ErrorIcon
  buttons: string[]
  x: number
  y: number
  width: number
  ready: boolean
}>()
defineEmits<{ close: [] }>()
const windows = useWindowsStore()
const bar = useTemplateRef<HTMLElement>('bar')
const root = useTemplateRef<HTMLElement>('root')
const minimized = computed(() => windows.find(id)?.minimized ?? false)
const { hidden } = useWinFlight(root, () => id, minimized)
const {
  style: dragStyle,
  offset,
  narrow,
} = useWinDrag(
  bar,
  computed(() => ready),
  (el) => el.closest<HTMLElement>('.fake-error'),
)
// Le décalage de glissement remonte au gestionnaire : le rectangle réel de la fenêtre sert à placer les suivantes (FakeErrors).
watch(offset, (o) => windows.setOffset(id, o))
</script>

<template>
  <div
    ref="root"
    :data-id="id"
    class="fake-error win-window absolute pointer-events-auto text-[0.9rem] [font-family:inherit]"
    :class="[ready ? 'motion-safe:animate-[fake-in_0.25s_ease-out_both]' : 'invisible pointer-events-none', hidden ? 'invisible' : '']"
    :style="[{ left: `${x}px`, top: `${y}px`, width: `${width}px`, zIndex: windows.zIndexOf(id) }, dragStyle]"
    :inert="minimized"
    role="group"
    :aria-label="`Fausse erreur : ${title}`"
    @pointerdown="windows.focus(id)"
    @focusin="windows.focus(id)"
  >
    <div
      ref="bar"
      class="flex items-center justify-between gap-2 px-[3px] min-h-6 text-white font-bold bg-gradient-to-r from-[#000080] to-[#1084d0] select-none"
      :class="narrow ? '' : 'cursor-move touch-none'"
    >
      <span class="truncate">{{ title }}</span>
      <span class="flex gap-[2px]">
        <button
          class="win-btn grid place-items-center min-w-6 min-h-6 p-0 leading-none border-0 text-[1rem] cursor-default"
          type="button"
          aria-label="Réduire la fausse erreur"
          @click="windows.minimize(id)"
        >
          _
        </button>
        <button class="win-btn grid place-items-center min-w-6 min-h-6 p-0 leading-none border-0 text-[1rem] cursor-default" type="button" aria-label="Fermer la fausse erreur" @click="$emit('close')">
          ×
        </button>
      </span>
    </div>
    <div class="flex items-start gap-3 px-3 pt-4 pb-3">
      <WinIcon :icon="icon" />
      <p class="m-0 text-black">{{ text }}</p>
    </div>
    <div class="flex justify-center gap-2 pb-2">
      <button
        v-for="b in buttons"
        :key="b"
        class="win-btn min-w-[4.5rem] px-2 min-h-[1.75rem] border-0 [font:inherit] focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-5px]"
        type="button"
        @click="$emit('close')"
      >
        {{ b }}
      </button>
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
