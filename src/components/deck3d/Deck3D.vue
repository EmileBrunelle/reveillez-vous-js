<script setup lang="ts">
import { ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useGpuEffect } from '@/composables/useGpuEffect'
import { useQuality } from '@/stores/quality'
import { deck3dDpr, deck3dParams, mipCount } from '@/effects/deck3dMath'
import type { Paquet } from '@/engine/paquets'

/**
 * Paquet de cartes en vraie 3D (WebGPU) : pavé aux coins arrondis, dos du dessus texturé, tranche crème lignée, ombre au sol,
 * bords anticrénelés dans le shader. Même pose que le paquet CSS de CardDeck (mêmes degrés, même perspective DECK_PERSP).
 * Le canevas couvre son parent, qui doit valoir DECK3D_FRAME largeurs de la boîte des cartes, centré sur elle.
 * Purement décoratif (`aria-hidden`). Rendu à la demande : une image par changement de pose ou de taille, rien au repos.
 * `coverSlot` : couvercle d’insertion, seules les couches au-dessus de ce rang sont dessinées (même caméra, au pixel près).
 */
const {
  back = 'nuit',
  rx,
  ry,
  y = 0,
  scale,
  coverSlot = null,
  onGpuMs = undefined,
} = defineProps<{
  /** Dos du dessus. */
  back?: Paquet
  /** Inclinaison en degrés (repos + respiration + pointeur, comme CardDeck). */
  rx: number
  ry: number
  /** Décalage vertical (fraction de la largeur de la boîte) : respiration. */
  y?: number
  /** Largeur du paquet en fraction de la boîte (STOW_SCALE au repos). */
  scale: number
  /** Couvercle d’insertion : rang visé ; null = paquet entier. */
  coverSlot?: number | null
  /** Banc d’essai : durée GPU de chaque image (ms). */
  onGpuMs?: (ms: number) => void
}>()

const emit = defineEmits<{ failed: [] }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const { settled } = useQuality()
const dirty = ref(true)
// Chaîne de mips du dos : peinte hors GPU, remplacée (nouvelle référence) quand `back` change.
const chain = shallowRef<readonly HTMLCanvasElement[]>([])
const paint = async (p: Paquet) => {
  const { paintBack, mipChain } = await import('@/effects/deck3dBack')
  const base = await paintBack(p)
  chain.value = mipChain(base, mipCount(base.width, base.height))
  dirty.value = true
}
watch(
  () => back,
  (p) => void paint(p),
)

watch([() => rx, () => ry, () => y, () => scale, () => coverSlot], () => (dirty.value = true))
useResizeObserver(canvas, () => (dirty.value = true))

const { lost } = useGpuEffect(
  canvas,
  async (el, onLost) => {
    const [{ createDeck3d }] = await Promise.all([import('@/effects/deck3d'), paint(back)])
    return createDeck3d(el, {
      params: (width, height) => deck3dParams({ width, height, rx, ry, y, scale, coverSlot, texWidth: chain.value[0]?.width ?? 1 }),
      back: () => chain.value,
      dpr: deck3dDpr(settled.value),
      dirty: () => dirty.value,
      drawn: () => (dirty.value = false),
      resized: () => (dirty.value = true),
      onGpuMs,
      onLost,
    })
  },
  { warning: 'Paquet 3D désactivé :' },
)
watch(lost, (l) => l && emit('failed'))
</script>

<template>
  <canvas v-show="!lost" ref="canvas" class="block w-full h-full select-none pointer-events-none" aria-hidden="true" />
</template>
