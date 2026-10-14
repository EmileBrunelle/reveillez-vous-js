<script setup lang="ts">
import TarotEmblem from './TarotEmblem.vue'

// fill : prend toute la largeur de son parent (cartes de l’éventail, dos de TarotCard) au lieu de s’ajuster à l’emplacement 7:12.
defineProps<{ fill?: boolean }>()
</script>

<!-- Dos de la carte : substitut de TarotCard pendant le chargement (même boîte 7:12), et visuel partagé par le dos de TarotCard et les cartes de DeckCut. -->
<template>
  <div class="back relative aspect-[7/12]" :class="{ 'back--fill': fill }" aria-hidden="true">
    <div class="back__face absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_#1f1038]">
      <div class="absolute inset-[3cqw] [border:0.8cqw_solid_#b9821a] [outline:0.5cqw_solid_#f3e3b3] [outline-offset:-2.4cqw] grid place-items-center">
        <TarotEmblem class="back__eye [color:#b9821a] [background:#3a1f66] rounded-[50%] p-[6cqw] [border:0.8cqw_solid_#b9821a]" symbole="eye" />
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.back {
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
}
.back--fill {
  width: 100%;
}
.back__face {
  background:
    repeating-linear-gradient(45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw), repeating-linear-gradient(-45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw), #3a1f66;
}
.back__eye {
  width: 52cqw;
  height: 52cqw;
}
</style>
