<script setup lang="ts">
import { useWindowsStore } from '@/stores/windows'
import WinIcon from './WinIcon.vue'

// Un bouton Windows 98 par fenêtre non modale ouverte (les fausses erreurs). Il apparaît et disparaît avec sa fenêtre, d’un coup (exception Windows 98).
// Le bouton de la fenêtre active est enfoncé ; un clic la réduit (si elle est active) ou la restaure devant (sinon).
// Les boutons se partagent la zone (flex-1, 160 px au plus) : le titre se tronque d’abord, puis, à la largeur minimale de 44 px (zone de toucher), il ne reste que l’icône.
// La zone rétrécit et coupe (min-w-0 + overflow-hidden) plutôt que de pousser la zone de notification hors de l’écran ;
// p/-m : la zone de toucher de 44 px des boutons tient dans la zone coupée.
const windows = useWindowsStore()
const pressed = 'shadow-[inset_-1px_-1px_#fff,inset_1px_1px_#0a0a0a,inset_-2px_-2px_#dfdfdf,inset_2px_2px_grey] font-bold'
</script>

<template>
  <div class="taskbar-windows flex flex-1 min-w-0 items-stretch gap-1 overflow-hidden -m-[2px] p-[2px]">
    <button
      v-for="w in windows.windows"
      :key="w.id"
      :data-win-btn="w.id"
      class="win-btn relative before:content-[''] before:absolute before:-inset-[2px] flex items-center gap-[0.35rem] min-h-10 min-w-11 px-2.5 py-0 border-0 [font:inherit] flex-1 basis-0 max-w-40 focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-5px]"
      :class="w.id === windows.activeId ? pressed : ''"
      type="button"
      :aria-label="w.title"
      :aria-pressed="w.id === windows.activeId"
      :title="w.title"
      @click="windows.toggle(w.id)"
    >
      <WinIcon :icon="w.icon" small />
      <span class="min-w-0 truncate">{{ w.title }}</span>
    </button>
  </div>
</template>
