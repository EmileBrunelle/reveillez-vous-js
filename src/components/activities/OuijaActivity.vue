<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useElementBounding, useEventListener, useRafFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { Motion, useMotionValue, useSpring } from 'motion-v'
import { useRovingFocus } from '@vuetify/v0'
import ActivitySkip from './ActivitySkip.vue'
import ActivityHud from './ActivityHud.vue'
import { durationOf, outcomeMsOf } from '../../engine/activityTiming'
import { useActivityDone } from '../../composables/useActivityDone'
import { useDeferredText } from '../../composables/useDeferredText'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { isOverlayActive } from '../../composables/useOverlayOpen'
import { OUIJA_SHOWN, OUIJA_WORDS } from '../../content/ouija'
import {
  DROP_EXTENT,
  OUIJA_BYE,
  OUIJA_NO,
  OUIJA_ROWS,
  OUIJA_YES,
  advanceDwell,
  clampDrop,
  nextLetter,
  normalizeKey,
  pickDriftAt,
  pickWord,
  pressLetter,
  shouldDrift,
  wrongLetterMessage,
} from '../../engine/ouija'
import { approach, liftFromSpeed, tiltFromVelocity, tremorOffset, wanderOffset } from '../../engine/ouijaMotion'
import { orSecure, type Rng } from '../../engine/rng'
import { ouijaFarewell, ouijaTick } from '../../audio/ouija'
import { aimPoint } from '../../composables/touchAim'
import { useHaptics } from '../../composables/haptics'
import IconGoutte from '~icons/rvj/goutte'

const { level, rng = undefined } = defineProps<{ level: number; rng?: Rng }>()
// Pas de défaut de prop : Vue prendrait la fabrique secureRng comme valeur.
const rand = orSecure(rng)
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()
const reduced = useReducedMotion()

const word = pickWord(OUIJA_WORDS, rand)
const shown = OUIJA_SHOWN[word]
// Segments affichés : une lettre accentuée couvre une case de la planche, « œ » en couvre deux (OE).
const segments = [...shown].map((ch, i, all) => {
  const start = all.slice(0, i).reduce((n, c) => n + (c === 'œ' ? 2 : 1), 0)
  return { ch: ch.toUpperCase(), start, end: start + (ch === 'œ' ? 2 : 1) }
})
const driftAt = pickDriftAt(level, word.length, rand)
let driftUsed = false

// État lu par `onFinish` et par les minuteries : déclaré avant `useActivityDone`.
const stage = useTemplateRef<HTMLElement>('stage')
const board = useTemplateRef<HTMLElement>('board')
const index = ref(0)
let dwell = 0
const farewell = ref(false)
// Case de mot qui vient d’être complétée (le « pop » ne joue qu’une fois, à l’ajout de la classe).
const popSeg = ref(-1)
// Annonce vocale : la région aria-live existe dès le montage, le texte n’y entre qu’un instant après (sinon rien n’est lu).
// L’issue (réussite ou échec) est annoncée par le HUD, seule source : ici, rien n’en est répété.
const message = ref(`Épelez le mot ${shown}.`)
const status = useDeferredText(() => message.value)
// Case que la goutte rejoint d’elle-même (dérive vers NON, puis AU REVOIR) ; sinon elle suit le pointeur.
let override: string | null = null
// Valeurs lues par le CSS via `v-bind()` (variables sur la racine du composant, aucun rendu du gabarit à chaque image) :
// progression du survol (anneau de la lettre attendue) et chaleur de la goutte.
const dwellCss = ref('0')
const warmCss = ref('0')

const { start: driftLater, stop: driftStop } = useTimeoutFn(
  () => {
    override = null
    message.value = 'La goutte revient vers vous.'
  },
  1700,
  { immediate: false },
)

const { finish, canSkip, isFinished, outcome, startedAt } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('ouija'),
  delayMs: outcomeMsOf('ouija'),
  // Fin par n’importe quel chemin (dont les 20 s) : le mot est complet et AU REVOIR s’illumine, rien ne reste en suspens.
  // Expiration (échec) : le mot reste incomplet, pas d’au revoir.
  onFinish: (o) => {
    driftStop()
    dwell = 0
    if (o === 'fail') return
    index.value = word.length
    farewell.value = true
    override = OUIJA_BYE
    ouijaFarewell()
  },
})

const els: Record<string, HTMLElement | null> = {}
// Fonctions de ref mémorisées : une seule par case, pour que le rendu n’en recrée pas à chaque passe.
const setters = new Map<string, (el: unknown) => void>()
const setEl = (key: string) => {
  let f = setters.get(key)
  if (!f) setters.set(key, (f = (el: unknown) => (els[key] = el as HTMLElement | null)))
  return f
}

// Mesure de la scène (ResizeObserver + défilement de VueUse) ; les cases en sont déduites une fois par disposition.
// Le cache repart quand la scène ou la planche changent de taille (fenêtre, chargement de la police, cases `cqh`). Une animation `pop` en cours
// déplace un bord d’au plus quelques pixels (le centre ne bouge pas) : la tolérance de 4 px du survol l’absorbe.
const { left: stageLeft, top: stageTop, width: stageWidth, height: stageHeight } = useElementBounding(stage)
const layoutVersion = ref(0)
useResizeObserver(board, () => layoutVersion.value++)
const centers = computed(() => {
  void layoutVersion.value
  const map = new Map<string, { x: number; y: number; left: number; right: number; top: number; bottom: number }>()
  if (!stageWidth.value) return map
  for (const [key, el] of Object.entries(els)) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    const left = r.left - stageLeft.value
    const top = r.top - stageTop.value
    map.set(key, { x: left + r.width / 2, y: top + r.height / 2, left, right: left + r.width, top, bottom: top + r.height })
  }
  return map
})

// Goutte : le pointeur fixe une cible, la position la rejoint au ressort de Motion (ζ ≈ 0,7, ~5 % de dépassement : du poids, sans rebond).
// Le style (translation, inclinaison, échelle) vient de valeurs de mouvement : un seul maître du transform, aucun rendu Vue par image.
const target = { x: 0, y: 0 }
const goalX = useMotionValue(0)
const goalY = useMotionValue(0)
const SPRING = { stiffness: 720, damping: 37.5 }
const springX = useSpring(goalX, SPRING)
const springY = useSpring(goalY, SPRING)
const dropX = useMotionValue(0)
const dropY = useMotionValue(0)
const dropTilt = useMotionValue(0)
const dropLift = useMotionValue(1)
let placed = false
// Distance entre le bord gauche d’AU REVOIR et le point d’ancrage de la goutte : son débord à droite + un petit jeu.
const BYE_GAP = DROP_EXTENT.right + 6
// Mouvement vivant : état lissé écrit dans le même transform (un seul maître).
const motion = { clock: 0, tilt: 0, lift: 1, resist: 0 }

// Lettre qui vient d’être validée : classe `pop` retirée après l’animation (la même lettre peut revenir dans le mot).
const popLetter = ref('')
const { start: popClear } = useTimeoutFn(() => (popLetter.value = ''), 340, { immediate: false })

const validate = (letter: string) => {
  if (isFinished() || override) return
  const next = pressLetter(word, index.value, letter)
  if (next === index.value) {
    // Une mauvaise lettre ne reste pas muette : on dit laquelle est attendue.
    message.value = wrongLetterMessage(letter, nextLetter(word, index.value))
    return
  }
  index.value = next
  dwell = 0
  dwellCss.value = '0'
  popLetter.value = reduced.value ? '' : letter
  popClear()
  popSeg.value = reduced.value ? -1 : segments.findIndex((sg) => sg.end === next)
  ouijaTick()
  pulse(15)
  message.value = `Lettre ${letter}. ${next} sur ${word.length}.`
  if (next >= word.length) {
    farewell.value = true
    override = OUIJA_BYE
    finish()
    return
  }
  if (shouldDrift(driftAt, next, driftUsed)) {
    driftUsed = true
    override = OUIJA_NO
    message.value = 'La goutte dérive d’elle-même vers NON.'
    driftLater()
  }
}

const setTarget = (e: PointerEvent) => {
  // Mesure faite au moment de l’événement, sur l’élément qui le reçoit : jamais périmée (transforms, défilement, police).
  // Au toucher, la goutte se tient 40 px au-dessus du doigt.
  const p = aimPoint(e, (e.currentTarget as HTMLElement).getBoundingClientRect())
  target.x = p.x
  target.y = p.y
}
useEventListener(stage, 'pointermove', setTarget)
useEventListener(stage, 'pointerdown', setTarget)

// Épellation au clavier : taper les lettres du mot (accents ignorés) ; la goutte glisse vers la lettre validée.
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
  // Une fenêtre ou un menu est ouvert (Collection, À propos, Démarrer, réinitialisation) : la touche ne lui appartient pas.
  if (isOverlayActive(e.target, document)) return
  const letter = normalizeKey(e.key)
  if (!letter) return
  const before = index.value
  validate(letter)
  const c = index.value !== before ? centers.value.get(letter) : undefined
  if (c) {
    target.x = c.x
    target.y = c.y
  }
})

// Tabulation « itinérante » (v0 useRovingFocus, mode grille de 7 colonnes) : un seul arrêt pour la planche, flèches, Début et Fin entre les lettres.
// OUI, NON et AU REVOIR restent hors du parcours : ils ne réagissent à rien (décor de la planche).
const LETTERS = OUIJA_ROWS.flatMap((r) => [...r])
const { isTabbable, focus: focusLetter } = useRovingFocus(() => LETTERS.map((l) => ({ id: l, el: () => els[l] })), { target: board, columns: OUIJA_ROWS[0].length })
const expected = computed(() => nextLetter(word, index.value))

const { pause } = useRafFn(({ delta }) => {
  const dt = Math.min(delta, 50)
  const w = stageWidth.value
  const h = stageHeight.value
  if (!w) return
  if (!placed) {
    target.x = w / 2
    target.y = h * 0.55
    goalX.set(target.x)
    goalY.set(target.y)
    springX.jump(target.x)
    springY.jump(target.y)
    placed = true
  }
  const goal = override ? centers.value.get(override) : undefined
  // À la fin, la goutte s’arrête à gauche d’AU REVOIR pour que le texte reste lisible.
  // Toujours ramenée dans la scène (overflow hidden) : la goutte ne doit jamais être rognée, quelle que soit sa cible.
  const { x: tx, y: ty } = clampDrop(goal ? (override === OUIJA_BYE ? goal.left - BYE_GAP : goal.x) : target.x, goal ? goal.y : target.y, w, h)
  goalX.set(tx)
  goalY.set(ty)
  if (reduced.value) {
    springX.jump(tx)
    springY.jump(ty)
  }
  const px = springX.get()
  const py = springY.get()
  // Le ressort peut dépasser un peu la cible : on borne aussi la position affichée.
  const at = clampDrop(px, py, w, h)
  motion.clock += dt
  const drifting = override === OUIJA_NO
  let rx = at.x
  let ry = at.y
  if (reduced.value) {
    motion.tilt = 0
    motion.lift = 1
    motion.resist = 0
  } else {
    // Vitesse (px par image à 60 Hz) tirée du ressort : inclinaison dans le sens du mouvement, léger lift, retour doux au repos.
    const vx = springX.getVelocity() / 60
    const vy = springY.getVelocity() / 60
    motion.resist = approach(motion.resist, drifting ? 1 : 0, dt, 350)
    motion.tilt = approach(motion.tilt, tiltFromVelocity(vx, motion.resist), dt, 90)
    motion.lift = approach(motion.lift, liftFromSpeed(vx, vy), dt, 120)
    // « Autres mains » : vagabondage lent ajouté au rendu seulement (le test de survol garde la position du ressort), tremblement pendant la dérive résistée.
    const wander = wanderOffset(motion.clock, level)
    const tremor = tremorOffset(motion.clock, motion.resist)
    rx += wander.x + tremor.x
    ry += wander.y + tremor.y
  }
  dropX.set(rx)
  dropY.set(ry)
  dropTilt.set(motion.tilt)
  dropLift.set(motion.lift)
  // Survol de la lettre attendue (les autres sont ignorées) ; en pause pendant la dérive.
  const letter = expected.value
  const c = letter && !override && !isFinished() ? centers.value.get(letter) : undefined
  const over = !!c && px >= c.left - 4 && px <= c.right + 4 && py >= c.top - 4 && py <= c.bottom + 4
  const p = advanceDwell(dwell, over, dt)
  // Anneau de survol et chaleur : variables CSS de la scène, écrites seulement quand la valeur change.
  if (p !== dwell) dwellCss.value = String(p)
  dwell = p
  warmCss.value = p.toFixed(3)
  if (p >= 1 && letter) validate(letter)
  // Activité finie et goutte arrivée : plus rien à animer, la boucle s’arrête (pendant l’issue elle continue, la goutte rejoint AU REVOIR).
  if (isFinished() && Math.abs(springX.getVelocity()) + Math.abs(springY.getVelocity()) < 1 && Math.abs(px - tx) < 0.5 && Math.abs(py - ty) < 0.5) pause()
})
</script>

<template>
  <div ref="stage" class="ouija relative size-full overflow-hidden touch-none select-none flex flex-col items-center justify-center gap-3 sm:gap-5 px-2 font-title text-center">
    <p class="sr-only" aria-live="polite">{{ status }}</p>
    <p class="relative m-0 text-[#e8d9b0] text-sm tracking-[0.18em]" :class="{ invisible: outcome !== 'play' }">Épelez le mot</p>
    <!-- Le mot à épeler reste accessible (lecture à la navigation) : les cases se lisent comme un seul mot. -->
    <p class="relative m-0 flex gap-2 sm:gap-3 text-[2rem] sm:text-[2.6rem] leading-none text-[#d9b55a]">
      <span
        v-for="(seg, i) in segments"
        :key="i"
        class="inline-block min-w-[1.1em] border-0 border-b-[3px] border-solid pb-1"
        :class="[seg.end <= index ? 'border-[#d9b55a]' : seg.start <= index ? 'border-[#e8d9b0] opacity-80' : 'border-[#d9b55a]/25 opacity-40', { pop: popSeg === i }]"
        >{{ seg.ch }}</span
      >
    </p>
    <div ref="board" class="board relative flex flex-col items-center gap-1.5 sm:gap-2 px-2 py-3 sm:px-6 sm:py-5" role="group" aria-label="Planche Ouija">
      <div class="flex gap-10 sm:gap-16">
        <button :ref="setEl(OUIJA_YES)" type="button" class="key answer" :aria-label="OUIJA_YES" tabindex="-1">{{ OUIJA_YES }}</button>
        <button :ref="setEl(OUIJA_NO)" type="button" class="key answer" :aria-label="OUIJA_NO" tabindex="-1">{{ OUIJA_NO }}</button>
      </div>
      <div v-for="row in OUIJA_ROWS" :key="row" class="flex gap-1 sm:gap-1.5">
        <button
          v-for="l in row"
          :key="l"
          :ref="setEl(l)"
          type="button"
          class="key letter"
          :class="{ next: expected === l, pop: popLetter === l, 'no-motion': reduced }"
          :aria-label="`Lettre ${l}`"
          :tabindex="isTabbable(l) ? 0 : -1"
          @focus="focusLetter(l)"
          @click="validate(l)"
        >
          {{ l }}
        </button>
      </div>
      <button :ref="setEl(OUIJA_BYE)" type="button" class="key answer bye" :class="{ lit: farewell, 'no-motion': reduced }" :aria-label="OUIJA_BYE" tabindex="-1">
        {{ OUIJA_BYE }}
      </button>
    </div>
    <Motion as="span" class="drop absolute left-0 top-0 pointer-events-none" :style="{ x: dropX, y: dropY, rotate: dropTilt, scale: dropLift }" aria-hidden="true">
      <IconGoutte class="drop-shape" />
    </Motion>
    <ActivityHud activity="ouija" :outcome="outcome" :started-at="startedAt" />
    <ActivitySkip :show="canSkip" @skip="finish" />
  </div>
</template>

<style scoped>
.ouija {
  container-type: size; /* la planche se dimensionne sur la hauteur disponible (cqh) pour ne jamais être rognée */
  background: radial-gradient(ellipse at 50% 40%, rgb(60 30 14 / 0.55), transparent 70%), #08050a;
}
.board {
  /* Taille d’une case : celle de base, réduite quand la scène est basse (fenêtre courte) pour que la planche, AU REVOIR compris, tienne entière. */
  --cell: clamp(1.75rem, calc((100cqh - 14rem) / 6.4), 2.5rem);
  border: 3px solid #d9b55a;
  border-radius: 14px;
  background: repeating-linear-gradient(92deg, rgb(255 255 255 / 0.025) 0 2px, transparent 2px 9px), linear-gradient(180deg, #3a2112, #26140a 60%, #1d0f07);
  box-shadow:
    inset 0 0 0 3px #1a0d06,
    inset 0 0 0 4px rgb(217 181 90 / 0.4),
    0 10px 30px rgb(0 0 0 / 0.6);
}
.key {
  font-family: inherit;
  color: #d9b55a;
  background: transparent;
  border: 0;
  cursor: pointer;
  position: relative;
  border-radius: 8px;
}
.key:focus-visible {
  outline: 3px solid #e8d9b0;
  outline-offset: 2px;
}
.letter::after {
  /* Zone de toucher ≥ 44 px sans changer le dessin. */
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: max(100%, 44px);
  height: max(100%, 44px);
  transform: translate(-50%, -50%);
}
.letter {
  width: var(--cell);
  height: var(--cell);
  font-size: calc(var(--cell) * 0.56);
  font-weight: 700;
}
.answer {
  min-height: calc(var(--cell) * 1.1);
  padding: 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.bye {
  margin-top: 0.25rem;
  font-size: 0.95rem;
  transition:
    color 0.6s ease,
    background-color 0.6s ease,
    box-shadow 0.6s ease;
}
.bye.lit {
  color: #1a0d06;
  background: #f1d98a;
  box-shadow: 0 0 22px 6px rgb(241 217 138 / 0.55);
}
/* Lettre attendue : un anneau d’or se remplit pendant le survol (progression pilotée par dwellCss, pas de clignotement). */
.letter.next {
  background: radial-gradient(circle, rgb(217 181 90 / calc(v-bind(dwellCss) * 0.55)) 0 calc(v-bind(dwellCss) * 75%), transparent calc(v-bind(dwellCss) * 75% + 1px));
  box-shadow: inset 0 0 0 2px rgb(217 181 90 / 0.45);
}
@media (min-width: 640px) {
  .board {
    --cell: clamp(1.75rem, calc((100cqh - 15rem) / 6.4), 3.25rem);
  }
  .letter {
    font-size: calc(var(--cell) * 0.52);
  }
}
.drop {
  will-change: transform;
}
.drop-shape {
  position: absolute;
  left: -20px;
  top: -34px;
  width: 40px;
  height: 52px;
  /* warmCss (0–1) écrite par la boucle : la lentille se réchauffe pendant le survol. */
  filter: drop-shadow(0 6px 6px rgb(0 0 0 / 0.55)) drop-shadow(0 0 calc(v-bind(warmCss) * 10px) rgb(255 190 90 / calc(v-bind(warmCss) * 0.85))) brightness(calc(1 + v-bind(warmCss) * 0.25));
}
/* Validation : un seul pop (≈ 1,2 → 1, léger dépassement de ressort) et une lueur chaude qui retombe, sans clignotement. */
.pop {
  animation: pop 300ms cubic-bezier(0.34, 1.4, 0.64, 1) 1;
}
@keyframes pop {
  0% {
    transform: scale(1.2);
    text-shadow: 0 0 14px rgb(255 200 100 / 0.95);
  }
  60% {
    transform: scale(0.97);
  }
  100% {
    transform: scale(1);
    text-shadow: 0 0 0 rgb(255 200 100 / 0);
  }
}
.no-motion {
  transition-duration: 0s;
}
</style>
