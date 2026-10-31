<script setup lang="ts">
// Invite commune des activités chronométrées : un verbe géant qui surgit au ressort puis s’efface, une barre de temps
// qui se vide en continu (animation CSS : aucune variation de luminance, seule la largeur change) et l’issue (réussite ou échec) affichée environ 1 s.
// L’issue est annoncée ici une seule fois (région role=status) : les activités ne la répètent pas.
import { computed, inject, nextTick, onMounted, ref, watch, useTemplateRef } from 'vue'
import { animate } from 'motion-v'
import { tryOnScopeDispose, useIntervalFn, useTimeoutFn, useWindowFocus } from '@vueuse/core'
import { AWAY_KEY } from '@/composables/useActivityDone'
import { focusQuietly } from '@/composables/focusQuietly'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { ACTIVITY_PROMPTS, type TimedActivity } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, durationOf, outcomeText, timeLeft, type Phase } from '@/engine/activityTiming'
import { useStinger } from '@/composables/useStinger'
import { releaseMusicTension, setMusicTension } from '@/audio/music'

// `paused` fige la barre (minuterie suspendue) ; `elapsed` donne le temps de jeu écoulé depuis la fin de la grâce (ms), pause comprise.
const {
  activity,
  outcome,
  startedAt,
  paused = false,
  elapsed = undefined,
  graceLeft = undefined,
} = defineProps<{ activity: TimedActivity; outcome: Phase; startedAt: number; paused?: boolean; elapsed?: () => number; graceLeft?: () => number }>()
const prompt = computed(() => ACTIVITY_PROMPTS[activity])
const duration = computed(() => durationOf(activity))
const announcement = computed(() => outcomeText(activity, outcome))
const reduced = useReducedMotion()

// Barre : l’animation CSS (`drain`) la vide en `duration` ms après un délai de grâce (`ACTIVITY_GRACE_MS`, le temps du verbe : la barre reste pleine),
// déjà entamée si le HUD monte après le départ du chrono (délai réduit) ; elle se fige à l’issue et pendant une pause (`animation-play-state`, délai compris). Seule la valeur accessible (aria-valuenow) passe par l’état, deux fois par seconde.
const elapsedAtMount = Date.now() - startedAt
// Durée et délai de l’animation, lus par le style via `v-bind()` (variables sur la racine du composant).
const drainMs = computed(() => `${duration.value}ms`)
const drainFrom = ref(`${ACTIVITY_GRACE_MS - elapsedAtMount}ms`)
// Clé de la barre : à chaque reprise elle est recréée avec un délai recalculé, donc sa largeur colle au temps restant réel même si la chronologie CSS a avancé pendant une pause (onglet caché).
const barKey = ref(0)
const playedMs = () => (elapsed ? elapsed() : Math.max(0, Date.now() - startedAt - ACTIVITY_GRACE_MS))
const left = ref(Math.round(timeLeft(playedMs(), duration.value) * 100))
watch(
  () => paused,
  (p) => {
    if (p || outcome !== 'play') return
    const played = playedMs()
    drainFrom.value = played > 0 ? `${-played}ms` : `${graceLeft ? graceLeft() : ACTIVITY_GRACE_MS}ms`
    barKey.value++
  },
  { flush: 'sync' },
)
// Tension de la musique (filtre passe-bas qui se ferme avec le temps) : suit la même mesure, au même rythme ; figée pendant une pause (`playedMs` ne bouge plus).
const updateTension = () => outcome === 'play' && setMusicTension(1 - timeLeft(playedMs(), duration.value))
const { pause: pauseTick } = useIntervalFn(() => {
  left.value = Math.round(timeLeft(playedMs(), duration.value) * 100)
  updateTension()
}, 500)
updateTension()
// Abandon en cours de jeu (sortie de la porte) : retour doux à l’ouvert ; après une issue, la réouverture déjà programmée suit son cours.
tryOnScopeDispose(() => outcome === 'play' && releaseMusicTension())
// Jingle en cours : coupé au démontage et si le son passe en muet pendant la lecture.
const stinger = useStinger()

// Fenêtre sans focus : useActivityDone suspend la minuterie et ne la relance qu’au bouton « Reprendre » (le temps de se préparer).
// Contrôleur fourni par useActivityDone ; sans lui (HUD monté seul, tests), repli inerte : jamais de voile.
const { away, resumeAway } = inject(AWAY_KEY, { away: ref(false), resumeAway: () => {} })
const focused = useWindowFocus()
const showPause = computed(() => away.value && outcome === 'play')
const resumeEl = useTemplateRef<HTMLElement>('resumeEl')
// Focus revenu : le bouton prend le focus (Entrée ou Espace reprend), sans anneau si la souris ou le doigt a ramené la fenêtre.
watch(
  [focused, showPause],
  async ([f, s]) => {
    if (!f || !s) return
    await nextTick()
    focusQuietly(resumeEl.value)
  },
  { flush: 'post' },
)
const pauseAnnouncement = computed(() => (showPause.value ? 'Jeu en pause.' : ''))
const verbEl = useTemplateRef<HTMLElement>('verbEl')
const resultEl = useTemplateRef<HTMLElement>('resultEl')
// Retrait : le verbe géant, centré, s’efface en fondu (léger grossissement) au lieu de se ranger en bas à gauche.
// Rangé, il restait loin du jeu sur grand écran et contredisait la consigne des fenêtres (« RETENEZ ! » pendant « À vous ! »).
// Un seul maître du transform : animate. Mouvement réduit : simple disparition, sans grossissement.
const dock = () => {
  const el = verbEl.value
  if (!el) return
  animate(el, reduced.value ? { opacity: 0 } : { opacity: 0, scale: 1.08 }, { duration: reduced.value ? 0.2 : 0.45, ease: 'easeIn' })
}
const { start: dockLater } = useTimeoutFn(dock, 800, { immediate: false })
onMounted(() => {
  if (reduced.value) return dockLater()
  if (verbEl.value) animate(verbEl.value, { scale: [0.2, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 520, damping: 11 })
  dockLater()
})

// Issue : arrêt de la barre, jingle, et surgissement au ressort du texte.
watch(
  () => outcome,
  async (o) => {
    if (o === 'play') return
    // Valeur finale exacte avant de figer la minuterie : sans cela, aria-valuenow garderait la dernière mesure (jusqu’à 500 ms de retard).
    left.value = o === 'fail' ? 0 : Math.round(timeLeft(playedMs(), duration.value) * 100)
    pauseTick()
    releaseMusicTension(o)
    stinger.play(o, o === 'win' ? (prompt.value.winStingerDelay ?? 0) : 0)
    await nextTick()
    if (resultEl.value && !reduced.value) animate(resultEl.value, { scale: [0.3, 1], rotate: o === 'win' ? [-6, 0] : [4, 0] }, { type: 'spring', stiffness: 480, damping: 9 })
  },
)
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-20 select-none" data-testid="activity-hud">
    <p class="sr-only" role="status">{{ pauseAnnouncement || announcement }}</p>
    <!-- verbe : plein centre à l’apparition, puis effacé en fondu -->
    <div class="absolute inset-0 flex items-center justify-center" :class="{ invisible: outcome !== 'play' }" aria-hidden="true">
      <p
        ref="verbEl"
        class="m-0 font-title font-bold text-center whitespace-nowrap text-[clamp(2.4rem,14vw,5.5rem)] leading-none text-amber-200 [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
      >
        {{ prompt.verb }}
      </p>
    </div>
    <!-- barre de temps : à gauche du bouton « Passer » ; le rouge de la fin (derniers 25 %) est dans l’animation.
         Pas de Progress de v0 ici : son Fill écrit lui-même `style.width` (même en renderless), ce qui entre en conflit avec l’animation `scaleX`
         et obligerait à mettre l’état à jour à chaque image ; la barre est donc un `role="progressbar"` natif dont seule la valeur accessible vit dans l’état. -->
    <div
      role="progressbar"
      aria-label="Temps restant"
      :aria-valuenow="left"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${left} %`"
      class="absolute bottom-3 left-3 right-32 sm:right-36 h-3.5 border-2 border-solid border-black bg-black/70 p-px"
    >
      <div :key="barKey" class="drain h-full origin-left" :style="{ animationDelay: drainFrom }" :class="{ paused: paused || outcome !== 'play' }" />
    </div>
    <!-- pause : la fenêtre a perdu le focus ; le voile capte les pointeurs (le clic qui ramène le focus ne touche pas le jeu), texte fixe, aucun clignotement -->
    <div v-if="showPause" class="pointer-events-auto absolute inset-0 grid place-content-center justify-items-center gap-3 bg-black/60 text-center" @pointermove.stop @pointerdown.stop @pointerup.stop>
      <p class="m-0 font-title font-bold text-[clamp(1.8rem,9vw,3.2rem)] leading-none text-amber-200 [text-shadow:0_3px_0_#000]">EN PAUSE</p>
      <p v-if="!focused" class="m-0 font-ui text-lg text-amber-100/80">Revenez dans la fenêtre.</p>
      <button ref="resumeEl" type="button" class="win-btn min-h-11 min-w-32 font-ui text-xl" @click="resumeAway">Reprendre</button>
    </div>
    <!-- issue -->
    <div v-if="outcome !== 'play'" class="absolute inset-x-0 bottom-14 flex justify-center px-4" aria-hidden="true">
      <p
        ref="resultEl"
        class="m-0 max-w-[22ch] rounded-lg border-2 border-solid border-amber-200 bg-[#0b0a10] px-4 py-2 text-center font-title font-bold leading-tight text-[clamp(1.5rem,7vw,2.6rem)] [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
        :class="outcome === 'win' ? 'text-emerald-300' : 'text-red-300'"
      >
        {{ announcement }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Vidage : transform seulement (compositeur), couleur fixée par paliers (ambre puis rouge à 75 % du temps écoulé). */
.drain {
  background-color: #fcd34d;
  animation: drain v-bind(drainMs) linear both;
}
.drain.paused {
  animation-play-state: paused;
}
@keyframes drain {
  from {
    transform: scaleX(1);
  }
  74.99% {
    background-color: #fcd34d;
  }
  75% {
    background-color: #ef4444;
  }
  to {
    transform: scaleX(0);
    background-color: #ef4444;
  }
}
/* Mouvement réduit : la barre avance par paliers au lieu de glisser. */
@media (prefers-reduced-motion: reduce) {
  .drain {
    animation-timing-function: steps(20, end);
  }
}
</style>
