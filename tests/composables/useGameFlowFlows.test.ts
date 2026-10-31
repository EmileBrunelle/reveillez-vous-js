// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'

const m = vi.hoisted(() => ({
  load: vi.fn<() => Promise<unknown>>(),
  activity: null as null | (() => Promise<{ default: object }>),
  prefetch: vi.fn(),
  unlock: vi.fn(),
  hymn: vi.fn(),
}))
vi.mock('@/audio/sfx', () => ({ hymn: m.hymn, unlock: m.unlock }))
vi.mock('@/lazy', () => ({ loadTarotCard: () => m.load(), activityFor: (id: string | null) => (id ? m.activity : null), loadFinale: () => Promise.resolve({}), prefetch: m.prefetch }))
// Hasard déterministe : la porte, les répliques et le paquet tiré par « Passer » ne dépendent plus de crypto.
vi.mock('@/engine/rng', async (orig) => {
  const real = await orig<typeof import('@/engine/rng')>()
  return { ...real, secureRng: () => real.mulberry32(7) }
})

import { returnGrammar } from '@/content/finale'
import { PAQUETS } from '@/engine/paquets'
import { LAST_ACTIVITY_KEY } from '@/engine/activityPick'
import { useGameFlow } from '@/composables/useGameFlow'
import { useCollectionStore } from '@/stores/collection'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'

const stubNarrow = (narrow: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: narrow && q.includes('max-width'), media: q, addEventListener: () => {}, removeEventListener: () => {} }))
const make = (visits = 0) => {
  setActivePinia(createPinia())
  const progress = useProgressStore()
  progress.visits = visits
  const scope = effectScope()
  const flow = scope.run(() => useGameFlow())!
  return { flow, scope, progress, session: useSessionStore() }
}
const toReading = async (flow: ReturnType<typeof useGameFlow>) => {
  flow.onDone()
  if (flow.phase.value === 'activity') flow.onActivityDone()
  await flow.onPick('nuit')
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  m.load.mockResolvedValue({ default: {} })
  m.activity = () => Promise.resolve({ default: {} })
  m.prefetch.mockClear()
  m.unlock.mockClear()
  stubNarrow(false)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useGameFlow : activités', () => {
  it('niveau 1 : pas d’activité, la porte mène directement à la coupe ; la mémoire d’activités est vidée', () => {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, 'wisps')
    const { flow, scope } = make(0)
    expect(flow.activityId.value).toBeNull()
    expect(flow.Activity.value).toBeNull()
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull()
    flow.onDone()
    expect(flow.phase.value).toBe('cut')
    scope.stop()
  })

  it('niveau 2 : une activité est tirée, mémorisée pour la session et préchargée ; la porte mène à l’activité puis à la coupe', () => {
    const { flow, scope } = make(2)
    expect(flow.activityId.value).toBe('wisps')
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBe('wisps')
    expect(m.prefetch).toHaveBeenCalledWith(m.activity)
    expect(flow.Activity.value).not.toBeNull()
    flow.onDone()
    expect(flow.phase.value).toBe('activity')
    expect(flow.focusTarget.value).toBe('activity')
    flow.onActivityDone()
    expect(flow.phase.value).toBe('cut')
    expect(flow.focusTarget.value).toBe('deck')
    scope.stop()
  })

  it('un « done » tardif (hors activité, ou porte en fermeture) ne relance rien', () => {
    const { flow, scope } = make(2)
    flow.onActivityDone() // la porte est encore là
    expect(flow.phase.value).toBe('door')
    flow.onDone()
    flow.resetLevel() // ferme la porte (closing)
    flow.onActivityDone()
    expect(flow.phase.value).toBe('door')
    scope.stop()
  })

  it('la session retient les bulles pendant l’activité seulement', async () => {
    const { flow, scope, session } = make(2)
    expect(session.activityRunning).toBe(false)
    flow.onDone()
    await nextTick()
    expect(session.activityRunning).toBe(true)
    flow.onActivityDone()
    await nextTick()
    expect(session.activityRunning).toBe(false)
    scope.stop()
  })
})

describe('useGameFlow : « Recommencer à zéro »', () => {
  it('pendant la lecture : retour au niveau 1, la porte claque sans compter la visite', async () => {
    const { flow, scope, progress } = make(3)
    await toReading(flow)
    expect(flow.phase.value).toBe('reading')
    flow.resetLevel()
    expect(progress.visits).toBe(0)
    expect(flow.closing.value).toBe(true)
    expect(flow.phase.value).toBe('door')
    flow.onClosed() // la porte fermée : la suivante est tirée au niveau 1
    expect(flow.closing.value).toBe(false)
    expect(flow.activityId.value).toBeNull()
    scope.stop()
  })

  it('porte pas encore ouverte : nouvelle porte tout de suite (clé de scène changée)', () => {
    const { flow, scope, progress } = make(4)
    const before = flow.sceneKey.value
    flow.resetLevel()
    expect(progress.visits).toBe(0)
    expect(flow.sceneKey.value).toBe(before + 1)
    expect(flow.closing.value).toBe(false)
    expect(flow.phase.value).toBe('door')
    scope.stop()
  })

  it('porte en train de claquer : on attend la fermeture, aucune nouvelle porte entre-temps', async () => {
    const { flow, scope } = make(1)
    await toReading(flow)
    flow.onClose() // leave(true)
    const key = flow.sceneKey.value
    flow.resetLevel()
    expect(flow.sceneKey.value).toBe(key)
    expect(flow.closing.value).toBe(true)
    scope.stop()
  })

  it('finale interrompue : retour direct à la porte du niveau 1', () => {
    const { flow, scope, progress } = make(8)
    flow.phase.value = 'finale'
    flow.resetLevel()
    expect(flow.phase.value).toBe('door')
    expect(progress.visits).toBe(0)
    expect(flow.closing.value).toBe(false)
    scope.stop()
  })

  it('efface les bulles de la barre des tâches', () => {
    const { flow, scope, session } = make(2)
    session.notify('t', 'x')
    flow.resetLevel()
    expect(session.notifications).toHaveLength(0)
    scope.stop()
  })
})

describe('useGameFlow : visite, fermeture et pioche', () => {
  it('« Fermer la porte » compte la visite, déverrouille l’audio et claque ; un second appel est ignoré', async () => {
    const { flow, scope, progress } = make(1)
    await toReading(flow)
    flow.onClose()
    expect(progress.visits).toBe(2)
    expect(m.unlock).toHaveBeenCalledOnce()
    expect(flow.closing.value).toBe(true)
    flow.onClose()
    expect(progress.visits).toBe(2)
    flow.onClosed()
    expect(flow.closing.value).toBe(false)
    expect(flow.phase.value).toBe('door')
    scope.stop()
  })

  it('pioche refusée hors de la coupe, ou si « Recommencer » survient pendant l’attente de la carte', async () => {
    const { flow, scope } = make(0)
    await flow.onPick('nuit') // encore à la porte
    expect(flow.phase.value).toBe('door')
    flow.onDone()
    let release!: (v: unknown) => void
    m.load.mockReturnValue(new Promise((r) => (release = r)))
    const p = flow.onPick('nuit')
    flow.resetLevel() // la porte claque pendant le chargement
    release({})
    await p
    expect(flow.phase.value).toBe('door')
    expect(m.hymn).not.toHaveBeenCalled()
    scope.stop()
  })

  it('une pioche réussie tire la prophétie du paquet, l’enregistre et lance l’hymne', async () => {
    const { flow, scope, progress } = make(1)
    flow.onDone()
    if (flow.phase.value === 'activity') flow.onActivityDone()
    await flow.onPick('feu')
    expect(flow.pickedPaquet.value).toBe('feu')
    expect(flow.tarotOk.value).toBe(true)
    expect(flow.prophecy.value.body.length).toBeGreaterThan(0)
    expect(flow.prophecy.value.arcane.paquet).toBe('feu')
    expect(progress.memory.lastNom).toBe(flow.prophecy.value.arcane.nom)
    expect(flow.cardSettled.value).toBe(false)
    expect(m.hymn).toHaveBeenCalled()
    scope.stop()
  })

  it('« Passer » sur la coupe tire un paquet au hasard et ouvre la lecture', async () => {
    const { flow, scope } = make(0)
    flow.onDone()
    flow.skipDeck()
    await vi.waitFor(() => expect(flow.phase.value).toBe('reading'))
    expect(PAQUETS).toContain(flow.pickedPaquet.value)
    scope.stop()
  })
})

describe('useGameFlow : carte retournée et bulles', () => {
  it('onFlipped : enregistre l’arcane dans la collection, pose cardSettled, focus sur « Fermer la porte »', async () => {
    const { flow, scope } = make(1)
    await toReading(flow)
    flow.onFlipped()
    expect(flow.cardSettled.value).toBe(true)
    expect(flow.focusTarget.value).toBe('close')
    expect(useCollectionStore().seen).toContain(flow.prophecy.value.arcane.nom)
    scope.stop()
  })

  it('première lecture de la session : une bulle annonce la suite (écran large seulement)', async () => {
    const wide = make(0)
    await toReading(wide.flow)
    wide.flow.onFlipped()
    expect(wide.session.notifications).toHaveLength(1)
    wide.scope.stop()
    stubNarrow(true)
    const narrow = make(0)
    await toReading(narrow.flow)
    narrow.flow.onFlipped()
    expect(narrow.session.notifications).toHaveLength(0)
    narrow.scope.stop()
  })

  it('quitter la porte retire les bulles sur écran étroit seulement', async () => {
    const wide = make(1)
    wide.session.notify('t', 'x')
    wide.flow.onDone()
    await nextTick()
    expect(wide.session.notifications).toHaveLength(1)
    wide.scope.stop()
    stubNarrow(true)
    const narrow = make(1)
    narrow.session.notify('t', 'x')
    narrow.flow.onDone()
    await nextTick()
    expect(narrow.session.notifications).toHaveLength(0)
    narrow.scope.stop()
  })
})

describe('useGameFlow : finale', () => {
  it('collapsed : CRT éteint, lieu des nuages à l’aube, point de non-retour posé', () => {
    const { flow, scope, progress } = make(8)
    flow.phase.value = 'finale'
    flow.onCollapsed()
    expect(flow.crtOff.value).toBe(true)
    expect(flow.place.value.id).toBe('nuages')
    expect(flow.placeVariant.value.id).toBe('aube')
    expect(progress.finaleSeen).toBe(true)
    scope.stop()
  })

  it('collapsed tardif (finale déjà sortie) : ne touche à rien', () => {
    const { flow, scope, progress } = make(8)
    const place = flow.place.value
    flow.onCollapsed()
    expect(flow.crtOff.value).toBe(false)
    expect(flow.place.value).toBe(place)
    expect(progress.finaleSeen).toBe(false)
    scope.stop()
  })

  it('« Recommencer » : niveau 1, mémoire « terminé », retour à la porte ; la première porte salue la personne une seule fois', () => {
    const { flow, scope, progress } = make(8)
    flow.phase.value = 'finale'
    flow.onFinaleRestart()
    expect(progress.visits).toBe(0)
    expect(progress.memory.finished).toBe(true)
    expect(flow.phase.value).toBe('door')
    expect(flow.crtOff.value).toBe(false)
    // enterDoor a lu `memory.finished` avant qu’il soit posé ? Non : completeFinale précède enterDoor, donc la salutation de retour est tirée.
    expect(returnGrammar.retour).toContain(flow.doorLine.value)
    flow.onClosed()
    expect(returnGrammar.retour).not.toContain(flow.doorLine.value)
    scope.stop()
  })

  it('double clic sur « Recommencer » : un seul redémarrage', () => {
    const { flow, scope } = make(8)
    flow.phase.value = 'finale'
    flow.onFinaleRestart()
    const key = flow.sceneKey.value
    flow.onFinaleRestart()
    expect(flow.sceneKey.value).toBe(key)
    scope.stop()
  })
})

describe('useGameFlow : raccourcis de développement (?phase=)', () => {
  const at = (query: string) => (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(`http://localhost/${query}`)
  afterEach(() => at(''))

  it('?phase=finale saute à la finale', () => {
    at('?phase=finale')
    const { flow, scope } = make(0)
    expect(flow.phase.value).toBe('finale')
    scope.stop()
  })

  it('?phase=deck saute à la coupe ; ?phase=card jusqu’à la carte', async () => {
    at('?phase=deck')
    const a = make(0)
    expect(a.flow.phase.value).toBe('cut')
    a.scope.stop()
    at('?phase=card')
    const b = make(0)
    await vi.waitFor(() => expect(b.flow.phase.value).toBe('reading'))
    expect(b.flow.pickedPaquet.value).toBe('nuit')
    b.scope.stop()
  })
})
