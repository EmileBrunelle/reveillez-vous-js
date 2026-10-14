<script setup lang="ts">
import TarotEmblem from './TarotEmblem.vue'
</script>

<!-- Substitut de TarotCard pendant le chargement : le dos de la carte, même boîte (7:12, mêmes dimensions) pour que rien ne bouge au remplacement. -->
<template>
  <div class="back relative aspect-[7/12]" aria-hidden="true">
    <div class="back__face absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_#1f1038]">
      <div class="absolute inset-[3cqw] [border:0.8cqw_solid_#b9821a] [outline:0.5cqw_solid_#f3e3b3] [outline-offset:-2.4cqw] grid place-items-center">
        <TarotEmblem class="back__eye [color:#b9821a] [background:#3a1f66] rounded-[50%] p-[6cqw] [border:0.8cqw_solid_#b9821a]" symbole="eye" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.back {
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
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
