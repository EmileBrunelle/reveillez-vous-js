import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// `useIdle` de VueUse écoute `window` et ne démarre que si `window` et `document` existent à l’import : l’environnement de test est node.
// Un EventTarget fait office de `window` (les événements s’y envoient directement).
const env = vi.hoisted(() => {
  const target = new EventTarget()
  // Le document est aussi un EventTarget : `useDocumentVisibility` y écoute `visibilitychange`.
  // `hasFocus` : lu par `useWindowFocus` (pause quand la fenêtre perd le focus, signalé par `blur`/`focus` sur `window`).
  const doc = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', createElement: () => ({}), hasFocus: (): boolean => true })
  Object.assign(target, { document: doc })
  Object.assign(globalThis, { window: target, document: doc })
  return { win: target, doc }
})
const { win, doc } = env
import { ACTIVITY_GRACE_MS } from '@/engine/activityTiming'
import { useOverlayStore } from '@/stores/overlay'
import { AUTO_SUCCESS_MS, POKE_THROTTLE_MS, SKIP_REVEAL_MS, useActivityDone } from '@/composables/useActivityDone'

const setVisibility = (state: 'visible' | 'hidden') => {
  doc.visibilityState = state
  doc.dispatchEvent(new Event('visibilitychange'))
}

describe('useActivityDone', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia()) // le composable lit le store des superpositions (menu ouvert = pause)
  })
  afterEach(() => vi.useRealTimers())

  it('réussit seule après le délai automatique, une seule fois', () => {
    const emit = vi.fn()
    const scope = effectScope()
    scope.run(() => useActivityDone(emit, { delayMs: 100 }))
    vi.advanceTimersByTime(AUTO_SUCCESS_MS + 100)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('finish manuel gagne et la minuterie automatique ne réémet pas', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    api.finish()
    api.finish()
    expect(api.isFinished()).toBe(true)
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('n’émet rien si le composant est démonté avant la fin', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    api.finish()
    scope.stop()
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).not.toHaveBeenCalled()
  })

  it('appelle onFinish une seule fois, avant done, pour une réussite manuelle ou automatique', () => {
    const order: string[] = []
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(() => order.push('done'), { delayMs: 100, onFinish: () => order.push('finish') }))!
    api.finish()
    api.finish()
    expect(order).toEqual(['finish'])
    vi.advanceTimersByTime(100)
    expect(order).toEqual(['finish', 'done'])
    scope.stop()
    const auto: string[] = []
    const s2 = effectScope()
    s2.run(() => useActivityDone(() => auto.push('done'), { delayMs: 100, onFinish: () => auto.push('finish') }))
    vi.advanceTimersByTime(AUTO_SUCCESS_MS)
    expect(auto).toEqual(['finish'])
    s2.stop()
  })

  it('révèle « Passer » après 12 s, avant la réussite automatique', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100 }))!
    expect(SKIP_REVEAL_MS).toBe(12_000)
    expect(SKIP_REVEAL_MS).toBeLessThan(AUTO_SUCCESS_MS)
    vi.advanceTimersByTime(SKIP_REVEAL_MS - 1)
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })

  it('« Passer » (finish) termine tout de suite, cache le bouton et n’émet qu’une fois', () => {
    const emit = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(emit, { delayMs: 100 }))!
    vi.advanceTimersByTime(SKIP_REVEAL_MS)
    api.finish()
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(100)
    expect(emit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(AUTO_SUCCESS_MS * 2)
    expect(emit).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('qui joue ne voit pas « Passer » : chaque interaction repousse son apparition', () => {
    const scope = effectScope()
    // Réussite automatique repoussée : on simule plus de 20 s de jeu.
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100, autoMs: 60_000 }))!
    for (let t = 0; t < 3; t++) {
      vi.advanceTimersByTime(SKIP_REVEAL_MS - 1000)
      win.dispatchEvent(new Event(['pointerdown', 'keydown', 'pointermove'][t]))
    }
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(SKIP_REVEAL_MS)
    expect(api.canSkip.value).toBe(true)
    // Affiché, il reste malgré une nouvelle interaction.
    win.dispatchEvent(new Event('pointerdown'))
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })

  it('une réussite avant 12 s ne révèle jamais « Passer »', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100 }))!
    api.finish()
    vi.advanceTimersByTime(SKIP_REVEAL_MS * 2)
    expect(api.canSkip.value).toBe(false)
    scope.stop()
  })

  it('une rafale de pointermove repousse « Passer » sans l’avancer : jamais avant 12 s, au plus 250 ms après', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { delayMs: 100, autoMs: 120_000 }))!
    // 5 s de pointermove à 60 Hz.
    for (let i = 0; i < 300; i++) {
      win.dispatchEvent(new Event('pointermove'))
      vi.advanceTimersByTime(16)
    }
    expect(api.canSkip.value).toBe(false)
    // Le dernier événement date d’environ 16 ms : la minuterie (réarmée au plus POKE_THROTTLE_MS après lui) n’échoit jamais avant SKIP_REVEAL_MS.
    vi.advanceTimersByTime(SKIP_REVEAL_MS - 100)
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(100 + POKE_THROTTLE_MS)
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })

  it('un onglet caché ne fait pas échouer : le temps restant est gardé jusqu’au retour', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    vi.advanceTimersByTime(ACTIVITY_GRACE_MS + 2000)
    setVisibility('hidden')
    expect(api.paused.value).toBe(true)
    vi.advanceTimersByTime(120_000)
    expect(api.outcome.value).toBe('play')
    setVisibility('visible')
    expect(api.paused.value).toBe(false)
    vi.advanceTimersByTime(2999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('une activité qui démarre sans focus (fenêtre quittée pendant la transition) démarre en pause', () => {
    doc.hasFocus = () => false
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    doc.hasFocus = () => true
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(true)
    vi.advanceTimersByTime(120_000)
    expect(api.outcome.value).toBe('play')
    api.resumeAway()
    expect(api.paused.value).toBe(false)
    scope.stop()
  })

  it('une fenêtre sans focus met en pause : le retour du focus ne reprend pas, « Reprendre » oui avec le temps restant gardé', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    vi.advanceTimersByTime(ACTIVITY_GRACE_MS + 2000)
    win.dispatchEvent(new Event('blur'))
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(true)
    vi.advanceTimersByTime(120_000)
    expect(api.outcome.value).toBe('play')
    win.dispatchEvent(new Event('focus'))
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(true)
    vi.advanceTimersByTime(120_000)
    expect(api.outcome.value).toBe('play')
    api.resumeAway()
    expect(api.paused.value).toBe(false)
    expect(api.away.value).toBe(false)
    vi.advanceTimersByTime(2999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('resumeAway sans pause « absent » ne fait rien (une pause manuelle reste en place)', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    api.resumeAway()
    expect(api.paused.value).toBe(false)
    api.pause()
    api.resumeAway()
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(false)
    scope.stop()
  })

  it('« Passer » n’apparaît pas pendant une pause et le compte repart à la reprise', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 20_000 }))!
    api.pause('démonstration')
    vi.advanceTimersByTime(SKIP_REVEAL_MS * 2)
    expect(api.canSkip.value).toBe(false)
    api.resume('démonstration')
    vi.advanceTimersByTime(SKIP_REVEAL_MS - 1000)
    expect(api.canSkip.value).toBe(false)
    vi.advanceTimersByTime(ACTIVITY_GRACE_MS + 1000)
    expect(api.canSkip.value).toBe(true)
    scope.stop()
  })

  it('« Passer » déjà affiché disparaît quand une pause commence', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 20_000 }))!
    vi.advanceTimersByTime(ACTIVITY_GRACE_MS + SKIP_REVEAL_MS)
    expect(api.canSkip.value).toBe(true)
    api.pause('démonstration')
    expect(api.canSkip.value).toBe(false)
    scope.stop()
  })
  it('afterPause exécute tout de suite hors pause', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn()))!
    const fn = vi.fn()
    api.afterPause(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('afterPause attend la reprise, une seule fois, et ignore une activité finie', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn()))!
    win.dispatchEvent(new Event('blur'))
    const fn = vi.fn()
    api.afterPause(fn)
    expect(fn).not.toHaveBeenCalled()
    api.resumeAway()
    expect(fn).toHaveBeenCalledTimes(1)
    // Une seconde pause puis reprise ne rejoue pas la fonction (le focus revient d’abord, sinon `blur` ne change rien).
    win.dispatchEvent(new Event('focus'))
    win.dispatchEvent(new Event('blur'))
    api.resumeAway()
    expect(fn).toHaveBeenCalledTimes(1)
    // Fin d’activité pendant la pause : la fonction en attente est ignorée.
    win.dispatchEvent(new Event('focus'))
    win.dispatchEvent(new Event('blur'))
    const tard = vi.fn()
    api.afterPause(tard)
    api.finish()
    api.resumeAway()
    expect(tard).not.toHaveBeenCalled()
    scope.stop()
  })

  it('afterPause : une activité démontée pendant la pause n’exécute plus rien à la reprise', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn()))!
    win.dispatchEvent(new Event('blur'))
    const fn = vi.fn()
    // Appel hors de la portée, comme depuis une minuterie.
    api.afterPause(fn)
    scope.stop()
    api.resumeAway()
    expect(fn).not.toHaveBeenCalled()
    win.dispatchEvent(new Event('focus'))
  })

  it('afterPause n’attend pas la pause « démonstration » voulue par l’activité', () => {
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn()))!
    api.pause('démonstration')
    const fn = vi.fn()
    api.afterPause(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('un menu ouvert met en pause sans voile : la fermeture reprend seule avec le temps restant gardé', () => {
    const overlay = useOverlayStore()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    vi.advanceTimersByTime(ACTIVITY_GRACE_MS + 2000)
    overlay.register(1)
    expect(api.paused.value).toBe(true)
    expect(api.halted.value).toBe(true)
    expect(api.away.value).toBe(false)
    vi.advanceTimersByTime(120_000)
    expect(api.outcome.value).toBe('play')
    overlay.unregister(1)
    expect(api.paused.value).toBe(false)
    expect(api.halted.value).toBe(false)
    vi.advanceTimersByTime(2999)
    expect(api.outcome.value).toBe('play')
    vi.advanceTimersByTime(1)
    expect(api.outcome.value).toBe('fail')
    scope.stop()
  })

  it('un menu déjà ouvert au montage démarre l’activité en pause', () => {
    const overlay = useOverlayStore()
    overlay.register(1)
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(false)
    overlay.unregister(1)
    expect(api.paused.value).toBe(false)
    scope.stop()
  })

  it('menu + fenêtre quittée : la fermeture du menu ne reprend pas, seul « Reprendre » le fait', () => {
    const overlay = useOverlayStore()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn(), { durationMs: 5000 }))!
    overlay.register(1)
    win.dispatchEvent(new Event('blur'))
    overlay.unregister(1)
    expect(api.paused.value).toBe(true)
    expect(api.away.value).toBe(true)
    expect(api.halted.value).toBe(true)
    win.dispatchEvent(new Event('focus'))
    api.resumeAway()
    expect(api.paused.value).toBe(false)
    expect(api.halted.value).toBe(false)
    scope.stop()
  })

  it('afterPause attend la fermeture du menu, une seule fois', () => {
    const overlay = useOverlayStore()
    const scope = effectScope()
    const api = scope.run(() => useActivityDone(vi.fn()))!
    overlay.register(1)
    const fn = vi.fn()
    api.afterPause(fn)
    expect(fn).not.toHaveBeenCalled()
    overlay.unregister(1)
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
