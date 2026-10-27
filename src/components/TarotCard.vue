<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { animate } from 'motion-v'
import TarotEmblem from './TarotEmblem.vue'
import TarotCardBack from './TarotCardBack.vue'
import { emblemMask } from './emblemMask'
import { cardFlip, cardThud } from '../audio/sfx'
import type { Arcane } from '../engine/prophecy'
import type { Paquet } from '../engine/paquets'
import { useReducedMotion } from '../composables/useReducedMotion'
import { createLanding } from '../composables/cardLanding'
import { useCardGlitch } from '../composables/useCardGlitch'
import { useCardTilt } from '../composables/useCardTilt'
import { useFitBody } from '../composables/useFitBody'
import { useSessionStore } from '../stores/session'

// La carte arrive de la coupe (DeckCut) déjà en place, dos visible, identique : rien à poser, on la retourne tout de suite (voir deal).
const { arcane, title, body, level = 1, paquet = 'nuit' } = defineProps<{ arcane: Arcane; title: string; body: string; verse: string; level?: number; paquet?: Paquet }>()
const emit = defineEmits<{ flipped: [] }>()
const reduced = useReducedMotion()
const session = useSessionStore()
const shimmerEl = useTemplateRef<HTMLElement>('shimmerEl')
// `will-change` seulement pendant le reflet : une couche GPU permanente pour une animation de 750 ms coûte de la mémoire pour rien.
const shimmering = ref(false)
// Pose de la carte, une seule fois par retournement : bruit sourd (toujours), ondulation CRT et reflet (jamais en mouvement réduit).
// Le reflet anime son propre élément (`.tarot__shimmer`) : ni `deal`, ni `tilt`, ni `flip` ne sont touchés, donc aucun transform partagé avec l’inclinaison.
const landing = createLanding({
  reduced: () => reduced.value,
  thud: cardThud,
  ripple: (amp) => session.pulse(amp),
  shimmer: () => {
    const a = shimmerEl.value?.animate(
      [
        { transform: 'translateX(-130%)', opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, offset: 0.7 },
        { transform: 'translateX(130%)', opacity: 0 },
      ],
      { duration: 750, easing: 'ease-in-out' },
    )
    if (!a) return
    shimmering.value = true
    void a.finished.then(
      () => (shimmering.value = false),
      () => (shimmering.value = false),
    )
  },
})

const root = useTemplateRef<HTMLElement>('root')
const dealEl = useTemplateRef<HTMLElement>('dealEl')
const tiltEl = useTemplateRef<HTMLElement>('tiltEl')
const flipEl = useTemplateRef<HTMLElement>('flipEl')
const panelEl = useTemplateRef<HTMLElement>('panelEl')
const bodyEl = useTemplateRef<HTMLElement>('bodyEl')

// `faceUp` pilote l’aria, les faces visibles et le hoquet ; il suit le retournement (il passe à vrai en cours de route).
const faceUp = ref(false)
const settled = ref(false)

// Taille du titre selon sa longueur (unités de largeur du conteneur) ; celle du corps est ajustée en px par useFitBody.
const maskUrl = computed(() => emblemMask(arcane.symbole))
const titleSize = computed(() => {
  const n = title.length
  return n < 40 ? 5.4 : n < 70 ? 4.6 : 3.9
})
const { bodyPx, emblem } = useFitBody({ root, panel: panelEl, body: bodyEl, sources: [() => body, () => title] })
const { releasing, onTouchDown, wasDrag } = useCardTilt({ root, tilt: tiltEl, settled, reduced })
useCardGlitch({ root, level: () => level, faceUp, reduced })

// Les quatre coins dorés (losanges posés sur les angles du cadre).
const CORNERS = ['top-[-1.5cqw] left-[-1.5cqw]', 'top-[-1.5cqw] right-[-1.5cqw]', 'bottom-[-1.5cqw] left-[-1.5cqw]', 'bottom-[-1.5cqw] right-[-1.5cqw]']

let skipped = false
let running: { stop: () => void }[] = []
let timer = 0
const go = (el: Element | null | undefined, kf: Record<string, unknown>, opt: Record<string, unknown> = {}) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const snap = (el: Element | null | undefined, kf: Record<string, unknown>) => go(el, kf, { duration: 0 })
const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))

// Face visible, sans animation.
const rest = () => {
  snap(dealEl.value, { x: 0, y: 0, scale: 1, rotateZ: 0, opacity: 1 })
  snap(flipEl.value, { rotateY: 180 })
  faceUp.value = true
  settled.value = true
}

const flip = async () => {
  if (reduced.value) {
    rest()
    landing.land()
    emit('flipped')
    return
  }
  settled.value = false
  landing.arm()
  cardFlip()
  const lift = go(dealEl.value, { scale: [1, 1.14, 0.97, 1.04, 1], rotateZ: [0, -3, 2, -1, 0] }, { duration: 0.6, ease: 'easeOut' })
  const turn = go(flipEl.value, { rotateY: 180 }, { type: 'spring', stiffness: 120, damping: 9.5 })
  await wait(180)
  if (skipped) return
  faceUp.value = true
  await Promise.all([lift, turn])
  if (skipped) return
  settled.value = true
  landing.land()
  emit('flipped')
}

// Relais de la coupe : la carte est déjà à sa place, dos visible ; on la retourne après une courte pause.
const deal = async () => {
  settled.value = true
  await wait(150)
  if (skipped) return
  await flip()
}

// Un toucher ou un clic termine tout de suite l’animation de retournement (raccourci : la carte se retourne seule, rien n’exige ce geste).
const skip = () => {
  if (skipped) return
  skipped = true
  window.clearTimeout(timer)
  running.forEach((r) => r.stop())
  running = []
  rest()
}
// Un glissement n’est pas un tap : pas de skip à la fin du geste.
const onCardClick = () => {
  if (wasDrag()) return
  skip()
}

onMounted(() => void deal())
onUnmounted(() => {
  skipped = true
  window.clearTimeout(timer)
  running.forEach((r) => r.stop())
})
</script>

<template>
  <div
    ref="root"
    class="tarot relative aspect-[7/12]"
    :data-emblem="emblem || undefined"
    :class="[`tarot--l${level}`, `tarot--${paquet}`, { 'touch-pinch-zoom': settled && !reduced }]"
    @click="onCardClick"
    @pointerdown="onTouchDown"
  >
    <div class="tarot__sr absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">
      {{ faceUp ? `Carte retournée : ${arcane.nom}.` : '' }}
    </div>
    <div class="tarot__stage absolute inset-0 [perspective:1100px]">
      <div ref="dealEl" class="tarot__deal absolute inset-0 [transform-style:preserve-3d]">
        <div ref="tiltEl" class="tarot__tilt absolute inset-0 [transform-style:preserve-3d]" :class="{ 'tarot__tilt--releasing': releasing }">
          <div ref="flipEl" class="tarot__flip absolute inset-0 [transform-style:preserve-3d]">
            <div
              class="tarot__face tarot__front absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_var(--tarot-ink)] [background:var(--tarot-paper)] [color:var(--tarot-ink)] text-left"
              :class="{ 'tarot__face--up': faceUp }"
              :aria-hidden="!faceUp"
            >
              <div
                class="tarot__content absolute inset-[1.6cqw] [border:0.6cqw_solid_var(--tarot-gold)] [outline:0.5cqw_solid_var(--tarot-ink)] [outline-offset:-2.2cqw] flex flex-col items-center [padding:3.4cqw_4.6cqw_0] gap-[1.6cqw] font-card"
                :style="{ '--title': `${titleSize}cqw` }"
              >
                <span v-for="c in CORNERS" :key="c" class="tarot__corner absolute size-[3.4cqw] [background:var(--tarot-gold)] [transform:rotate(45deg)]" :class="c" />
                <div class="tarot__numero font-title text-[6cqw] font-bold tracking-[0.15em] leading-none [padding:0.6cqw_4cqw] [border-block:0.5cqw_solid_var(--tarot-gold)]">{{ arcane.numero }}</div>
                <div class="tarot__emblem [flex:0_0_24cqw] w-[24cqw] [color:var(--tarot-ink)]" :style="{ '--emblem-mask': maskUrl }"><TarotEmblem :symbole="arcane.symbole" /></div>
                <h2 class="tarot__title font-title m-0 [font-size:var(--title)] leading-[1.15] text-center uppercase [overflow-wrap:anywhere]" :data-text="title">{{ title }}</h2>
                <div
                  ref="panelEl"
                  class="tarot__panel [flex:1_1_0] min-h-0 w-full overflow-hidden flex [background:rgb(255_249_228/0.6)] [border:0.5cqw_solid_var(--tarot-gold)] [padding:2cqw_2.4cqw]"
                >
                  <p ref="bodyEl" :style="bodyPx ? { fontSize: `${bodyPx}px` } : undefined" class="tarot__body [margin:auto_0] text-[16px] leading-[1.3] [color:#170a2b] [overflow-wrap:anywhere]">
                    {{ body }}
                  </p>
                </div>
                <p class="tarot__verse m-0 text-[3.8cqw] italic text-right self-stretch">— {{ verse }}</p>
                <div
                  class="tarot__banner font-title self-stretch [margin:0_-4.6cqw] [padding:1.8cqw_2cqw] [background:var(--tarot-ink)] [color:var(--tarot-paper)] text-center text-[4.2cqw] font-bold uppercase tracking-[0.06em] [overflow-wrap:anywhere] leading-[1.15]"
                >
                  {{ arcane.nom }}
                </div>
              </div>
              <div class="tarot__glare" />
              <div ref="shimmerEl" class="tarot__shimmer absolute inset-0 pointer-events-none opacity-0" :class="{ 'will-change-[transform,opacity]': shimmering }" />
            </div>
            <!-- Dos : le même visuel que les cartes de DeckCut (TarotCardBack). -->
            <div class="tarot__face tarot__back absolute inset-0" :class="{ 'tarot__face--up': faceUp }" :aria-hidden="faceUp">
              <TarotCardBack fill :paquet="paquet" class="absolute inset-0">
                <div class="tarot__glare" />
              </TarotCardBack>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reste ici: chaîne 3D, containment, variables pilotées par JS, sélecteurs data-emblem, dégradés. Le reste est en utilitaires dans le template. */
.tarot {
  --tarot-ink: #1f1038;
  --tarot-gold: #b9821a;
  --tarot-paper: #f3e3b3;
  /* S’inscrit dans son emplacement (conteneur de taille) en gardant le ratio 7:12. */
  width: min(100cqw, calc(100cqh * 7 / 12));
  /* Le containment vit ici, HORS de la chaîne 3D (Firefox aplatit preserve-3d à travers un élément contenu). */
  container-type: inline-size;
}
.tarot__tilt {
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 0.12s ease-out;
  --glare: 0;
}
.tarot__tilt--releasing {
  /* Relâché : retour au repos sur ressort doux, le temps du retour (650 ms). */
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tarot__face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
/* Ceinture et bretelles : visibilité explicite par face, au cas où un navigateur aplatit le contexte 3D et ignore backface-visibility. */
.tarot__front:not(.tarot__face--up),
.tarot__back.tarot__face--up {
  visibility: hidden;
}
.tarot__front {
  transform: rotateY(180deg);
}
.tarot[data-emblem='small'] .tarot__emblem {
  flex-basis: 12cqw;
  width: 12cqw;
}
.tarot[data-emblem='none'] .tarot__emblem {
  display: none;
}
.tarot__glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: var(--glare, 0);
  transition: opacity 0.2s;
  background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.3), rgb(255 255 255 / 0) 55%);
}
/* Reflet unique à la pose : une bande diagonale douce, animée en JS (WAAPI) sur son propre élément, une seule fois, jamais en mouvement réduit. */
.tarot__shimmer {
  background: linear-gradient(115deg, transparent 35%, rgb(255 250 225 / 0.35) 50%, transparent 65%);
}
/* Teinte du paquet choisi : l’encre et le papier (discrets) et la teinte du reflet ; le cadre doré reste doré. */
.tarot--feu {
  --tarot-ink: #3a1410;
  --tarot-paper: #f5ddae;
  --foil-hue: -35deg;
}
.tarot--brume {
  --tarot-ink: #0f2b28;
  --tarot-paper: #e8e5bd;
  --foil-hue: 70deg;
}
/* Reflet holographique (CSS seul) sur l’or : cadre, coins, bandeau du numéro et emblème. Chaque pseudo-élément superpose le même dégradé
   (--foil) en color-dodge, découpé aux zones dorées par un masque ; sa position suit --gx/--gy (pointeur ou gyroscope) et son intensité --glare.
   Aucune animation autonome : la luminosité ne change que si l’utilisateur incline ou déplace le pointeur. Aucun effet sur la mise en page
   (éléments absolus, sans débordement du panneau mesuré par fitBody). */
.tarot {
  --foil:
    repeating-linear-gradient(115deg, hsl(330 100% 50%) 0, hsl(45 100% 45%) 7cqw, hsl(130 100% 45%) 14cqw, hsl(200 100% 50%) 21cqw, hsl(270 100% 50%) 28cqw, hsl(330 100% 50%) 35cqw),
    conic-gradient(from 30deg at var(--gx, 50%) var(--gy, 50%), hsl(330 100% 50%), hsl(60 100% 45%), hsl(150 100% 45%), hsl(210 100% 50%), hsl(280 100% 50%), hsl(330 100% 50%));
  --foil-base: 0.18;
  --foil-k: 0.4;
}
.tarot--l2 {
  --foil-k: 0.46;
}
.tarot--l3 {
  --foil-k: 0.52;
}
.tarot--l4 {
  --foil-k: 0.58;
}
.tarot--l5 {
  --foil-k: 0.64;
}
.tarot__content::after,
.tarot__corner::after,
.tarot__numero::after,
.tarot__emblem::after {
  content: '';
  position: absolute;
  pointer-events: none;
  background: var(--foil);
  background-size: 70cqw 70cqw;
  background-position: var(--gx, 50%) var(--gy, 50%);
  filter: hue-rotate(var(--foil-hue, 0deg));
  mix-blend-mode: color-dodge;
  opacity: calc(var(--foil-base) + var(--glare, 0) * var(--foil-k));
  transition: opacity 0.2s;
}
/* Cadre : l’anneau de la bordure seulement (zone de remplissage moins zone de contenu). */
.tarot__content::after {
  inset: -0.6cqw;
  padding: 0.6cqw;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.tarot__corner::after {
  inset: 0;
}
.tarot__numero {
  position: relative;
}
.tarot__numero::after {
  inset: -0.5cqw 0;
  padding: 0.5cqw 0;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.tarot__emblem {
  position: relative;
}
.tarot__emblem::after {
  inset: 0;
  mask: var(--emblem-mask) center / contain no-repeat;
  opacity: calc(var(--foil-base) * 1.5 + var(--glare, 0) * var(--foil-k) * 1.3);
}

@media (prefers-reduced-motion: reduce) {
  .tarot__tilt {
    transition: none;
  }
  /* Reflet statique : pas de suivi du pointeur, intensité moyenne fixe. */
  .tarot {
    --foil-base: 0.4;
  }
  .tarot__content::after,
  .tarot__corner::after,
  .tarot__numero::after,
  .tarot__emblem::after {
    transition: none;
  }
}
</style>
