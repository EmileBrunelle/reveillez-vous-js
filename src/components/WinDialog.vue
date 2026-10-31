<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'
import { Dialog } from '@vuetify/v0'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useWinDrag } from '@/composables/useWinDrag'

// Fenêtre modale façon Windows 98 sur Dialog de v0 (<dialog> natif) : Échap, piège à focus et arrière-plan inerte sont gratuits.
// Le parent règle la taille et les marges (`contentClass`) et, au besoin, le défilement de la fenêtre (`windowClass`).
const { title, contentClass = '', windowClass = '', draggable = true } = defineProps<{ title: string; contentClass?: string; windowClass?: string; draggable?: boolean }>()
// v-model du parent = « veut ouvert ». Clic sur le fond = fermeture : défaut de v0 (`closeOnClickOutside`), gardé exprès, comme À propos.
const open = defineModel<boolean>({ default: false })
// Émis après la restitution du focus : le parent fait son propre travail de fermeture.
const emit = defineEmits<{ close: [] }>()
const id = useId()
const titleId = `${id}-title` // convention de Dialog.Root : `${id}-title`
// Dialog.Close en mode renderless : c’est notre <button> qui reçoit ses attributs, donc le ref donne directement l’élément (v0 1.3 n’expose pas `element` sur Dialog.Close).
// Pas d’autofocus natif sur ce bouton : il ferait apparaître l’anneau de focus de Chrome (voir App.vue et focusQuietly), `useDialogFocus` s’en charge.
const closeBtn = useTemplateRef<HTMLButtonElement>('closeBtn')
const { restore } = useDialogFocus(open, () => closeBtn.value)
// Barre de titre = poignée de déplacement ; la position revient au centre à chaque ouverture.
const bar = useTemplateRef<HTMLElement>('bar')
const { style: dragStyle, narrow } = useWinDrag(bar, open, undefined, () => draggable)
const onClose = () => {
  restore()
  emit('close')
}

const focusRing = 'focus-visible:[outline:2px_dotted_#000] focus-visible:outline-offset-[-4px]'
const btn = `win-btn select-none touch-manipulation [font:inherit] border-0 min-h-8 px-4 ${focusRing}`
const base =
  'p-0 max-w-[calc(100vw-1rem-var(--safe-l)-var(--safe-r))] max-h-[calc(100dvh-var(--taskbar-h)-var(--safe-t)-1rem)] top-[var(--safe-t)] right-[var(--safe-r)] left-[var(--safe-l)] overflow-hidden bg-transparent border-0 text-black font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:rgb(0_0_0/0.55)]'
</script>

<template>
  <Dialog.Root :id v-model="open">
    <Dialog.Content :class="[base, contentClass]" :style="dragStyle" @close="onClose">
      <div class="win-window flex flex-col max-h-[calc(100dvh-var(--taskbar-h)-var(--safe-t)-1rem)]" :class="windowClass">
        <div ref="bar" class="flex items-center justify-between gap-2 bg-[#000080] text-white py-[2px] px-2 select-none" :class="narrow || !draggable ? '' : 'cursor-move touch-none'">
          <Dialog.Title class="m-0 text-[1rem] font-bold">{{ title }}</Dialog.Title>
          <Dialog.Close class="win-btn border-0 min-w-6 h-6 p-0 [font:inherit] font-bold leading-none" :class="focusRing">×</Dialog.Close>
        </div>
        <slot :title-id="titleId" />
        <div class="px-3 pb-3 flex justify-end gap-2">
          <slot name="actions" :btn="btn" />
          <Dialog.Close v-slot="{ attrs }" renderless>
            <button ref="closeBtn" v-bind="attrs" :class="btn">Fermer</button>
          </Dialog.Close>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
</template>
