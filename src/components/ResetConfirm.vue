<script setup lang="ts">
import { useTemplateRef, type ComponentPublicInstance } from 'vue'
import { AlertDialog } from '@vuetify/v0'
import { useDialogFocus } from '../composables/useDialogFocus'

// v-model du parent = « veut ouvert ». AlertDialog de v0 (<dialog> natif, role="alertdialog") : piège à focus et arrière-plan inerte sont gratuits.
const open = defineModel<boolean>({ default: false })
// Échap annule comme avant : AlertDialog l’ignore par défaut, d’où `close-on-escape` sur le contenu.
const emit = defineEmits<{ confirm: [] }>()
const cancelBtn = useTemplateRef<ComponentPublicInstance>('cancelBtn') // AlertDialog.Cancel : l’élément est `$el`
// Focus initial sur « Annuler » (choix sûr), sans anneau à la souris ; restauré au déclencheur à la fermeture.
const { restore } = useDialogFocus(open, () => cancelBtn.value?.$el)

const btn =
  'select-none touch-manipulation [font:inherit] cursor-pointer text-black border-2 border-solid border-black focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px] py-[0.4rem] px-4'
</script>

<template>
  <AlertDialog.Root v-model="open">
    <AlertDialog.Content
      close-on-escape
      class="m-auto p-0 w-[26rem] max-w-[calc(100vw-1rem-var(--safe-l)-var(--safe-r))] max-h-[calc(100dvh-1rem-var(--safe-t)-var(--safe-b))] top-[var(--safe-t)] right-[var(--safe-r)] bottom-[var(--safe-b)] left-[var(--safe-l)] bg-white text-[#0000aa] border-4 border-solid border-[#0000aa] font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:rgb(0_0_170/0.75)] animate-[reset-in_0.2s_ease-out] motion-reduce:animate-none"
      @close="restore"
    >
      <div class="bg-[#0000aa] text-white py-1 px-2 select-none">
        <AlertDialog.Title class="m-0 text-[1rem] font-bold">Tout oublier ?</AlertDialog.Title>
      </div>
      <div class="p-4">
        <AlertDialog.Description as="p" class="[margin:0_0_1.2rem]">La voyance oubliera votre visage et vos visites. Le niveau de vigilance revient à 1.</AlertDialog.Description>
        <div class="flex flex-wrap gap-3 justify-end">
          <AlertDialog.Cancel ref="cancelBtn" :class="`${btn} bg-[#ffff55]`">Annuler</AlertDialog.Cancel>
          <AlertDialog.Action :class="`${btn} bg-[#aaaaaa]`" @action="emit('confirm')">Oublier</AlertDialog.Action>
        </div>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Root>
</template>
