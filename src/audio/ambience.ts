import { effectScope, ref, watch } from 'vue'
import { useDocumentVisibility, useEventListener, useTimeoutFn } from '@vueuse/core'
import type { PlaceId } from '../effects/places/types'
import { ac, ambienceOut, effetsOut, muted } from './sfx'
import { motifBusyUntil, motifWarning, playMotif } from './motif'
import { EVENT_BOOST, MASTER_GAIN, RECIPES, beds, bedGain, createTracker, events, gainNode, osc, rareSounds, randomDelay, type Env } from './ambienceSynth'
import {
  BASS_PARTIALS,
  PAD_DEPTH,
  PAD_VOICES,
  RARE_BOOST,
  WARNING_DUCK_DB,
  WARNING_DUCK_DOWN,
  WARNING_DUCK_UP,
  nextRareDelay,
  nextWarningDelay,
  padGain,
  pickRareKind,
  subGain,
  warningAllowed,
  type RareKind,
} from './paranoiaAudio'

// Cycle de vie d’une ambiance de lieu : fondus, minuteries des événements, sourdine, visibilité de l’onglet, arrêt.
// Les sons eux-mêmes (recettes, lits, événements) sont synthétisés dans `ambienceSynth.ts`.

/** Durées des fondus (s) : entrée d’un lieu, fondu enchaîné d’un lieu à l’autre, départ (porte fermée, finale), sourdine. */
export const FADE_IN = 2.5
export const FADE_XFADE = 2
export const FADE_OUT = 2
export const FADE_MUTE = 0.25
/** Fondu bref quand l’onglet se cache ou revient. */
const FADE_HIDDEN = 0.5
/** Nombre de segments d’un fondu (rampes linéaires approchant le quart de cosinus / sinus). */
const FADE_STEPS = 24
/** Montée/descente de la basse et de la nappe entre deux niveaux : très lente. */
const TC_SUB = 2
const STOP_AFTER_MS = FADE_OUT * 1000 + 150
/** Espacement minimal entre deux événements d’un même lieu. */
const MIN_SPACING_MS = 3000
/** Un lieu qui démarre moins de 250 ms après un arrêt est un changement de lieu (fondu enchaîné). */
const XFADE_WINDOW_MS = 250

/** Mis à `true` par la finale : toutes les ambiances (y compris celles qui démarrent pendant la finale) se taisent. */
export const ambienceDucked = ref(false)

/** Niveau cible du bus : 0 si coupé, onglet caché, arrêté ou étouffé par la finale. */
export const targetLevel = (s: { muted: boolean; hidden: boolean; stopped: boolean; ducked?: boolean }) => (s.muted || s.hidden || s.stopped || s.ducked ? 0 : MASTER_GAIN)

/**
 * Programme un fondu à puissance constante vers `target` en `dur` s : part de la valeur courante (annule les rampes en cours,
 * donc aucun saut si l’on change d’avis en plein fondu), montée en sinus (quart d’onde), descente en cosinus.
 */
export const fadeParam = (param: AudioParam, now: number, target: number, dur: number) => {
  const v0 = param.value
  param.cancelScheduledValues(now)
  param.setValueAtTime(v0, now)
  if (v0 === target || dur <= 0) {
    param.setValueAtTime(target, now + Math.max(dur, 0))
    return
  }
  const up = target > v0
  for (let i = 1; i <= FADE_STEPS; i++) {
    const x = i / FADE_STEPS
    const shape = up ? Math.sin((Math.PI / 2) * x) : 1 - Math.cos((Math.PI / 2) * x)
    param.linearRampToValueAtTime(i === FADE_STEPS ? target : v0 + (target - v0) * shape, now + dur * x)
  }
}

/** Horodatage du dernier arrêt, pour reconnaître un changement de lieu. */
let lastStopAt = -Infinity

/**
 * Ambiance sonore d’un lieu, synthétisée (Web Audio) : un lit continu très bas + événements rares (longs silences).
 * Fondu d’entrée 2,5 s (2 s si le lieu en remplace un autre : fondu enchaîné à puissance constante), de sortie 2 s ; suit `muted` et la visibilité de l’onglet ; attend que le
 * contexte soit déverrouillé. Renvoie la fonction d’arrêt (idempotente).
 *
 * Minuteries, observateurs et écouteurs vivent dans une portée détachée (`scope`) : l’arrêter les nettoie tous.
 */
export const startAmbience = (place: PlaceId, getLevel: () => number = () => 1): (() => void) => {
  const c = ac()
  if (!c) return () => undefined

  const t = createTracker()
  const scope = effectScope(true)
  let stopped = false
  let hidden = false
  let lastEventAt = -Infinity
  const crossfade = Date.now() - lastStopAt < XFADE_WINDOW_MS

  const master = c.createGain()
  master.gain.value = 0
  master.connect(ambienceOut(c))

  const level = () => targetLevel({ muted: muted.value, hidden, stopped, ducked: ambienceDucked.value })
  // un fondu n’est relancé que si la cible change : un `statechange` du contexte ne doit pas écraser un fondu en cours (sourdine, départ)
  let lastTarget = Number.NaN
  const ramp = (dur: number) => {
    const target = level()
    if (target === lastTarget) return
    lastTarget = target
    fadeParam(master.gain, c.currentTime, target, dur)
  }
  const running = () => c.state === 'running' && level() > 0
  /** Vrai (et date l’événement) si l’espacement minimal depuis le dernier son d’ambiance est respecté. */
  const spaced = () => {
    const now = Date.now()
    if (now - lastEventAt < MIN_SPACING_MS) return false
    lastEventAt = now
    return true
  }
  const retryDelay = (extra: number) => MIN_SPACING_MS / 1000 + Math.random() * extra

  /** Minuterie ré-armable à délai variable : `fire` rend le prochain délai (s), ou `null` pour ne plus l’armer. À créer dans `scope`. */
  const useRearmed = (fire: () => number | null) => {
    const interval = ref(0)
    const timer = useTimeoutFn(
      () => {
        if (stopped) return
        arm(fire())
      },
      interval,
      { immediate: false },
    )
    const arm = (seconds: number | null) => {
      timer.stop()
      if (seconds === null) return
      interval.value = seconds * 1000
      timer.start()
    }
    return arm
  }

  // bus à part pour chaque famille de sons, tous branchés sur `master`
  const bus = (gain: number) => {
    const g = t.add(c.createGain())
    g.gain.value = gain
    g.connect(master)
    return g
  }
  const base: Omit<Env, 'out'> = {
    c,
    t,
    // un événement de lieu récurrent ; le premier arrive plus tôt (30 % du délai)
    every: (min, max, fn) => {
      const arm = useRearmed(() => {
        if (!running()) return randomDelay(min, max)
        if (!spaced()) return retryDelay(2)
        fn()
        return randomDelay(min, max)
      })
      arm(randomDelay(min * 0.3, max * 0.3))
    },
  }
  const envOn = (out: AudioNode): Env => ({ ...base, out })

  // Basse fantôme (fondamentale + harmoniques) et nappe tonale médium : toujours construites, gains par paliers (changement lent, ≈ 6 s)
  const sub = t.add(c.createGain())
  sub.gain.value = 0
  const e = envOn(master)
  for (const [hz, amp] of BASS_PARTIALS) osc(e, 'sine', hz).connect(gainNode(e, amp)).connect(sub)
  const pad = t.add(c.createGain())
  pad.gain.value = 0
  // gain à part pour l’avertissement : basse et nappe baissent ensemble sans toucher à leurs paliers par niveau
  const paraDuck = t.add(c.createGain())
  pad.connect(paraDuck)
  sub.connect(paraDuck)
  paraDuck.connect(master)
  for (const v of PAD_VOICES) {
    // enflure lente propre à chaque voix : gain = amp × (1 + PAD_DEPTH × sinus de période ≥ 9 s)
    const vg = gainNode(e, v.amp)
    osc(e, 'sine', v.hz).connect(vg).connect(pad)
    osc(e, 'sine', 1 / v.period)
      .connect(gainNode(e, v.amp * PAD_DEPTH))
      .connect(vg.gain)
  }
  // lits : ramenés sous la nappe aux niveaux 2+ ; événements de lieu : surélevés pour dépasser le lit ; sons rares : plus forts encore
  const bedBus = bus(bedGain(getLevel()))
  const eventBus = bus(EVENT_BOOST)
  const rareBus = bus(RARE_BOOST)
  const slow = (param: AudioParam, v: number) => {
    param.cancelScheduledValues(c.currentTime)
    param.setTargetAtTime(v, c.currentTime, TC_SUB)
  }
  const rampSub = () => {
    slow(sub.gain, subGain(getLevel()))
    slow(pad.gain, padGain(getLevel()))
    slow(bedBus.gain, bedGain(getLevel()))
  }
  rampSub()

  scope.run(() => {
    for (const b of RECIPES[place].beds) beds[b](envOn(bedBus), RECIPES[place])
    for (const ev of RECIPES[place].events) base.every(ev.min, ev.max, () => events[ev.kind](envOn(eventBus)))

    // Sons rares (niveaux 3+) : une seule minuterie, ré-armée à chaque tour, un son à la fois
    let lastRare: RareKind | null = null
    const armRare = useRearmed(() => {
      if (running()) {
        if (!spaced()) return retryDelay(2)
        lastRare = pickRareKind(lastRare)
        rareSounds[lastRare](envOn(rareBus))
      }
      return nextRareDelay(getLevel())
    })

    // Avertissement rare (niveaux 3+) : le motif grave et lent ; la nappe baisse pendant qu’il joue, puis remonte
    const unduckDelay = ref(0)
    const unduck = useTimeoutFn(() => fadeParam(paraDuck.gain, c.currentTime, 1, WARNING_DUCK_UP), unduckDelay, { immediate: false })
    const armWarning = useRearmed(() => {
      if (running() && warningAllowed(getLevel()) && Date.now() - lastEventAt >= MIN_SPACING_MS && motifBusyUntil.value <= c.currentTime) {
        lastEventAt = Date.now()
        const dur = playMotif(c, effetsOut(c), motifWarning())
        fadeParam(paraDuck.gain, c.currentTime, 10 ** (WARNING_DUCK_DB / 20), WARNING_DUCK_DOWN)
        unduckDelay.value = Math.max(dur - WARNING_DUCK_UP * 0.5, WARNING_DUCK_DOWN) * 1000
        unduck.start()
        return nextWarningDelay(getLevel())
      }
      return retryDelay(5)
    })
    armRare(nextRareDelay(getLevel()))
    armWarning(nextWarningDelay(getLevel()))

    // un `statechange` du contexte (déverrouillage, reprise) relance l’entrée en fondu si la cible a changé
    useEventListener(c, 'statechange', () => ramp(FADE_IN))
    ramp(crossfade ? FADE_XFADE : FADE_IN)

    const visibility = useDocumentVisibility()
    watch(
      visibility,
      (v, old) => {
        hidden = v === 'hidden'
        // premier appel : l’entrée (ou le fondu enchaîné) déjà programmée prime, sauf si l’onglet est caché d’emblée
        if (old !== undefined || hidden) ramp(FADE_HIDDEN)
      },
      { immediate: true },
    )
    watch(getLevel, () => {
      rampSub()
      armRare(nextRareDelay(getLevel()))
      armWarning(nextWarningDelay(getLevel()))
    })
    watch(muted, () => ramp(FADE_MUTE))
    watch(ambienceDucked, (d) => ramp(d ? FADE_OUT : FADE_IN))
  })

  return () => {
    if (stopped) return
    stopped = true
    scope.stop() // minuteries, écouteur et observateurs
    lastStopAt = Date.now()
    ramp(FADE_OUT)
    // setTimeout simple : la libération doit survivre à `scope.stop()` (fondu de sortie), et il n’y a plus de portée pour la porter
    setTimeout(() => {
      t.dispose()
      master.disconnect()
    }, STOP_AFTER_MS)
  }
}
