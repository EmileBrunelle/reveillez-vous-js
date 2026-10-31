<script setup lang="ts">
import { useId } from 'vue'
import WinDialog from './WinDialog.vue'
import { previewEffects } from '@/audio/sfx'
import { useAudioStore, type VolumeKey } from '@/stores/audio'

// v-model du parent = « veut ouvert » (fenêtre, focus et fermeture : voir WinDialog).
const open = defineModel<boolean>({ default: false })
const uid = useId()

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
</script>

<template>
  <WinDialog v-model="open" title="Son" content-class="m-auto w-[24rem] bottom-[var(--taskbar-h)]" window-class="overflow-y-auto">
    <div class="flex flex-col gap-3 px-3 pt-3 pb-4">
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
    </div>
    <template #actions="{ btn }">
      <button :class="btn" type="button" @click="audio.resetVolumes">Valeurs par défaut</button>
    </template>
  </WinDialog>
</template>
