<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useMediaQuery, useResizeObserver } from '@vueuse/core'
import { useGpuEffect } from '@/composables/useGpuEffect'
import { SHADOWS_OFF_MEDIA } from '@/effects/shadowQuality'
import { createKnockSpring, door3dParams, DOOR3D_PRESETS, type Door3dLight } from '@/effects/door3dMath'
import type { PlaceId } from '@/effects/places/types'

/**
 * Porte de lieu en vraie 3D (WebGPU, raymarching) : battant à panneaux qui pivote sur ses charnières, lumière et ombres du lieu.
 * Purement décoratif (`aria-hidden`) : le bouton « Cogner à la porte » reste à l’appelant, par-dessus.
 * Rendu à la demande : aucune boucle au repos, une image par changement (angle, coup, lumière, taille).
 */
const {
  variant,
  angle = 0,
  knock = 0,
  knockIntensity = 0.5,
  light = undefined,
  lean = 0,
  shadows = true,
  reduced = false,
  interior = 1,
  mist = 1,
  onGpuMs = undefined,
} = defineProps<{
  /** Lieu : matériau, couleurs et style du battant. */
  variant: PlaceId
  /** Ouverture en degrés (0 = fermée, ~80 au plus), pivot autour des charnières. */
  angle?: number
  /** Compteur de coups : chaque incrément donne une impulsion au ressort. */
  knock?: number
  /** 0..1 : force du prochain coup. */
  knockIntensity?: number
  /** Lumière du lieu ; absente = préréglage du lieu. */
  light?: Door3dLight
  /** Inclinaison au survol ou au focus (degrés, négatif = vers nous) : s’ajoute à l’angle sans en être le maître. */
  lean?: number
  /** Ombre du battant : coupée par le gouverneur de qualité (sous `high`) ; l’écran tactile ou étroit la coupe aussi. */
  shadows?: boolean
  /** Mouvement réduit : le coup ne fait pas vibrer la porte. */
  reduced?: boolean
  /** 0..1 : opacité de l’intérieur chaud (0 laisse voir ce qui est derrière le canevas). */
  interior?: number
  /** 0..1 : brume au pied. */
  mist?: number
  /** Banc d’essai : durée GPU de chaque image (ms). */
  onGpuMs?: (ms: number) => void
}>()

const emit = defineEmits<{ failed: [] }>()

// Le canevas apparaît en fondu à la première image : la porte n’arrive pas d’un coup quand le GPU finit son init.
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const noShadows = useMediaQuery(SHADOWS_OFF_MEDIA)
const preset = computed(() => DOOR3D_PRESETS[variant])
const spring = createKnockSpring()
// `dirty` : une image est due. Il pilote la pause de la boucle GPU : faux = aucune boucle.
const dirty = ref(true)

watch(
  () => knock,
  (n, old) => {
    if (reduced || n <= old) return
    spring.kick(knockIntensity)
    dirty.value = true
  },
)
watch([() => angle, () => variant, () => light, () => interior, () => mist, () => lean, () => shadows, noShadows], () => (dirty.value = true), { deep: true })
useResizeObserver(canvas, () => (dirty.value = true))

const { status, lost } = useGpuEffect(
  canvas,
  async (el, onLost) => {
    const { createDoor3d } = await import('@/effects/door3d')
    return createDoor3d(el, {
      // Une reprise après un long repos ne doit pas faire sauter le ressort : pas d’au plus 1/30 s.
      params: (dt, width, height) => {
        if (reduced) spring.reset()
        else spring.step(Math.min(dt, 1 / 30))
        const p = preset.value
        return door3dParams({
          angleDeg: angle,
          knockDeg: spring.x,
          leanDeg: lean,
          width,
          height,
          shadows: shadows && !noShadows.value,
          look: p.look,
          light: light ?? p.light,
          interior,
          mist,
        })
      },
      dirty: () => dirty.value,
      drawn: () => {
        if (!spring.active) dirty.value = false
      },
      resized: () => (dirty.value = true),
      onGpuMs,
      onLost,
    })
  },
  // Init bornée : un GPU qui ne répond pas laisse la place au SVG de la scène au lieu d’une porte absente.
  { warning: 'Porte 3D désactivée :', timeout: 6000 },
)
watch(lost, (l) => l && emit('failed'))
</script>

<template>
  <canvas
    v-show="!lost"
    ref="canvas"
    class="block w-full h-full select-none pointer-events-none transition-opacity duration-200"
    :class="[status === 'ready' ? 'opacity-100' : 'opacity-0', { 'door3d-float': variant === 'nuages' && !reduced }]"
    aria-hidden="true"
  />
</template>

<style scoped>
/* Nuages : la porte flotte (déplacement de 3 px, 0,125 Hz) ; le canevas est déplacé tel quel, sans nouveau rendu GPU. */
.door3d-float {
  animation: door3d-float 8s ease-in-out infinite;
}
@keyframes door3d-float {
  50% {
    transform: translate3d(0, -3px, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .door3d-float {
    animation: none;
  }
}
</style>
