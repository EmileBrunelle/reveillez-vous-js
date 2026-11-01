<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { useCssVar, useMediaQuery, useRafFn, useTimeoutFn } from '@vueuse/core'
import { animate } from 'motion-v'
import ActivityHud from './ActivityHud.vue'
import { durationOf } from '@/engine/activityTiming'
import { AMPLITUDE, heldSymbol, launch, paramsFor, pickSymbols, pickTarget, pushDir, requestStop, stepPendulum, symbolAngle, tuningFor } from '@/engine/pendulum'
import { orSecure, type Rng } from '@/engine/rng'
import { PENDULUM_SYMBOLS, PENDULUM_TEXTS, type PendulumSymbolId } from '@/content/activityPrompts'
import { focusQuietly } from '@/composables/focusQuietly'
import { useActivityDone } from '@/composables/useActivityDone'
import { useDeferredText } from '@/composables/useDeferredText'
import { useHaptics } from '@/composables/haptics'
import { useReducedMotion } from '@/composables/useReducedMotion'
import IconMoon from '~icons/game-icons/moon'
import IconStar from '~icons/game-icons/star-formation'
import IconSkull from '~icons/game-icons/death-skull'
import IconEye from '~icons/game-icons/all-seeing-eye'
import IconCat from '~icons/game-icons/cat'
import IconGhost from '~icons/game-icons/ghost'
import IconRaven from '~icons/game-icons/raven'
import IconPumpkin from '~icons/game-icons/pumpkin'

// Le pendule : un cristal au bout d’un fil se balance au-dessus d’un demi-cercle de symboles ; il faut l’ARRÊTER sur celui qui est demandé.
// On l’arrête en cliquant ou en touchant le cristal lui-même (bouton réel, enfant du bras qui tourne : il suit sans second maître de la rotation).
// L’arrêt ajoute un fort amortissement (le cristal glisse encore avant de s’immobiliser) : on anticipe. La physique est dans `engine/pendulum`.
// La boucle `useRafFn` est la seule à écrire l’angle (variables CSS `--a`, `--w`, `--k` du support) ; le fil, le cristal, la traînée et l’ombre en dérivent en CSS.
const { level, rng = undefined } = defineProps<{ level: number; rng?: Rng }>()
// Pas de défaut de prop : Vue prendrait la fabrique secureRng comme valeur.
const rand = orSecure(rng)
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()
const reduced = useReducedMotion()
const helpId = useId()
// Indication selon le geste : doigt ou souris.
const coarse = useMediaQuery('(pointer: coarse)')

const ICONS: Record<PendulumSymbolId, typeof IconMoon> = { moon: IconMoon, star: IconStar, skull: IconSkull, eye: IconEye, cat: IconCat, ghost: IconGhost, raven: IconRaven, pumpkin: IconPumpkin }

const tuning = tuningFor(level)
// Mouvement réduit : période allongée de moitié (le jeu reste jouable), sans traînée.
const params = computed(() => paramsFor(tuning, reduced.value))
const symbols = pickSymbols(rand, PENDULUM_SYMBOLS, tuning.count)
const target = pickTarget(rand, tuning.count)
const targetOn = symbols[target].on

// État physique : variable simple (la boucle le lit et l’écrit à chaque image, aucun rendu Vue). Départ au point bas, à pleine vitesse.
let state = launch(params.value, AMPLITUDE)
// `swing` : le cristal oscille ; `stopping` : arrêt demandé, il glisse ; `rest` : immobile, verdict rendu.
const phase = ref<'swing' | 'stopping' | 'rest'>('swing')
const triesLeft = ref(tuning.tries)
// Symbole illuminé (réussite) et symbole où le cristal s’est arrêté à tort (raté en cours).
const lit = ref<number | null>(null)
const missed = ref<number | null>(null)
const message = ref(PENDULUM_TEXTS.ask(targetOn))

const { finish, fail, outcome, startedAt, paused, elapsed, graceLeft, afterPause, isFinished } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('pendulum'),
  // Temps écoulé : le cristal s’arrête de lui-même (amortissement), sans verdict. La réussite et l’échec par essais arrivent déjà immobiles.
  onFinish: () => {
    if (!state.rest) state = requestStop(state)
  },
})

// À l’issue la région se vide : le HUD annonce seul le résultat.
const prompt = useDeferredText(() => (outcome.value !== 'play' ? '' : message.value))

const swingEl = useTemplateRef<HTMLElement>('swingEl')
const angle = useCssVar('--a', swingEl)
const speed = useCssVar('--w', swingEl)
const energy = useCssVar('--k', swingEl)
const render = () => {
  angle.value = state.theta.toFixed(4)
  speed.value = state.omega.toFixed(3)
  // Visibilité de la traînée : nulle à l’arrêt, pleine dès ~1,5 rad/s.
  energy.value = Math.min(1, Math.abs(state.omega) / 1.5).toFixed(2)
}

// Verdict : le cristal est immobile ; il retient un symbole, ou aucun s’il est resté entre deux.
const judge = () => {
  // La minuterie a pu rendre l’échec pendant la glissade : aucun verdict sous l’écran d’issue (ni symbole vert, ni essai décompté).
  if (isFinished()) return
  phase.value = 'rest'
  const held = heldSymbol(state.theta, tuning.count, tuning.ratio)
  if (held === target) {
    lit.value = target
    finish()
    return
  }
  triesLeft.value--
  missed.value = held
  if (triesLeft.value <= 0) return fail()
  message.value = PENDULUM_TEXTS.retry(held === null ? null : symbols[held].on, targetOn, triesLeft.value)
  relaunchLater()
}

// Relance après un raté : une poussée depuis le point d’arrêt (même énergie qu’un balancement complet, la position ne saute pas), vers le côté qui a le plus de place.
const relaunch = () => {
  if (isFinished()) return
  state = launch(params.value, AMPLITUDE, state.theta, pushDir(state.theta))
  missed.value = null
  phase.value = 'swing'
}
const { start: relaunchLater } = useTimeoutFn(() => afterPause(relaunch), 1100, { immediate: false })

useRafFn(({ delta }) => {
  // En pause (onglet caché, fenêtre quittée, menu ouvert) ou immobile : rien ne bouge, la boucle reste armée pour la reprise.
  if (paused.value || state.rest) return
  state = stepPendulum(state, Math.min(delta / 1000, 1 / 30), params.value)
  render()
  if (state.rest && phase.value === 'stopping') judge()
})

const stopNow = () => {
  if (outcome.value !== 'play' || paused.value || phase.value !== 'swing') return
  state = requestStop(state)
  phase.value = 'stopping'
  pulse(20)
}

// Clic ou toucher sur le cristal, ou clavier : l’arrêt se déclenche à l’appui (pointerdown, keydown), pas au relâchement, pour ne pas perdre de précision.
// Le `click` qui suit un appui de souris ou de doigt (detail > 0) ou une touche déjà traitée est ignoré ; seul un `click` sans appui (lecteur d’écran) arrête.
const KEY_GUARD_MS = 600
let keyStopAt = -Infinity
const onPointerdown = (e: PointerEvent) => {
  if (e.button === 0) stopNow()
}
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== ' ' && e.key !== 'Enter') return
  e.preventDefault()
  if (e.repeat) return
  keyStopAt = Date.now()
  stopNow()
}
const onClick = (e: MouseEvent) => {
  if (e.detail > 0 || Date.now() - keyStopAt < KEY_GUARD_MS) return
  stopNow()
}

// Réussite : le symbole retenu gonfle au ressort (un seul maître de son transform : animate). Mouvement réduit : il s’illumine seulement.
const symbolEls = useTemplateRef<HTMLElement[]>('symbolEls')
watch(lit, async (i) => {
  if (i === null || reduced.value) return
  await nextTick()
  const el = symbolEls.value?.[i]
  if (el) animate(el, { scale: [1, 1.4, 1.25] }, { type: 'spring', stiffness: 480, damping: 9 })
})

const btn = useTemplateRef<HTMLElement>('btn')
// Un appui à côté du cristal n’arrête rien, mais rend le focus au cristal pour que le clavier continue d’agir.
const refocus = () => focusQuietly(btn.value)
// Le cristal prend le focus au montage (sans anneau si l’entrée était un pointeur) : Espace et Entrée arrêtent dès la première seconde.
onMounted(() => {
  render()
  focusQuietly(btn.value)
})

// Géométrie : tout en unités de `--L` (rayon du demi-cercle), donc l’échelle suit l’écran sans mesure en JavaScript.
const BOARD = 1.12
const SLOT_R = 0.1
const SLOT_RING = 0.93
const at = (r: number, a: number) => ({ x: r * Math.sin(a), y: r * Math.cos(a) })
const f = (n: number) => n.toFixed(4)
// Demi-cercle plein (pivot au centre de sa base) et arcs gravés, dans un repère où le pivot est en (0, 0), y vers le bas.
const arc = (r: number) => `M ${f(-r)} 0 A ${r} ${r} 0 0 0 ${f(r)} 0`
const boardPath = `${arc(BOARD)} Z`
const slots = symbols.map((s, i) => ({ ...s, i, ...at(SLOT_RING, symbolAngle(i, tuning.count)) }))
// Repères gravés : un rayon par symbole (de l’arc intérieur à l’anneau des symboles) et un point entre deux symboles.
const rays = slots.map((s) => {
  const a = symbolAngle(s.i, tuning.count)
  const p = at(0.45, a)
  const q = at(SLOT_RING - SLOT_R - 0.02, a)
  return `M ${f(p.x)} ${f(p.y)} L ${f(q.x)} ${f(q.y)}`
})
const dots = slots.slice(1).map((_, k) => at(SLOT_RING, (symbolAngle(k, tuning.count) + symbolAngle(k + 1, tuning.count)) / 2))
const GHOST_LAG = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12]
</script>

<template>
  <div class="relative size-full flex flex-col items-center justify-center gap-3 px-4 pb-32 font-ui select-none" data-testid="pendulum-stage" @pointerdown.self="refocus">
    <p class="min-h-[3lh] max-w-[26ch] text-center text-xl leading-tight text-amber-100" :class="{ invisible: outcome !== 'play' }" aria-live="polite">
      {{ prompt }}
    </p>
    <div class="scene relative" data-testid="pendulum-scene" @pointerdown.self="refocus">
      <!-- Brume : deux nappes qui dérivent lentement (une seule fois sans fin, hors mouvement réduit). -->
      <span class="mist mist-a pointer-events-none absolute" aria-hidden="true" />
      <span class="mist mist-b pointer-events-none absolute" aria-hidden="true" />
      <svg class="board absolute" aria-hidden="true" :viewBox="`${-BOARD - 0.02} -0.02 ${2 * BOARD + 0.04} ${BOARD + 0.04}`" preserveAspectRatio="none">
        <defs>
          <radialGradient id="pendulum-stone" cx="0" cy="0" r="1.12" gradientUnits="userSpaceOnUse">
            <stop offset="0.35" stop-color="#231a33" />
            <stop offset="1" stop-color="#33264a" />
          </radialGradient>
        </defs>
        <path :d="boardPath" fill="url(#pendulum-stone)" stroke="#07050c" stroke-width="0.02" />
        <!-- gravure : un trait sombre et son reflet clair juste dessous -->
        <g fill="none" stroke-linecap="round">
          <template v-for="r in [1.04, 0.8, 0.45]" :key="r">
            <path :d="arc(r)" stroke="#07050c" stroke-width="0.014" />
            <path :d="arc(r)" stroke="#6a5a8c" stroke-opacity="0.55" stroke-width="0.005" transform="translate(0 0.012)" />
          </template>
          <path v-for="(d, k) in rays" :key="k" :d="d" stroke="#07050c" stroke-width="0.008" stroke-opacity="0.7" />
        </g>
        <circle v-for="(d, k) in dots" :key="k" :cx="d.x" :cy="d.y" r="0.011" fill="#07050c" />
        <circle v-for="s in slots" :key="s.id" :cx="s.x" :cy="s.y" :r="SLOT_R" fill="#0e0a17" stroke="#07050c" stroke-width="0.012" />
        <circle v-for="s in slots" :key="`${s.id}-rim`" :cx="s.x" :cy="s.y" :r="SLOT_R - 0.008" fill="none" stroke="#6a5a8c" stroke-opacity="0.45" stroke-width="0.005" />
      </svg>
      <!-- symboles : le visé luit doucement, le retenu à tort rougit, le gagnant s’illumine -->
      <span
        v-for="s in slots"
        :key="s.id"
        ref="symbolEls"
        class="slot absolute grid place-items-center rounded-full"
        aria-hidden="true"
        :class="{ target: s.i === target && lit !== s.i, lit: lit === s.i, missed: missed === s.i }"
        :style="{ left: `calc(50% + var(--L) * ${f(s.x)})`, top: `calc(var(--P) + var(--L) * ${f(s.y)})` }"
        data-testid="pendulum-symbol"
        :data-target="s.i === target ? '' : undefined"
        :data-lit="lit === s.i ? '' : undefined"
      >
        <span class="halo absolute inset-0 rounded-full" />
        <component :is="ICONS[s.id]" class="icon relative" />
      </span>
      <!-- support : l’angle est écrit par la boucle ; chaque bras tourne autour du pivot (origine 0 0) -->
      <div ref="swingEl" class="swing absolute" data-testid="pendulum-swing">
        <span class="arm shadow-arm absolute" aria-hidden="true"
          ><span class="shadow-pos absolute"><span class="shadow-blob absolute" /></span
        ></span>
        <template v-if="!reduced">
          <span v-for="(lag, k) in GHOST_LAG" :key="k" class="arm ghost-arm absolute" aria-hidden="true" :style="{ '--lag': lag }"
            ><span class="crystal-pos absolute"><span class="ghost absolute inset-0" /></span
          ></span>
        </template>
        <span class="arm main-arm absolute"
          ><span class="string absolute" aria-hidden="true" /><span class="crystal-pos absolute"
            ><span class="glow absolute" aria-hidden="true" /><span class="crystal absolute inset-0" aria-hidden="true"><span class="glint absolute" /></span>
            <!-- Cible : bouton réel centré sur le cristal (zone de toucher généreuse), enfant du bras qui tourne. -->
            <button
              ref="btn"
              type="button"
              class="crystal-hit absolute rounded-full cursor-pointer touch-manipulation bg-transparent border-0 p-0 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-amber-200 focus-visible:outline-offset-2"
              :aria-label="PENDULUM_TEXTS.stop"
              :aria-disabled="outcome === 'play' ? undefined : 'true'"
              :aria-describedby="helpId"
              @pointerdown="onPointerdown"
              @keydown="onKeydown"
              @keyup.space.prevent
              @click="onClick" /></span
        ></span>
        <span class="pivot absolute rounded-full" />
      </div>
    </div>
    <p class="absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-xl text-violet-200" :class="{ invisible: outcome !== 'play' }" aria-hidden="true" data-testid="pendulum-hint">
      {{ coarse ? PENDULUM_TEXTS.hintTouch : PENDULUM_TEXTS.hintClick }}
    </p>
    <p :id="helpId" class="sr-only">{{ PENDULUM_TEXTS.help }}</p>
    <ActivityHud activity="pendulum" :outcome="outcome" :started-at="startedAt" :paused="paused" :elapsed="elapsed" :grace-left="graceLeft" />
  </div>
</template>

<style scoped>
/* Tout est en unités de --L (rayon du demi-cercle) : l’échelle suit la largeur et la hauteur disponibles. P = marge au-dessus du pivot. */
.scene {
  --L: clamp(7rem, min(14rem, 41vw, (100dvh - var(--taskbar-h) - 19rem) / 1.12), 14rem);
  --P: 1.25rem;
  --Rc: 0.705;
  width: calc(var(--L) * 2.24);
  height: calc(var(--P) + var(--L) * 1.12);
}
@media (prefers-reduced-motion: no-preference) {
  .scene {
    animation: scene-in 0.5s ease-out backwards;
  }
}
@keyframes scene-in {
  from {
    opacity: 0;
  }
}
.board {
  left: 0;
  top: var(--P);
  width: 100%;
  height: calc(var(--L) * 1.12);
  filter: drop-shadow(0 0.4rem 0.6rem rgb(0 0 0 / 0.55));
}
/* Brume : dégradés radiaux (pas de filtre), dérive lente en translation seulement. */
.mist {
  width: calc(var(--L) * 1.5);
  height: calc(var(--L) * 0.55);
  top: calc(var(--P) + var(--L) * 0.45);
  background: radial-gradient(closest-side, rgb(180 160 230 / 0.22), transparent);
}
.mist-a {
  left: -12%;
}
.mist-b {
  right: -12%;
  top: calc(var(--P) + var(--L) * 0.75);
}
@media (prefers-reduced-motion: no-preference) {
  .mist-a {
    animation: mist-drift 26s ease-in-out infinite alternate;
  }
  .mist-b {
    animation: mist-drift 34s ease-in-out infinite alternate-reverse;
  }
}
@keyframes mist-drift {
  from {
    translate: -6% 0;
  }
  to {
    translate: 8% 0;
  }
}
.slot {
  width: calc(var(--L) * 0.2);
  height: calc(var(--L) * 0.2);
  translate: -50% -50%;
  color: #b9a8dc;
}
.icon {
  font-size: calc(var(--L) * 0.15);
}
.slot .halo {
  opacity: 0;
  background: radial-gradient(circle, rgb(252 211 77 / 0.55), rgb(252 211 77 / 0.12) 60%, transparent 75%);
}
/* Le symbole visé luit doucement : un aller-retour d’opacité de 1,2 s, soit 0,42 Hz (sous 0,5 Hz). Mouvement réduit : lueur fixe. */
.slot.target {
  color: #fde68a;
}
.slot.target .halo {
  opacity: 0.8;
}
@media (prefers-reduced-motion: no-preference) {
  .slot.target .halo {
    animation: halo 1.2s ease-in-out infinite alternate;
  }
}
@keyframes halo {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 0.9;
  }
}
.slot.lit {
  color: #fffbeb;
}
.slot.lit .halo {
  opacity: 1;
  background: radial-gradient(circle, rgb(255 244 200 / 0.95), rgb(252 211 77 / 0.5) 55%, transparent 78%);
}
.slot.missed {
  color: #fca5a5;
}
.slot.missed .halo {
  opacity: 0.9;
  background: radial-gradient(circle, rgb(248 113 113 / 0.35), transparent 70%);
}
/* Support : zéro taille, au pivot ; --a, --w, --k écrits par la boucle. Angle positif = vers la droite, alors que `rotate` positif tourne vers la gauche en partant du bas : d’où le signe moins. */
.swing {
  left: 50%;
  top: var(--P);
  width: 0;
  height: 0;
}
.arm {
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  will-change: rotate;
}
.main-arm {
  rotate: calc(var(--a, 0) * -1rad);
}
/* Traînée : copies du cristal en retard de lag × vitesse (même trajet, quelques dizaines de ms plus tôt), d’autant plus visibles que ça va vite. */
.ghost-arm {
  rotate: calc((var(--a, 0) - var(--w, 0) * var(--lag)) * -1rad);
  opacity: calc(var(--k, 0) * (0.34 - var(--lag) * 2));
}
.string {
  left: calc(max(1px, var(--L) * 0.005) / -2);
  top: 0;
  width: max(1px, calc(var(--L) * 0.005));
  height: calc(var(--L) * (var(--Rc) - 0.11));
  background: linear-gradient(#d8ccf0, rgb(216 204 240 / 0.75));
}
.crystal-hit {
  left: 50%;
  top: 50%;
  width: max(4rem, calc(var(--L) * 0.4));
  height: max(4rem, calc(var(--L) * 0.4));
  translate: -50% -50%;
}
.crystal-pos {
  left: calc(var(--L) * -0.06);
  top: calc(var(--L) * (var(--Rc) - 0.11));
  width: calc(var(--L) * 0.12);
  height: calc(var(--L) * 0.22);
}
.crystal,
.ghost {
  clip-path: polygon(50% 0, 100% 30%, 50% 100%, 0 30%);
}
.ghost {
  background: linear-gradient(#a98bf0, #5b2fc0);
}
/* Cristal violet : dégradé de base, facettes (moitiés claire et sombre, dessus éclairci) et reflet blanc en haut à gauche. */
.crystal {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.38), transparent 36%), linear-gradient(90deg, rgb(255 255 255 / 0.2) 0 50%, rgb(10 0 40 / 0.22) 50% 100%),
    linear-gradient(165deg, #c9a8ff 0%, #8148e6 45%, #3a1a8a 100%);
}
.glint {
  left: 20%;
  top: 14%;
  width: 24%;
  height: 24%;
  background: rgb(255 255 255 / 0.9);
  clip-path: polygon(40% 0, 100% 35%, 55% 100%, 0 55%);
}
.glow {
  left: -60%;
  top: -10%;
  width: 220%;
  height: 120%;
  background: radial-gradient(closest-side, rgb(170 120 255 / 0.5), transparent);
}
/* Ombre portée sur le demi-cercle : dans le repère de l’écran (les deux rotations s’annulent), décalée vers le bas et la droite comme si la lumière venait d’en haut à gauche. */
.shadow-arm {
  rotate: calc(var(--a, 0) * -1rad);
}
.shadow-pos {
  left: 0;
  top: calc(var(--L) * var(--Rc));
  width: 0;
  height: 0;
  rotate: calc(var(--a, 0) * 1rad);
}
.shadow-blob {
  left: calc(var(--L) * -0.01);
  top: calc(var(--L) * 0.03);
  width: calc(var(--L) * 0.22);
  height: calc(var(--L) * 0.16);
  background: radial-gradient(closest-side, rgb(0 0 0 / 0.78), transparent);
}
.pivot {
  left: calc(var(--L) * -0.03);
  top: calc(var(--L) * -0.03);
  width: calc(var(--L) * 0.06);
  height: calc(var(--L) * 0.06);
  background: radial-gradient(circle at 35% 30%, #f1d98a, #8a6a24);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
}
</style>
