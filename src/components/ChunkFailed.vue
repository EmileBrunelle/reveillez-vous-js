<script setup lang="ts">
// Repli d’un chunk qui n’a pas pu se charger (après les essais automatiques) : la partie ne reste jamais bloquée.
// « Réessayer » relance le chargement ; « Passer » (si la scène sait être sautée) laisse la partie continuer sans elle.
defineProps<{ skippable?: boolean }>()
defineEmits<{ retry: []; skip: [] }>()
</script>

<template>
  <div class="grid gap-3 justify-items-center text-center" role="alert">
    <p class="m-0">Le chargement a échoué. Vérifiez la connexion, puis réessayez.</p>
    <div class="flex flex-wrap gap-3 justify-center">
      <button class="btn-alt" type="button" @click="$emit('retry')">Réessayer</button>
      <button v-if="skippable" class="btn-alt" type="button" @click="$emit('skip')">Passer</button>
    </div>
  </div>
</template>
