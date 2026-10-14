<script setup lang="ts">
import { nextTick, onMounted } from 'vue'

// Substitut provisoire : la coupe du paquet sera remplacée par un vrai composant. Choisit tout de suite la première carte.
defineProps<{ level: number }>()
const emit = defineEmits<{ pick: [index: 0 | 1 | 2] }>()
onMounted(() => void nextTick(() => emit('pick', 0)))
</script>

<template>
  <div aria-hidden="true" />
</template>
