<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue'
import { useDeferredText } from '../../composables/useDeferredText'
import ActivitySkip from './ActivitySkip.vue'
import ActivityHud from './ActivityHud.vue'
import { durationOf } from '../../engine/activityTiming'
import { useActivityDone } from '../../composables/useActivityDone'
import { startWipeSound, type WipeSound } from '../../audio/wipe'
import { nextFrame } from '../../composables/nextFrame'
import { useReducedMotion } from '../../composables/useReducedMotion'
import type { GpuLoop } from '../../effects/gpuLoop'
import { KEY_STEP, WIN_RATIO, clampToDisc, createCoverage, createWipeRing, spacedStamps } from '../../effects/crystalMath'

// Niveau 5 : essuyer la boule de cristal. Brume WebGPU (canvas carré) ; si le GPU échoue, brume CSS qui s’efface quand même.
defineProps<{ level: number }>()
const emit = defineEmits<{ done: [] }>()
const SPACING = 0.14
const helpId = useId()

const ball = useTemplateRef<HTMLElement>('ball')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failed = ref(false)

const now = () => performance.now() / 1000
const ring = createWipeRing()
const coverage = createCoverage()
const ratio = ref(0)
const ringVersion = ref(0) // repousse le recalcul du masque CSS de secours
const cleared = ref(false)
const clearedAt = ref(0)
// À l’issue la région se vide : le HUD annonce seul le résultat.
const prompt = useDeferredText(() => (outcome.value !== 'play' ? '' : 'Essuyez la boule de cristal'))
// Réussite (joueur ou minuterie) : `onFinish` règle la dissipation ; en mouvement réduit la brume disparaît d’un coup.
const reducedMotion = useReducedMotion()
const { finish, canSkip, outcome, startedAt } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('crystal'),
  // Expiration (échec) : on arrête le frottement, la brume reste.
  onFinish: (o) => {
    wipe?.stop()
    wipe = null
    if (o === 'fail') return
    cleared.value = true
    clearedAt.value = now()
  },
})
const seed = Math.random() * 10 // bruit cosmétique : Math.random suffit
let last: { x: number; y: number } | null = null
// Son de frottement : créé au premier geste (geste utilisateur), coupé à la fin de l’activité.
let wipe: WipeSound | null = null
let prevPt: { x: number; y: number } | null = null
const rub = (p: { x: number; y: number }) => {
  if (cleared.value || outcome.value !== 'play') return
  wipe ??= startWipeSound()
  wipe.move(prevPt ? Math.hypot(p.x - prevPt.x, p.y - prevPt.y) : 0)
  prevPt = p
}
const rubEnd = () => {
  prevPt = null
  wipe?.rest()
}

const wipeAt = (x: number, y: number) => {
  const p = clampToDisc(x, y)
  // Un point tous les SPACING seulement (le reste du trajet est reporté) : l’anneau ne se remplit pas de quasi-doublons.
  const r = spacedStamps(last, p, SPACING)
  for (const s of r.points) {
    ring.add(s.x, s.y, now())
    coverage.mark(s.x, s.y)
  }
  last = r.last
  ratio.value = coverage.ratio()
  ringVersion.value++
  if (ratio.value >= WIN_RATIO) finish()
}

const doneAmount = () => (cleared.value ? (reducedMotion.value ? 1 : Math.min(1, (now() - clearedAt.value) / 0.8)) : 0)

// Pointeur (souris et tactile) : glisser pour essuyer.
let captured: { el: HTMLElement; id: number } | null = null
const toBall = (e: PointerEvent) => {
  const el = ball.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 }
}
const onDown = (e: PointerEvent) => {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture?.(e.pointerId)
  captured = { el, id: e.pointerId }
  last = null
  prevPt = null
  const p = toBall(e)
  if (!p) return
  rub(p)
  wipeAt(p.x, p.y)
  kbd.value = null
}
const onMove = (e: PointerEvent) => {
  if (e.buttons === 0 && e.pointerType === 'mouse') return
  if (!last && e.pointerType !== 'mouse') return
  const p = toBall(e)
  if (!p) return
  rub(p)
  wipeAt(p.x, p.y)
}
const onUp = () => {
  rubEnd()
  last = null
  captured = null
}

// Clavier : les flèches déplacent le chiffon (et essuient en chemin).
const kbd = ref<{ x: number; y: number } | null>(null)
const onKey = (e: KeyboardEvent) => {
  const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const v = d[e.key]
  if (!v) return
  e.preventDefault()
  const cur = kbd.value ?? { x: 0, y: 0 }
  const p = clampToDisc(cur.x + v[0] * KEY_STEP, cur.y + v[1] * KEY_STEP)
  kbd.value = p
  rub(p)
  last = null // chaque pression pose son point
  wipeAt(p.x, p.y)
  last = null
}

// Brume de secours (CSS) : le masque ouvre un trou à chaque coup récent ; l’opacité baisse avec la couverture.
const fallbackStyle = computed(() => {
  void ringVersion.value
  const holes = ring.active().map((s) => `radial-gradient(circle at ${((s.x + 1) * 50).toFixed(1)}% ${((s.y + 1) * 50).toFixed(1)}%, transparent 0 9%, #000 17%)`)
  const style: Record<string, string> = { opacity: cleared.value ? '0' : String(1 - Math.min(1, ratio.value / WIN_RATIO) * 0.6) }
  if (reducedMotion.value) style.transition = 'none'
  if (holes.length) {
    style.maskImage = holes.join(', ')
    style.maskComposite = 'intersect'
    style.webkitMaskImage = holes.join(', ')
    style.webkitMaskComposite = 'source-in'
  }
  return style
})

// WebGPU : import dynamique + périphérique ; chaque await revérifie que le composant est encore monté.
let scene: GpuLoop | null = null
let gone = false
onMounted(async () => {
  try {
    const { createCrystal } = await import('../../effects/crystal')
    await nextFrame() // canevas mis en page
    if (gone || !canvas.value) return
    const s = await createCrystal(canvas.value, {
      motion: () => !reducedMotion.value,
      points: () => ring.pack(now()),
      grid: () => coverage.pack(),
      done: doneAmount,
      seed,
      onLost: () => (failed.value = true),
    })
    if (gone) return s.stop()
    scene = s
  } catch (e) {
    console.warn('Crystal ball: CSS fallback:', e)
    failed.value = true
  }
})
// Exception : libère le GPU et la capture du pointeur (WebGPU et API pointeur, hors VueUse) ; `gone` interrompt l’init asynchrone en cours.
onUnmounted(() => {
  gone = true
  last = null
  wipe?.stop()
  wipe = null
  try {
    if (captured?.el.hasPointerCapture?.(captured.id)) captured.el.releasePointerCapture(captured.id)
  } catch {
    // élément déjà détaché : la capture est déjà relâchée
  }
  captured = null
  scene?.stop()
  scene = null
})
</script>

<template>
  <div class="relative w-full h-full flex flex-col items-center justify-center gap-4 font-ui select-none">
    <div
      ref="ball"
      class="ball relative rounded-full touch-none cursor-grab focus-visible:outline-2 focus-visible:outline-offset-4"
      tabindex="0"
      role="application"
      aria-label="Boule de cristal embrumée"
      :aria-describedby="helpId"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @keydown="onKey"
    >
      <canvas v-show="!failed" ref="canvas" class="absolute inset-0 w-full h-full rounded-full pointer-events-none" aria-hidden="true" />
      <template v-if="failed">
        <div class="absolute inset-0 rounded-full fb-glass pointer-events-none" aria-hidden="true">
          <div class="fb-eye" />
        </div>
        <div class="absolute inset-0 rounded-full fb-fog pointer-events-none" :style="fallbackStyle" aria-hidden="true" />
      </template>
      <div
        v-if="kbd"
        class="absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-white/70 pointer-events-none"
        :style="{ left: `${(kbd.x + 1) * 50}%`, top: `${(kbd.y + 1) * 50}%` }"
        aria-hidden="true"
      />
    </div>
    <p :id="helpId" class="sr-only">Glissez le doigt ou la souris sur la boule pour l’essuyer. Au clavier, les flèches déplacent le chiffon.</p>
    <p class="text-xl text-center px-4" :class="{ invisible: outcome !== 'play' }" aria-live="polite">
      {{ prompt }}
    </p>
    <ActivityHud activity="crystal" :outcome="outcome" :started-at="startedAt" />
    <ActivitySkip :show="canSkip" @skip="finish" />
  </div>
</template>

<style scoped>
.ball {
  width: min(320px, 78vw, calc(100dvh - var(--taskbar-h) - 7rem));
  aspect-ratio: 1;
  box-shadow: 0 0 40px rgb(120 90 200 / 0.35);
}
.fb-glass {
  background: radial-gradient(circle at 32% 26%, rgb(190 200 255 / 0.3), transparent 28%), radial-gradient(circle at 50% 50%, #241546, #0c0618 75%);
  box-shadow: inset 0 0 28px rgb(0 0 0 / 0.6);
}
.fb-eye {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52%;
  height: 20%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #05010a 0 9%, transparent 10%), radial-gradient(circle, #f1b95a 0 24%, transparent 26%), radial-gradient(ellipse, rgb(241 185 90 / 0.4), transparent 70%);
}
.fb-fog {
  background:
    radial-gradient(circle at 30% 35%, rgb(220 220 235 / 0.9), transparent 45%), radial-gradient(circle at 70% 60%, rgb(190 190 210 / 0.9), transparent 50%), radial-gradient(circle, #8d8da3, #b9b9cc);
  transition: opacity 0.6s;
}
</style>
