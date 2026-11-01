<script setup lang="ts">
import { computed } from 'vue'
import { lookFor } from '@/engine/doorLook'

/**
 * Ancre la porte dans le décor, en calques statiques (dégradés CSS, aucun filtre, aucun coût par image) :
 * - `sol` (sous la porte) : ombre de contact serrée au pied et ombre portée étirée à l’opposé de la lumière ;
 * - `brume` (par-dessus) : voile de brume assorti au fond, qui mange le bas de la porte.
 */
const { doorId, layer } = defineProps<{ doorId: string; layer: 'sol' | 'brume' }>()
const look = computed(() => lookFor(doorId))
const style = computed(() => ({ '--fog': look.value.fog, '--contact': look.value.contact, '--cast': look.value.cast }))
</script>

<template>
  <div v-if="layer === 'sol'" class="absolute inset-0 pointer-events-none" :style="style" aria-hidden="true">
    <!-- Ombre portée : large, douce, décalée côté ombre. -->
    <div
      class="absolute bottom-[-3.2%] h-[8%] w-[130%] left-[-15%] [translate:calc(var(--cast)*9%)_0] [background:radial-gradient(ellipse_at_50%_50%,rgb(0_0_0/calc(var(--contact)*0.55)),rgb(0_0_0/0)_70%)] blur-[3px]"
    />
    <!-- Ombre de contact : fine et sombre, juste sous le seuil. -->
    <div class="absolute bottom-[-1.4%] h-[3.4%] w-[104%] left-[-2%] [background:radial-gradient(ellipse_at_50%_50%,rgb(0_0_0/var(--contact)),rgb(0_0_0/0)_72%)]" />
  </div>
  <div
    v-else
    class="absolute inset-x-[-6%] bottom-[-4%] h-[20%] pointer-events-none [background:linear-gradient(to_top,rgb(from_var(--fog)_r_g_b/0.34),rgb(from_var(--fog)_r_g_b/0.1)_50%,rgb(from_var(--fog)_r_g_b/0))] [mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)]"
    :style="style"
    aria-hidden="true"
  />
</template>
