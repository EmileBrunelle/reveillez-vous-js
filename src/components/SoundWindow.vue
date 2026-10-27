<script setup lang="ts">
import { useId, useTemplateRef, type ComponentPublicInstance } from 'vue'
import { unrefElement } from '@vueuse/core'
import { Dialog } from '@vuetify/v0'
import { useDialogFocus } from '../composables/useDialogFocus'
import { previewEffects } from '../audio/sfx'
import { useAudioStore, type VolumeKey } from '../stores/audio'

// v-model du parent = « veut ouvert ». Dialog de v0 (<dialog> natif) : Échap, piège à focus et arrière-plan inerte sont gratuits.
const open = defineModel<boolean>({ default: false })
// Clic sur le fond = fermeture : défaut de v0 (`closeOnClickOutside`), gardé exprès, comme À propos.
const uid = useId()
const closeBtn = useTemplateRef<ComponentPublicInstance>('closeBtn') // Dialog.Close n’expose pas `element` (seul Atom le fait) : unrefElement donne l’élément
const { restore } = useDialogFocus(open, () => unrefElement(closeBtn))

const sliders: { key: VolumeKey; label: string }[] = [
  { key: 'general', label: 'Volume général' },
  { key: 'ambiance', label: 'Ambiance' },
  { key: 'effets', label: 'Effets' },
  { key: 'finale', label: 'Finale' },
]
const audio = useAudioStore()
const percent = (key: VolumeKey) => Math.round(audio.volumes[key] * 100)
const onInput = (key: VolumeKey, e: Event) => audio.setVolume(key, Number((e.target as HTMLInputElement).value) / 100)
// « change » part au relâchement du curseur (souris, toucher, ou une touche du clavier) : un aperçu pour les effets seulement.
const onChange = (key: VolumeKey) => key === 'effets' && previewEffects()

const focusRing = 'focus-visible:[outline:2px_dotted_#000] focus-visible:outline-offset-[-4px]'
const btn = `win-btn select-none touch-manipulation [font:inherit] border-0 min-h-8 px-4 ${focusRing}`
</script>

<template>
  <Dialog.Root v-model="open">
    <Dialog.Content
      class="m-auto p-0 w-[24rem] max-w-[calc(100vw-1rem-var(--safe-l)-var(--safe-r))] max-h-[calc(100dvh-var(--taskbar-h)-var(--safe-t)-1rem)] top-[var(--safe-t)] right-[var(--safe-r)] bottom-[var(--taskbar-h)] left-[var(--safe-l)] overflow-hidden bg-transparent border-0 text-black font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:rgb(0_0_0/0.55)]"
      @close="restore"
    >
      <div class="win-window flex flex-col max-h-[calc(100dvh-var(--taskbar-h)-var(--safe-t)-1rem)] overflow-y-auto">
        <div class="flex items-center justify-between gap-2 bg-[#000080] text-white py-[2px] px-2 select-none">
          <Dialog.Title class="m-0 text-[1rem] font-bold">Son</Dialog.Title>
          <Dialog.Close class="win-btn border-0 min-w-6 h-6 p-0 [font:inherit] font-bold leading-none" :class="focusRing">×</Dialog.Close>
        </div>
        <div class="flex flex-col gap-3 p-3">
          <div v-for="s in sliders" :key="s.key" class="flex flex-col gap-1">
            <div class="flex justify-between gap-2">
              <label :for="`${uid}-volume-${s.key}`">{{ s.label }}</label>
              <output :for="`${uid}-volume-${s.key}`" class="tabular-nums">{{ percent(s.key) }} %</output>
            </div>
            <input
              :id="`${uid}-volume-${s.key}`"
              type="range"
              min="0"
              max="100"
              step="1"
              class="w-full m-0 accent-[#000080] min-h-6"
              :class="focusRing"
              :value="percent(s.key)"
              :aria-valuetext="`${percent(s.key)} %`"
              @input="onInput(s.key, $event)"
              @change="onChange(s.key)"
            />
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button :class="btn" type="button" @click="audio.resetVolumes">Valeurs par défaut</button>
            <Dialog.Close ref="closeBtn" :class="btn">Fermer</Dialog.Close>
          </div>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
</template>
