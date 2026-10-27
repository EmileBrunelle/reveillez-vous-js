<script setup lang="ts">
import { useTemplateRef } from 'vue'

// Repli d’un chunk qui n’a pas pu se charger : la partie ne reste jamais bloquée.
// « Réessayer » recharge la page (voir lazyScene) ; « Passer » (si la scène sait être sautée) laisse la partie continuer sans elle.
defineProps<{ skippable?: boolean }>()
defineEmits<{ retry: []; skip: [] }>()

const retryBtn = useTemplateRef<HTMLButtonElement>('retryBtn')
// role="alert" annonce le message mais ne déplace pas le focus : l’écran précédent est parti, on le pose sur le premier bouton.
defineExpose({ focus: () => retryBtn.value?.focus() })
</script>

<template>
  <div class="grid gap-3 justify-items-center text-center" role="alert">
    <p class="m-0">Le chargement a échoué. Vérifiez la connexion, puis réessayez.</p>
    <div class="flex flex-wrap gap-3 justify-center">
      <button ref="retryBtn" class="btn-alt" type="button" @click="$emit('retry')">Réessayer</button>
      <button v-if="skippable" class="btn-alt" type="button" @click="$emit('skip')">Passer</button>
    </div>
  </div>
</template>
