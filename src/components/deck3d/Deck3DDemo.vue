<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRafFn, useUrlSearchParams } from '@vueuse/core'
import CardDeck from '../CardDeck.vue'
import TarotCardBack from '../TarotCardBack.vue'
import Deck3D from './Deck3D.vue'
import { DECK_PERSP, STOW_SCALE, deckPose } from '@/engine/deckFan'
import { deckSlot, insertPoses } from '@/engine/deckInsert'
import { DECK3D_FRAME } from '@/effects/deck3dMath'
import { isPaquet, type Paquet } from '@/engine/paquets'

/**
 * Page de démonstration temporaire (hors du jeu, jamais importée par l’application) : à gauche le paquet CSS actuel (CardDeck),
 * à droite le paquet vgpu (Deck3D), qui recopie à chaque image la pose écrite par CardDeck (`deckPose`) : même inclinaison, même respiration.
 * Paramètres d’adresse : `back=<nuit|feu|brume>` (paquet vgpu seul ; sinon il reprend le dos tiré par le paquet CSS),
 * `insert=<0..3>` (étape de l’insertion : 0 à côté, 1 couvercle allumé, 2 mi-glissement, 3 rentrée), `only=gpu` (le paquet vgpu seul), `sweep` (inclinaison en mouvement continu, pour le banc d’essai).
 */
const q = useUrlSearchParams('history')
const only = q.only === 'gpu'
const sweep = q.sweep !== undefined
const stage = q.insert === undefined ? null : Number(q.insert)
// Le paquet CSS tire son dos au hasard : le paquet vgpu reprend celui qu’il affiche (classe `back--…`), pour comparer le même dos.
const back = ref<Paquet>(isPaquet(q.back) ? q.back : 'nuit')

const rx = ref(deckPose.rx)
const ry = ref(deckPose.ry)
const y = ref(deckPose.y)
useRafFn(() => {
  const css = document.querySelector('[data-side=css] .back')?.className.match(/back--(nuit|feu|brume)/)?.[1]
  if (isPaquet(css)) back.value = css
  // `sweep` : inclinaison qui balaie en continu (une image par trame, pour le banc d’essai GPU).
  const t = performance.now() / 600
  rx.value = deckPose.rx + (sweep ? 7 * Math.sin(t) : 0)
  ry.value = deckPose.ry + (sweep ? 7 * Math.cos(t) : 0)
  y.value = deckPose.y
})
const gpu = ref<number[]>([])
const record = (ms: number) => {
  gpu.value.push(ms)
  ;(window as unknown as { __deck3dMs?: number[] }).__deck3dMs = gpu.value
}

// Insertion : la carte (ici un dos d’un autre paquet que celui du dessus, en DOM) entre le paquet vgpu et son couvercle ; poses de deckInsert, comme TarotCard.
const box = ref<HTMLElement | null>(null)
const W = ref(300)
useRafFn(() => (W.value = box.value?.offsetWidth ?? W.value))
const card = computed(() => {
  if (stage === null) return null
  const { side, inside } = insertPoses(deckSlot.value, { rx: rx.value, ry: ry.value, y: y.value }, W.value)
  const k = stage <= 1 ? 0 : stage === 2 ? 0.5 : 1
  const x = side.x + (inside.x - side.x) * k
  return {
    transform: `translate(${x}px, ${side.y}px) scale(${side.s}) perspective(${W.value * DECK_PERSP}px) rotateX(${side.rx}deg) rotateY(${side.ry}deg)`,
  }
})
// Démo seulement : ici le paquet CSS ne reçoit pas sa perspective (valeur Motion restée à 0 hors de DeckCut) ; on l’écrit à la main, comme `compose` (largeur × DECK_PERSP).
useRafFn(() => {
  const el = document.querySelector<HTMLElement>('[data-side=css] .deckbox:not(.deckcover) [style*=rotateX]')
  if (el) el.style.transform = `perspective(${el.offsetWidth * DECK_PERSP}px) rotateX(${deckPose.rx}deg) rotateY(${deckPose.ry}deg)`
})
const coverOn = computed(() => stage !== null && stage >= 1)
const frameStyle = { width: `${DECK3D_FRAME * 100}cqw`, height: `${DECK3D_FRAME * 100 * (12 / 7)}cqw` }
</script>

<template>
  <div class="grid grid-cols-2 w-screen h-screen bg-[#1a0f2e]">
    <div v-if="!only" class="grid place-items-center [container-type:size]" data-side="css">
      <CardDeck />
    </div>
    <div class="grid place-items-center [container-type:size]" :class="{ 'col-span-2': only }" data-side="gpu">
      <div ref="box" class="relative aspect-[7/12] w-[min(100cqw,calc(100cqh*7/12))] [container-type:inline-size]">
        <div class="absolute top-1/2 left-1/2 -translate-1/2" :style="frameStyle">
          <Deck3D :back="back" :rx="rx" :ry="ry" :y="y" :scale="STOW_SCALE" :on-gpu-ms="record" />
        </div>
        <div v-if="card" class="absolute top-1/2 left-1/2 w-full -translate-1/2">
          <div class="w-full origin-center" :style="card"><TarotCardBack fill :paquet="back === 'brume' ? 'feu' : 'brume'" /></div>
        </div>
        <div v-show="coverOn" class="absolute top-1/2 left-1/2 -translate-1/2" :style="frameStyle">
          <Deck3D :back="back" :rx="rx" :ry="ry" :y="y" :scale="STOW_SCALE" :cover-slot="deckSlot.value" />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Démo : le paquet CSS est forcé visible (sa respiration et son apparition dépendent de DeckCut) ; la pose reste celle de repos des deux côtés. */
[data-side='css'] .deckbox:not(.deckcover) .deckbox__lift {
  opacity: 1 !important;
}
</style>
