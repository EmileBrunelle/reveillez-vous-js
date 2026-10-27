<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useParallax } from '@vueuse/core'
import { useGpuEffect } from '../../composables/useGpuEffect'
import { usePlaceAudio } from '../../composables/usePlaceAudio'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { useProgressStore } from '../../stores/progress'
import { placeLoaders, type PlaceId } from '../../effects/places'

const { place, variant = undefined, sharp } = defineProps<{ place: PlaceId; variant?: Record<string, number>; sharp?: boolean }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const reducedMotion = useReducedMotion()
// Le niveau de paranoïa (0..1) vient directement du store de progression, lu à chaque image par les paramètres du shader.
const root = useTemplateRef<HTMLElement>('root')
const { tilt, roll, source } = useParallax(root)
// Souris : tilt/roll sont déjà dans [-0.5, 0.5] autour du centre, donc x2 donne [-1, 1].
// Téléphone : tilt/roll sont des angles absolus/90 (un téléphone tenu en lecture est loin de 0) : on soustrait une
// base lente (tau ~4 s, comme useTilt) et on sature à ~±15 deg : seuls les gestes comptent, la scène se recentre à l’arrêt.
const TAU = 4
const RANGE = 15 / 90
let base = { x: 0, y: 0 }
let lastSource = ''
let lastT = 0
const clamp1 = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)
const parallax = () => {
  const x = tilt.value
  const y = roll.value
  if (source.value === 'mouse') return { x: clamp1(x * 2), y: clamp1(y * 2) }
  const now = performance.now()
  if (lastSource !== 'deviceOrientation' || now - lastT > 1000) base = { x, y } // première lecture (ou reprise) : pas de saut
  const k = 1 - Math.exp(-Math.min((now - lastT) / 1000, 1) / TAU)
  lastSource = 'deviceOrientation'
  lastT = now
  base = { x: base.x + (x - base.x) * k, y: base.y + (y - base.y) * k }
  return { x: clamp1((x - base.x) / RANGE), y: clamp1((y - base.y) / RANGE) }
}
const progress = useProgressStore()
const paranoia = () => progress.paranoia
usePlaceAudio(
  () => place,
  () => progress.level,
)
const { lost: failed } = useGpuEffect(
  canvas,
  async (el, onLost) => {
    const [{ createRaymarch }, cfg] = await Promise.all([import('../../effects/raymarch'), placeLoaders[place]()])
    return createRaymarch(el, {
      shader: cfg.shader,
      params: (st) => cfg.params({ ...st, variant }),
      motion: () => !reducedMotion.value,
      sharp: () => sharp ?? false,
      paranoia,
      parallax,
      onLost,
    })
  },
  { warning: 'Décor de lieu désactivé :' },
)
</script>

<template>
  <div ref="root" class="fixed inset-0 z-0 pointer-events-none place" aria-hidden="true">
    <canvas v-show="!failed" ref="canvas" class="absolute inset-0 w-full h-full select-none" />
  </div>
</template>

<style scoped>
/* Secours si le pipeline échoue : simple dégradé de nuit sombre. */
.place {
  background: radial-gradient(ellipse at 70% 20%, #2a3350 0, transparent 30%), linear-gradient(#070a14, #141c26 70%, #05070b);
}
</style>
