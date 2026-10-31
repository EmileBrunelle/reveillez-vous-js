<script setup lang="ts">
import { watch } from 'vue'
import { Dialog } from '@vuetify/v0'
import WinDialog from '@/components/WinDialog.vue'
import { aboutClose, aboutOpen } from '@/audio/sfx'
import { REPO_URL } from '@/content/finale'

// v-model du parent = « veut ouvert ». Fenêtre Windows 98 standard (focus, Échap, retour du focus et superposition : voir WinDialog),
// mais fixe : « À propos » ne se déplace pas. Elle apparaît et disparaît d’un coup, comme les autres.
const open = defineModel<boolean>({ default: false })
// Sons d’ouverture et de fermeture ; composant async : il peut se monter alors que le parent veut déjà l’ouvrir.
watch(open, (o) => (o ? aboutOpen() : aboutClose()))
if (open.value) aboutOpen()

const link = 'select-text text-[#0000aa] underline visited:text-[#550055] focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px]'
</script>

<template>
  <WinDialog v-model="open" title="À propos" :draggable="false" content-class="m-auto w-[35.5556rem] bottom-[var(--taskbar-h)]" window-class="overflow-y-auto">
    <div class="p-4 select-text">
      <Dialog.Description as="p" class="[margin:0_0_0.9rem]">
        <strong translate="no">Réveillez-vous.js</strong> : un jeu de voyance où l’on ouvre la porte, se concentre et tire une carte de tarot, pendant que la paranoïa monte.
      </Dialog.Description>
      <p class="[margin:0_0_0.9rem]">Par Émile Brunelle, pour le défi Fortune.js de l’AGEEI (UQAM), 2026.</p>
      <p class="[margin:0_0_0.9rem]">
        <a :class="link" :href="REPO_URL" target="_blank" rel="noopener noreferrer">Code source</a>
      </p>
      <p class="[margin:0_0_0.9rem]">Ce projet a été écrit avec l’aide de l’IA (Claude Code, d’Anthropic) ; la déclaration complète se trouve dans le README du code source.</p>
      <p class="m-0">
        Icônes :
        <a :class="link" href="https://game-icons.net" target="_blank" rel="noopener noreferrer">game-icons.net</a>
        (CC BY 3.0). Polices : VT323, IM Fell English et Cinzel (SIL OFL 1.1).
      </p>
    </div>
  </WinDialog>
</template>
