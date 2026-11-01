<script setup lang="ts">
import { onMounted, onScopeDispose, useTemplateRef, watch } from 'vue'
import { M as Motion, animate, useMotionValue, useSpring, useTransform, type AnimationPlaybackControls } from 'motion-v'
import { useElementBounding, useEventListener, useRafFn } from '@vueuse/core'
import { useMotionScope } from '@/composables/useMotionScope'
import type { PlaceId } from '@/effects/places/types'
import SeerArt from '~icons/rvj/voyante'
import {
  BREATH_HALF_S,
  FLAME_HALF_S,
  ORB_HALF_S,
  SPEAK_GAZE,
  armATransform,
  bodyTransform,
  emergePose,
  eyesLevel,
  eyesTransform,
  flameLevel,
  gazeFrom,
  handBTransform,
  headTransform,
  orbLevel,
  rimLevel,
  tintFor,
} from './seerPose'

/**
 * La voyante, vue à contre-jour dans l’embrasure. Décorative (aria-hidden) : le texte reste dans DoorScene.
 * - `open` (0 → 1) : progression de l’ouverture de la porte ; elle émerge de l’ombre pendant que le battant pivote.
 * - `speaking` : elle « parle » : la main de la boule fait un geste, le regard revient vers la personne qui joue.
 * - `reduced` : mouvement réduit : apparition en fondu, puis immobile.
 * - `place` : teinte la lumière (liseré, lumière du dehors, boule).
 *
 * Maîtres des transforms (un seul par nœud, emboîtés) : `emerge` (div, y/échelle/opacité = ressort sur `open`) > `seer-breath` (corps, respiration)
 * > `seer-head` (rotation du cou) > `seer-eyes` (glissement du regard) ; `seer-hand-b` (geste) et `seer-arm-a` (bras de la bougie) sont des frères.
 * Les groupes SVG reçoivent leur attribut `transform` d’un seul endroit (`compose`) ; les lueurs passent par des variables CSS sur la racine.
 */
const { open = 1, speaking = false, reduced = false, place = undefined } = defineProps<{ open?: number; speaking?: boolean; reduced?: boolean; place?: PlaceId }>()

const root = useTemplateRef<HTMLElement>('root')
const tint = tintFor(place)

// Émergence : un ressort suit `open` (même si le parent le fait sauter de 0 à 1) ; en mouvement réduit, ressort suramorti = simple fondu.
const p = useSpring(open, reduced ? { stiffness: 120, damping: 30 } : { stiffness: 60, damping: 15, restDelta: 0.001 })
const opacity = useTransform(p, (v) => emergePose(v, reduced).opacity)
const y = useTransform(p, (v) => `${emergePose(v, reduced).y}%`)
const scale = useTransform(p, (v) => emergePose(v, reduced).scale)

// Boucles lentes (0..1, aller-retour) et ressorts d’interaction.
const breath = useMotionValue(0)
const flame = useMotionValue(0)
const orb = useMotionValue(0)
const gaze = { x: useSpring(0, { stiffness: 70, damping: 16 }), y: useSpring(0, { stiffness: 70, damping: 16 }) }
const gesture = useSpring(0, { stiffness: 110, damping: 11 })

const part = (sel: string) => root.value?.querySelector(sel) ?? null

/** UN seul endroit écrit les transforms des groupes du SVG, d’après les valeurs de Motion. */
const compose = () => {
  part('.seer-breath')?.setAttribute('transform', bodyTransform(breath.get()))
  part('.seer-head')?.setAttribute('transform', headTransform(gaze.x.get(), gaze.y.get(), gesture.get()))
  part('.seer-eyes')?.setAttribute('transform', eyesTransform(gaze.x.get(), gaze.y.get()))
  part('.seer-hand-b')?.setAttribute('transform', handBTransform(gesture.get()))
  part('.seer-arm-a')?.setAttribute('transform', armATransform(gesture.get()))
}
/** Lueurs et liseré : variables CSS sur la racine (une seule écriture, aucune animation de filtre). */
const lights = () => {
  const el = root.value
  if (!el) return
  const level = p.get()
  el.style.setProperty('--seer-rim-o', String(Number(rimLevel(level).toFixed(3))))
  el.style.setProperty('--seer-eyes-o', String(Number((eyesLevel(level) * (0.62 + 0.22 * orb.get())).toFixed(3))))
  el.style.setProperty('--seer-lit-a', String(flameLevel(flame.get())))
  el.style.setProperty('--seer-lit-b', String(orbLevel(orb.get())))
}
const redraw = () => {
  compose()
  lights()
}
// Un seul rendu par image (pas un par valeur qui change) : un ticker lit toutes les valeurs de Motion et n’écrit que si l’une a bougé.
const values = [p, breath, flame, orb, gaze.x, gaze.y, gesture]
let drawn = ''
const ticker = useRafFn(
  () => {
    const now = values.map((mv) => mv.get()).join('|')
    if (now === drawn) return
    drawn = now
    redraw()
  },
  { immediate: false },
)

// Boucles de respiration : seulement tant qu’elle est visible et que le mouvement n’est pas réduit.
const loops: AnimationPlaybackControls[] = []
const stopLoops = () => {
  loops.splice(0).forEach((c) => c.stop())
}
const startLoops = () => {
  if (loops.length) return
  const swing = (mv: typeof breath, half: number) => animate(mv, 1, { duration: half, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' })
  loops.push(swing(breath, BREATH_HALF_S), swing(flame, FLAME_HALF_S), swing(orb, ORB_HALF_S))
}

// Regard : suit doucement le pointeur ; sans pointeur (tactile au repos), elle regarde la personne qui joue (centre).
let aim = { x: 0, y: 0 }
const bounds = useElementBounding(root)
const lookAt = () => {
  if (reduced) return
  const k = speaking ? SPEAK_GAZE : 1
  gaze.x.set(aim.x * k)
  gaze.y.set(aim.y * k)
}
useEventListener(
  window,
  ['pointermove', 'pointerdown'],
  (e: PointerEvent) => {
    const cx = bounds.left.value + bounds.width.value / 2
    const cy = bounds.top.value + bounds.height.value * 0.3
    aim = gazeFrom(e.clientX, e.clientY, cx, cy, window.innerWidth, window.innerHeight)
    lookAt()
  },
  { passive: true },
)
// Au doigt : à la levée, le regard revient au centre (rien ne pointe plus).
useEventListener(
  window,
  'pointerup',
  (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    aim = { x: 0, y: 0 }
    lookAt()
  },
  { passive: true },
)

// Geste : tant qu’elle parle, la main lève, retombe, relève un peu moins, retombe… (ressort ; pas de minuterie à nettoyer, voir useMotionScope).
const { wait } = useMotionScope()
const BEATS = [1, 0.3, 0.8, 0.15]
let talkToken = 0
const talk = async (on: boolean) => {
  const token = ++talkToken
  lookAt()
  if (!on || reduced) return void gesture.set(0)
  for (let i = 0; token === talkToken; i++) {
    gesture.set(BEATS[i % BEATS.length]!)
    await wait(i % 2 === 0 ? 520 : 640)
  }
}
watch(() => speaking, talk)

watch(
  () => open,
  (v) => {
    p.set(v)
    if (v > 0.02) ticker.resume()
    if (v > 0.02 && !reduced) startLoops()
  },
)
watch(
  () => reduced,
  (r) => {
    if (r) {
      stopLoops()
      for (const mv of [breath, flame, orb, gaze.x, gaze.y, gesture]) mv.set(0)
    } else if (open > 0.02) startLoops()
  },
)
onMounted(() => {
  redraw()
  if (open > 0.02) ticker.resume()
  if (open > 0.02 && !reduced) startLoops()
  if (speaking) void talk(true)
})
onScopeDispose(() => {
  talkToken++
  stopLoops()
})
</script>

<template>
  <div
    ref="root"
    class="seer relative block w-full"
    aria-hidden="true"
    :style="{ '--seer-rim': tint.rim, '--seer-moon': tint.moon, '--seer-orb': tint.orb, '--seer-rim-o': 0, '--seer-eyes-o': 0, '--seer-lit-a': 0.86, '--seer-lit-b': 0.84 }"
  >
    <Motion :style="{ opacity, y, scale }" class="origin-[50%_100%] will-change-transform">
      <SeerArt class="block w-full h-auto overflow-visible" />
    </Motion>
  </div>
</template>

<style scoped>
/* Calques éclairés : leur opacité vient des variables posées sur la racine (la lumière change, la forme jamais). */
.seer :deep(.seer-rim) {
  opacity: var(--seer-rim-o);
}
.seer :deep(.seer-eyes) {
  opacity: var(--seer-eyes-o);
}
.seer :deep(.seer-lit-a) {
  opacity: var(--seer-lit-a);
}
.seer :deep(.seer-lit-b) {
  opacity: var(--seer-lit-b);
}
</style>
