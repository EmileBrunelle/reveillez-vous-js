import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'

const tarot = vi.hoisted(() => ({ load: vi.fn<() => Promise<unknown>>() }))
vi.mock('../../src/audio/sfx', () => ({ hymn: vi.fn(), unlock: vi.fn() }))
vi.mock('../../src/lazy', () => ({ loadTarotCard: () => tarot.load(), activityFor: () => null, loadFinale: () => Promise.resolve({}), prefetch: vi.fn() }))

import { useProgressStore } from '../../src/stores/progress'
import { useGameFlow } from '../../src/composables/useGameFlow'

const make = (visits = 0) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useProgressStore().visits = visits
  const scope = effectScope()
  const flow = scope.run(() => useGameFlow())!
  return { flow, scope }
}

describe('useGameFlow : focusTarget', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { search: '' })
    vi.stubGlobal('document', { documentElement: {} })
    tarot.load.mockResolvedValue({ default: {} })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('porte -> coupe (niveau 1) : le paquet reçoit le focus ; la porte, elle, est gérée par App.vue', () => {
    const { flow, scope } = make()
    expect(flow.focusTarget.value).toBeNull()
    flow.onDone()
    expect(flow.phase.value).toBe('cut')
    expect(flow.focusTarget.value).toBe('deck')
    scope.stop()
  })

  it('pioche réussie : lecture, puis « Fermer la porte » quand la carte est retournée', async () => {
    const { flow, scope } = make()
    flow.onDone()
    await flow.onPick('nuit')
    expect(flow.phase.value).toBe('reading')
    expect(flow.focusTarget.value).toBe('reading')
    flow.onFlipped()
    expect(flow.focusTarget.value).toBe('close')
    scope.stop()
  })

  it('chunk de la carte en échec : lecture de secours, focus direct sur « Fermer la porte »', async () => {
    tarot.load.mockRejectedValue(new Error('réseau'))
    const { flow, scope } = make()
    flow.onDone()
    await flow.onPick('nuit')
    expect(flow.phase.value).toBe('reading')
    expect(flow.focusTarget.value).toBe('close')
    scope.stop()
  })

  it('chunk de la carte trop lent : même repli après 3 s', async () => {
    vi.useFakeTimers()
    tarot.load.mockReturnValue(new Promise(() => undefined))
    const { flow, scope } = make()
    flow.onDone()
    const p = flow.onPick('nuit')
    await vi.advanceTimersByTimeAsync(3000)
    await p
    expect(flow.focusTarget.value).toBe('close')
    scope.stop()
  })

  it('deux tirages simultanés (double clic, « Passer ») n’en font qu’un', async () => {
    const { flow, scope } = make()
    flow.onDone()
    if (flow.phase.value === 'activity') flow.onActivityDone()
    const first = flow.onPick('nuit')
    const second = flow.onPick('feu')
    await Promise.all([first, second])
    expect(flow.pickedPaquet.value).toBe('nuit')
    expect(useProgressStore().memory.lastArcane).not.toBeNull()
    scope.stop()
  })

  it('niveau 5 : « Fermer la porte » mène à la finale, qui reçoit le focus', async () => {
    const { flow, scope } = make(7)
    flow.onDone()
    if (flow.phase.value === 'activity') flow.onActivityDone()
    await flow.onPick('nuit')
    flow.onClose()
    expect(flow.phase.value).toBe('finale')
    expect(flow.focusTarget.value).toBe('finale')
    scope.stop()
  })

  it('niveau < 5 : « Fermer la porte » ne vise aucune cible (la porte suivante s’en charge)', async () => {
    const { flow, scope } = make()
    flow.onDone()
    await flow.onPick('nuit')
    flow.focusTarget.value = null
    flow.onClose()
    expect(flow.phase.value).toBe('door')
    expect(flow.focusTarget.value).toBeNull()
    scope.stop()
  })
})
