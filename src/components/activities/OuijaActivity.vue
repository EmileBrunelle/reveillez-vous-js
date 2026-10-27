<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, useRafFn, useTimeoutFn } from '@vueuse/core'
import ActivitySkip from './ActivitySkip.vue'
import { useActivityDone } from '../../composables/useActivityDone'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { OUIJA_SHOWN, OUIJA_WORDS } from '../../content/ouija'
import { OUIJA_BYE, OUIJA_NO, OUIJA_ROWS, OUIJA_YES, advanceDwell, clampDrop, nextLetter, normalizeKey, pickDriftAt, pickWord, pressLetter, shouldDrift } from '../../engine/ouija'
import { orSecure, type Rng } from '../../engine/rng'
import IconGoutte from '~icons/rvj/goutte'

const props = defineProps<{ level: number; rng?: Rng }>()
// Pas de défaut de prop : Vue prendrait la fabrique secureRng comme valeur.
const rng = orSecure(props.rng)
const emit = defineEmits<{ done: [] }>()

const word = pickWord(OUIJA_WORDS, rng)
const shown = OUIJA_SHOWN[word]
// Segments affichés : une lettre accentuée couvre une case de la planche, « œ » en couvre deux (OE).
const segments = [...shown].map((ch, i, all) => {
  const start = all.slice(0, i).reduce((n, c) => n + (c === 'œ' ? 2 : 1), 0)
  return { ch: ch.toUpperCase(), start, end: start + (ch === 'œ' ? 2 : 1) }
})
const driftAt = pickDriftAt(props.level, word.length, rng)
let driftUsed = false

const index = ref(0)
let dwell = 0
const farewell = ref(false)
const status = ref(`Épelez le mot ${shown}.`)
const reduced = useReducedMotion()

const { finish, canSkip, isFinished } = useActivityDone(() => emit('done'), {
  delayMs: 1300,
  // Fin par n’importe quel chemin (dont les 20 s) : le mot est complet et AU REVOIR s’illumine, rien ne reste en suspens.
  onFinish: () => {
    index.value = word.length
    dwell = 0
    farewell.value = true
    override = els[OUIJA_BYE] ?? null
    driftStop()
    status.value = `${shown} : la planche vous dit au revoir.`
  },
})

const stage = ref<HTMLElement>()
const dropEl = ref<HTMLElement>()
const els: Record<string, HTMLElement | null> = {}
// Fonctions de ref mémorisées : une seule par case, pour que le rendu n’en recrée pas à chaque passe.
const setters = new Map<string, (el: unknown) => void>()
const setEl = (key: string) => {
  let f = setters.get(key)
  if (!f) setters.set(key, (f = (el: unknown) => (els[key] = el as HTMLElement | null)))
  return f
}

// Goutte : cible (pointeur) et position ressort, écrites directement dans le DOM (un seul maître du transform).
const target = { x: 0, y: 0 }
const pos = { x: 0, y: 0, vx: 0, vy: 0 }
let placed = false
// Case que la goutte rejoint d’elle-même (dérive vers NON, puis AU REVOIR) ; sinon elle suit le pointeur.
let override: HTMLElement | null = null

const centerOf = (el: HTMLElement) => {
  const s = stage.value?.getBoundingClientRect()
  if (!s) return null
  const r = el.getBoundingClientRect()
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, left: r.left - s.left, right: r.right - s.left, top: r.top - s.top, bottom: r.bottom - s.top }
}

const { start: driftLater, stop: driftStop } = useTimeoutFn(
  () => {
    override = null
    status.value = 'La goutte revient vers vous.'
  },
  1700,
  { immediate: false },
)

const validate = (letter: string) => {
  if (isFinished() || override) return
  const next = pressLetter(word, index.value, letter)
  if (next === index.value) return
  index.value = next
  dwell = 0
  els[letter]?.style.removeProperty('--dwell')
  status.value = `Lettre ${letter}. ${next} sur ${word.length}.`
  if (next >= word.length) {
    farewell.value = true
    override = els[OUIJA_BYE] ?? null
    finish()
    return
  }
  if (shouldDrift(driftAt, next, driftUsed)) {
    driftUsed = true
    override = els[OUIJA_NO] ?? null
    status.value = 'La goutte dérive d’elle-même vers NON.'
    driftLater()
  }
}

const setTarget = (e: PointerEvent) => {
  const r = stage.value?.getBoundingClientRect()
  if (!r) return
  target.x = e.clientX - r.left
  target.y = e.clientY - r.top
}
useEventListener(stage, 'pointermove', setTarget)
useEventListener(stage, 'pointerdown', setTarget)

// Épellation au clavier : taper les lettres du mot (accents ignorés) ; la goutte glisse vers la lettre validée.
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
  // Une fenêtre ou un menu est ouvert (Collection, À propos, Démarrer, réinitialisation) : la touche ne lui appartient pas.
  const t = e.target instanceof Element ? e.target : null
  const f = document.activeElement
  if (
    t?.closest('dialog[open], [role=menu]') ||
    f?.closest('dialog[open], [role=menu]') ||
    document.querySelector('dialog[open]') ||
    [...document.querySelectorAll<HTMLElement>('[role=menu]')].some((m) => m.offsetParent)
  )
    return // le menu Démarrer reste dans le DOM (v-show) : seul un menu visible compte
  const letter = normalizeKey(e.key)
  if (!letter) return
  const el = els[letter]
  const before = index.value
  validate(letter)
  const c = el && index.value !== before ? centerOf(el) : null
  if (c) {
    target.x = c.x
    target.y = c.y
  }
})

const expected = computed(() => nextLetter(word, index.value))

useRafFn(({ delta }) => {
  const dt = Math.min(delta, 50)
  const s = stage.value
  if (!s) return
  if (!placed) {
    target.x = pos.x = s.clientWidth / 2
    target.y = pos.y = s.clientHeight * 0.55
    placed = true
  }
  const goal = override ? centerOf(override) : null
  // À la fin, la goutte s’arrête à gauche d’AU REVOIR pour que le texte reste lisible.
  // Toujours ramenée dans la scène (overflow hidden) : la goutte ne doit jamais être rognée, quelle que soit sa cible.
  const { x: tx, y: ty } = clampDrop(goal ? (override === els[OUIJA_BYE] ? goal.left - 26 : goal.x) : target.x, goal ? goal.y : target.y, s.clientWidth, s.clientHeight)
  if (reduced.value) {
    pos.x = tx
    pos.y = ty
    pos.vx = pos.vy = 0
  } else {
    // Ressort presque critique (ζ ≈ 0,7, ~5 % de dépassement) : suit le pointeur avec du poids, sans rebondir.
    pos.vx += (tx - pos.x) * 0.012 * dt
    pos.vy += (ty - pos.y) * 0.012 * dt
    const damp = Math.exp(-dt * 0.0375)
    pos.vx *= damp
    pos.vy *= damp
    pos.x += pos.vx * dt * 0.06
    pos.y += pos.vy * dt * 0.06
  }
  // Le ressort peut dépasser un peu la cible : on borne aussi la position affichée.
  const at = clampDrop(pos.x, pos.y, s.clientWidth, s.clientHeight)
  if (dropEl.value) dropEl.value.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`
  // Survol de la lettre attendue (les autres sont ignorées) ; en pause pendant la dérive.
  const letter = expected.value
  const el = letter && !override && !isFinished() ? els[letter] : null
  const c = el ? centerOf(el) : null
  const over = !!c && pos.x >= c.left - 4 && pos.x <= c.right + 4 && pos.y >= c.top - 4 && pos.y <= c.bottom + 4
  const p = advanceDwell(dwell, over, dt)
  // Anneau de survol : variable CSS écrite directement sur la lettre (pas de rendu Vue à chaque image).
  if (p !== dwell && el) el.style.setProperty('--dwell', String(p))
  dwell = p
  if (p >= 1 && letter) validate(letter)
})
</script>

<template>
  <div ref="stage" class="ouija relative size-full overflow-hidden touch-none select-none flex flex-col items-center justify-center gap-3 sm:gap-5 px-2 font-title text-center">
    <p class="sr-only" aria-live="polite">{{ status }}</p>
    <p class="relative m-0 text-[#e8d9b0] text-sm tracking-[0.18em]" aria-hidden="true">Épelez le mot</p>
    <p class="relative m-0 flex gap-2 sm:gap-3 text-[2rem] sm:text-[2.6rem] leading-none text-[#d9b55a]" aria-hidden="true">
      <span
        v-for="(seg, i) in segments"
        :key="i"
        aria-hidden="true"
        class="inline-block min-w-[1.1em] border-0 border-b-[3px] border-solid pb-1"
        :class="seg.end <= index ? 'border-[#d9b55a]' : seg.start <= index ? 'border-[#e8d9b0] opacity-80' : 'border-[#d9b55a]/25 opacity-40'"
        >{{ seg.ch }}</span
      >
    </p>
    <div class="board relative flex flex-col items-center gap-1.5 sm:gap-2 px-2 py-3 sm:px-6 sm:py-5" role="group" aria-label="Planche Ouija">
      <div class="flex gap-10 sm:gap-16">
        <button :ref="setEl(OUIJA_YES)" type="button" class="key answer" :aria-label="OUIJA_YES" tabindex="-1">{{ OUIJA_YES }}</button>
        <button :ref="setEl(OUIJA_NO)" type="button" class="key answer" :aria-label="OUIJA_NO" tabindex="-1">{{ OUIJA_NO }}</button>
      </div>
      <div v-for="row in OUIJA_ROWS" :key="row" class="flex gap-1 sm:gap-1.5">
        <button v-for="l in row" :key="l" :ref="setEl(l)" type="button" class="key letter" :class="{ next: expected === l, 'no-motion': reduced }" :aria-label="`Lettre ${l}`" @click="validate(l)">
          {{ l }}
        </button>
      </div>
      <button :ref="setEl(OUIJA_BYE)" type="button" class="key answer bye" :class="{ lit: farewell, 'no-motion': reduced }" :aria-label="OUIJA_BYE" tabindex="-1">{{ OUIJA_BYE }}</button>
    </div>
    <span ref="dropEl" class="drop absolute left-0 top-0 pointer-events-none" aria-hidden="true">
      <IconGoutte class="drop-shape" />
    </span>
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
/* Lettre attendue : un anneau d’or se remplit pendant le survol (progression pilotée par --dwell, pas de clignotement). */
.letter.next {
  background: radial-gradient(circle, rgb(217 181 90 / calc(var(--dwell, 0) * 0.55)) 0 calc(var(--dwell, 0) * 75%), transparent calc(var(--dwell, 0) * 75% + 1px));
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
  filter: drop-shadow(0 6px 6px rgb(0 0 0 / 0.55));
}
.no-motion {
  transition-duration: 0s;
}
</style>
