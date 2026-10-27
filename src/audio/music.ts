import { effectScope, watch } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { orSecure, type Rng } from '../engine/rng'
import { ambienceDucked, fadeParam } from './ambience'
import { motifBusyUntil } from './motif'
import { playPhrase, type PhraseHandle } from './pianoVoice'
import { canStartPhrase, musicGap, phraseDuration, planPhrase } from './musicPlan'
import { ac, ambienceOut, muted } from './sfx'
import { stingerBusyUntil } from './stinger'

export { canStartPhrase, musicGap, planPhrase } from './musicPlan'

/** Cadence de la vérification (ms) : le piano part rarement, inutile de regarder plus souvent. */
const TICK_MS = 1000
/** Fondu (s) à la sourdine, à l’onglet caché, à l’arrêt. */
const FADE_QUICK = 0.3
const FADE_STOP = 1.5
/** Désaccord flottant (cents) des niveaux 3–4. */
const WOBBLE_CENTS = 6

/** Prochaine phrase (ms, horloge murale) : partagée, pour qu’un changement de lieu (remontage) ne remette pas le compte à zéro. */
let nextAtMs = 0
/** Phrase en cours (une seule à la fois, d’une instance à l’autre). */
let current: PhraseHandle | null = null

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
  if (nextAtMs === 0) nextAtMs = Date.now() + musicGap(rng) * 400
  const out = c.createGain()
  out.gain.value = 1
  out.connect(ambienceOut(c))

  const endMine = (fade: number) => {
    mine?.stop(fade)
    if (current === mine) current = null
    mine = null
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
    const notes = planPhrase(level, rng)
    const t0 = c.currentTime + 0.1
    mine = current = playPhrase(c, out, t0, notes, level >= 3 && level < 5 ? WOBBLE_CENTS : 0)
    const dur = phraseDuration(notes)
    motifBusyUntil.value = Math.max(motifBusyUntil.value, t0 + dur)
    nextAtMs = Date.now() + (dur + musicGap(rng)) * 1000
  }

  scope.run(() => {
    const visibility = useDocumentVisibility()
    watch(
      visibility,
      (v) => {
        hidden = v === 'hidden'
        if (hidden) endMine(FADE_QUICK)
      },
      { immediate: true },
    )
    watch(muted, (m) => m && endMine(FADE_QUICK))
    watch(ambienceDucked, (d) => d && endMine(FADE_QUICK))
    useIntervalFn(tick, TICK_MS)
  })

  return () => {
    if (stopped) return
    stopped = true
    scope.stop()
    endMine(FADE_STOP)
    fadeParam(out.gain, c.currentTime, 0, FADE_STOP)
    setTimeout(() => out.disconnect(), (FADE_STOP + 0.3) * 1000)
  }
}
