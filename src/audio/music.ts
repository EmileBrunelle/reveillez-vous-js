import { effectScope, watch } from 'vue'
import { useDocumentVisibility, useIntervalFn, useTimeoutFn, type Pausable } from '@vueuse/core'
import { orSecure, type Rng } from '@/engine/rng'
import { ambienceDucked, fadeParam } from './ambience'
import { motifBusyUntil } from './motif'
import { playPhrase, type PhraseHandle } from './pianoVoice'
import { TENSION_OPEN_HZ, canStartPhrase, createSession, musicGap, phraseDuration, planPhrase, releaseBusy, resumeDelay, tensionCutoff, type MelodySession } from './musicPlan'
import { ac, ambienceOut, muted } from './sfx'
import { stingerBusyUntil } from './stinger'
import type { Outcome } from '@/engine/activityTiming'

export { canStartPhrase, musicGap, planPhrase } from './musicPlan'

/** Cadence de la vérification (ms) : le piano part rarement, inutile de regarder plus souvent. */
const TICK_MS = 1000
/** Fondu (s) à la sourdine, à l’onglet caché, à l’arrêt. */
const FADE_QUICK = 0.3
const FADE_STOP = 1.5
/**
 * Filtre de tension (réglable à l’oreille ; fréquences et courbe dans `musicPlan.ts` : TENSION_MIN_HZ, TENSION_OPEN_HZ, TENSION_CURVE).
 * Constantes de temps (s) de `setTargetAtTime` : suivi doux pendant l’activité, réouverture rapide à la réussite,
 * maintien (s) puis réouverture lente à l’échec, retour à l’ouvert (sourdine, onglet caché).
 */
const TENSION_TAU = 0.4
const TENSION_WIN_TAU = 0.13
const TENSION_FAIL_HOLD = 1.5
const TENSION_FAIL_TAU = 0.7
const TENSION_RESET_TAU = 0.1
/** Désaccord flottant (cents) des niveaux 3–4. */
const WOBBLE_CENTS = 6

/** Prochaine phrase (ms, horloge murale) : partagée, pour qu’un changement de lieu (remontage) ne remette pas le compte à zéro. */
let nextAtMs = 0
/** Phrase en cours (une seule à la fois, d’une instance à l’autre). */
let current: PhraseHandle | null = null
/** Motif de la session : le même tout le long du jeu, d’une instance à l’autre (changement de lieu). */
let session: MelodySession | null = null

/** Filtre de tension de l’instance en cours (null sans musique) : un nœud permanent sur la sortie de la musique seulement. */
let tensionFilter: { c: AudioContext; node: BiquadFilterNode } | null = null
/** Dernière tension demandée (null = ouvert) : réappliquée quand l’onglet redevient visible ou que le son revient en pleine activité. */
let wantedTension: number | null = null
/** Vrai tant que l’onglet est caché : les demandes de tension sont ignorées. */
let tensionBlocked = false

/** Pousse la coupure vers `hz` (> 0) avec la constante `tau`, à partir de la valeur courante, après un éventuel `delay` (s) pendant lequel elle reste figée. */
const glideCutoff = (hz: number, tau: number, delay = 0) => {
  const f = tensionFilter
  if (!f) return
  const p = f.node.frequency
  const now = f.c.currentTime
  p.cancelScheduledValues(now)
  p.setValueAtTime(Math.max(1, p.value), now)
  p.setTargetAtTime(Math.max(1, hz), now + delay, Math.max(0.01, tau))
}

/**
 * Tension de l’activité chronométrée (0 = début, 1 = fin du temps) : ferme doucement le passe-bas de la musique. Sans effet
 * (et sans erreur) si la musique ne joue pas, en sourdine ou onglet caché ; NaN et valeurs hors bornes sont ramenés dans [0 ; 1].
 */
export const setMusicTension = (t: number) => {
  wantedTension = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  if (!tensionFilter || muted.value || tensionBlocked) return
  glideCutoff(tensionCutoff(wantedTension), TENSION_TAU)
}

/** Fin d’activité : réussite = réouverture rapide ; échec = reste fermé un instant puis se rouvre lentement ; autre = retour doux à l’ouvert. */
export const releaseMusicTension = (outcome?: Outcome) => {
  wantedTension = null
  if (outcome === 'win') glideCutoff(TENSION_OPEN_HZ, TENSION_WIN_TAU)
  else if (outcome === 'fail') glideCutoff(TENSION_OPEN_HZ, TENSION_FAIL_TAU, TENSION_FAIL_HOLD)
  else glideCutoff(TENSION_OPEN_HZ, TENSION_RESET_TAU)
}

/**
 * Piano clairsemé en fond : une courte phrase toutes les 40–90 s, sur le bus d’ambiance (même curseur). Ne démarre jamais sur un leitmotif
 * ou un jingle (`motifBusyUntil`, `stingerBusyUntil`) et occupe `motifBusyUntil` pendant qu’il joue ; se tait en sourdine, onglet caché
 * ou finale. Renvoie la fonction d’arrêt (idempotente, fondu sans clic).
 */
export const startMusic = (getLevel: () => number = () => 1, rng: Rng = orSecure()): (() => void) => {
  const c = ac()
  if (!c) return () => undefined
  const scope = effectScope(true)
  let stopped = false
  let hidden = false
  let mine: PhraseHandle | null = null
  /** Occupation posée par ma phrase et valeur d’avant, pour la rabaisser si elle est coupée. */
  let myBusy = 0
  let prevBusy = 0
  if (nextAtMs === 0) nextAtMs = Date.now() + musicGap(rng) * 400
  const out = c.createGain()
  out.gain.value = 1
  // filtre de tension : permanent, ouvert par défaut (18 kHz ≈ transparent) ; un seul à la fois d’une instance à l’autre
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = TENSION_OPEN_HZ
  filter.Q.value = 0 // passe-bas : Q en dB ; 0 = aucune résonance (pas de bosse à la coupure)
  out.connect(filter)
  filter.connect(ambienceOut(c))
  const mineFilter = { c, node: filter }
  tensionFilter = mineFilter
  if (wantedTension !== null) glideCutoff(tensionCutoff(wantedTension), TENSION_TAU)
  /** Retour à l’ouvert sans clic (sourdine, onglet caché) ; la tension voulue est conservée et réappliquée au retour. */
  const openFilter = () => tensionFilter === mineFilter && glideCutoff(TENSION_OPEN_HZ, TENSION_RESET_TAU)
  const restoreFilter = () => {
    if (tensionFilter === mineFilter && wantedTension !== null) glideCutoff(tensionCutoff(wantedTension), TENSION_TAU)
  }

  const endMine = (fade: number) => {
    if (!mine) return
    mine.stop(fade)
    motifBusyUntil.value = releaseBusy(motifBusyUntil.value, myBusy, prevBusy)
    if (current === mine) current = null
    mine = null
  }

  const delayResume = () => {
    nextAtMs = Math.max(nextAtMs, Date.now() + resumeDelay(rng) * 1000)
  }

  const tick = () => {
    if (stopped) return
    if (mine && c.currentTime >= mine.end) {
      mine = null
      current = null
    }
    if (mine || current) return
    const ok = canStartPhrase({
      nowMs: Date.now(),
      nextAtMs,
      ctxTime: c.currentTime,
      motifBusyUntil: motifBusyUntil.value,
      stingerBusyUntil: stingerBusyUntil.value,
      muted: muted.value,
      hidden,
      ducked: ambienceDucked.value,
      running: c.state === 'running',
    })
    if (!ok) return
    const level = getLevel()
    session ??= createSession()
    const notes = planPhrase(level, rng, session)
    const t0 = c.currentTime + 0.1
    mine = current = playPhrase(c, out, t0, notes, level >= 3 && level < 5 ? WOBBLE_CENTS : 0)
    const dur = phraseDuration(notes)
    prevBusy = motifBusyUntil.value
    myBusy = Math.max(prevBusy, t0 + dur)
    motifBusyUntil.value = myBusy
    nextAtMs = Date.now() + (dur + musicGap(rng)) * 1000
  }

  let ticker: Pausable | undefined
  scope.run(() => {
    const visibility = useDocumentVisibility()
    watch(
      visibility,
      (v) => {
        hidden = v === 'hidden'
        tensionBlocked = hidden
        if (hidden) {
          endMine(FADE_QUICK)
          openFilter()
        } else {
          delayResume()
          restoreFilter()
        }
      },
      { immediate: true },
    )
    watch(muted, (m) => {
      if (m) {
        endMine(FADE_QUICK)
        openFilter()
      } else {
        delayResume()
        restoreFilter()
      }
    })
    watch(ambienceDucked, (d) => (d ? endMine(FADE_QUICK) : delayResume()))
    // un jingle ou un leitmotif qui démarre coupe la phrase en cours (sauf l’occupation posée par ma propre phrase)
    watch(stingerBusyUntil, (v) => v > c.currentTime && endMine(FADE_QUICK))
    watch(motifBusyUntil, (v) => mine && v !== myBusy && v > c.currentTime && endMine(FADE_QUICK))
    ticker = useIntervalFn(tick, TICK_MS)
  })

  return () => {
    if (stopped) return
    stopped = true
    ticker?.pause()
    endMine(FADE_STOP)
    // finale ou démontage : le filtre s’en va avec le bus (pas de réouverture, le fondu coupe tout)
    if (tensionFilter === mineFilter) tensionFilter = null
    fadeParam(out.gain, c.currentTime, 0, FADE_STOP)
    // la portée reste vivante jusqu’à la libération du bus : arrêter le propriétaire annulerait la minuterie
    scope.run(() => {
      const { start } = useTimeoutFn(
        () => {
          out.disconnect()
          filter.disconnect()
          scope.stop()
        },
        (FADE_STOP + 0.3) * 1000,
        { immediate: false },
      )
      start()
    })
  }
}
