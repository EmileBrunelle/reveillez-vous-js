<script setup lang="ts">
import TarotEmblem from './TarotEmblem.vue'
import type { Paquet } from '../engine/paquets'

// fill : prend toute la largeur de son parent (cartes de l’éventail, dos de TarotCard) au lieu de s’ajuster à l’emplacement 7:12.
// paquet : le dos du paquet (couleur, motif, emblème) ; la nuit sert aussi de substitut pendant le chargement.
const { paquet = 'nuit' } = defineProps<{ fill?: boolean; paquet?: Paquet }>()
const EMBLEMS: Record<Paquet, string> = { nuit: 'moon', feu: 'flame', brume: 'ghost' }
</script>

<!-- Dos de la carte : substitut de TarotCard pendant le chargement (même boîte 7:12), et visuel partagé par le dos de TarotCard et les cartes de DeckCut. -->
<template>
  <div class="back relative aspect-[7/12]" :class="[{ 'back--fill': fill }, `back--${paquet}`]" aria-hidden="true">
    <div class="back__face absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_#1f1038]">
      <div class="back__frame absolute inset-[3cqw] grid place-items-center">
        <TarotEmblem class="back__eye rounded-[50%] p-[6cqw]" :symbole="EMBLEMS[paquet]" />
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.back {
  --back-bg: #3a1f66;
  --back-line: rgb(185 130 26 / 0.35);
  --back-accent: #b9821a;
  --back-eye: #3a1f66;
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
}
.back--fill {
  width: 100%;
}
.back__face {
  background: repeating-linear-gradient(45deg, transparent 0 3cqw, var(--back-line) 3cqw 3.6cqw), repeating-linear-gradient(-45deg, transparent 0 3cqw, var(--back-line) 3cqw 3.6cqw), var(--back-bg);
}
.back__frame {
  border: 0.8cqw solid var(--back-accent);
  outline: 0.5cqw solid #f3e3b3;
  outline-offset: -2.4cqw;
}
.back__eye {
  width: 52cqw;
  height: 52cqw;
  color: var(--back-accent);
  background: var(--back-eye);
  border: 0.8cqw solid var(--back-accent);
}
/* Feu : braise, flammes en lignes verticales qui montent. */
.back--feu {
  --back-bg: #5c1511;
  --back-line: rgb(240 130 50 / 0.38);
  --back-accent: #e58a2e;
  --back-eye: #3a0b0a;
}
.back--feu .back__face {
  background:
    radial-gradient(ellipse 60% 40% at 50% 112%, rgb(255 140 40 / 0.55), transparent 70%), repeating-linear-gradient(90deg, transparent 0 2.6cqw, var(--back-line) 2.6cqw 3.2cqw),
    repeating-linear-gradient(0deg, transparent 0 5cqw, rgb(0 0 0 / 0.25) 5cqw 5.6cqw), var(--back-bg);
}
/* Brume : bandes horizontales de brouillard et branchages en diagonale. */
.back--brume {
  --back-bg: #15473f;
  --back-line: rgb(150 220 195 / 0.3);
  --back-accent: #8fd1b6;
  --back-eye: #0c2b26;
}
.back--brume .back__face {
  background:
    radial-gradient(ellipse 80% 30% at 30% 30%, rgb(200 240 225 / 0.22), transparent 70%), radial-gradient(ellipse 80% 30% at 70% 75%, rgb(200 240 225 / 0.18), transparent 70%),
    repeating-linear-gradient(0deg, transparent 0 4cqw, var(--back-line) 4cqw 4.5cqw), repeating-linear-gradient(60deg, transparent 0 9cqw, rgb(10 40 34 / 0.45) 9cqw 9.6cqw), var(--back-bg);
}
</style>
