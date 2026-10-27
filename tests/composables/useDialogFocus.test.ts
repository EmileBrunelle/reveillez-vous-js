import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const focusQuietly = vi.fn()
vi.mock('../../src/composables/focusQuietly', () => ({ focusQuietly: (...a: unknown[]) => focusQuietly(...a) }))

const { useDialogFocus } = await import('../../src/composables/useDialogFocus')

// Pas de DOM dans l’environnement de test (node) : un faux HTMLElement et un document réduit à activeElement.
class FakeEl {
  isConnected = true
}
const doc = { activeElement: null as FakeEl | null }

beforeEach(() => {
  vi.stubGlobal('HTMLElement', FakeEl)
  vi.stubGlobal('document', doc)
  focusQuietly.mockClear()
  doc.activeElement = null
})
afterEach(() => vi.unstubAllGlobals())

const setup = (initial?: () => unknown) => {
  const open = ref(false)
  const scope = effectScope()
  const { restore } = scope.run(() => useDialogFocus(open, initial as never))!
  return { open, restore, scope }
}

describe('useDialogFocus', () => {
  it('mémorise le déclencheur AVANT initial() (watcher synchrone) et le restaure à la fermeture', async () => {
    const trigger = new FakeEl()
    const target = new FakeEl()
    const { open, restore } = setup(() => target)
    doc.activeElement = trigger
    open.value = true
    // Le focus bouge juste après l’ouverture (showModal() de v0) : un watcher en flush « pre » mémoriserait ceci.
    doc.activeElement = new FakeEl()
    await nextTick()
    expect(focusQuietly).toHaveBeenCalledTimes(1)
    expect(focusQuietly).toHaveBeenLastCalledWith(target)
    restore()
    expect(focusQuietly).toHaveBeenLastCalledWith(trigger)
  })

  it('restore() ignore un déclencheur déconnecté et ne restaure qu’une fois', async () => {
    const trigger = new FakeEl()
    const { open, restore } = setup()
    doc.activeElement = trigger
    open.value = true
    await nextTick()
    trigger.isConnected = false
    focusQuietly.mockClear()
    restore()
    expect(focusQuietly).not.toHaveBeenCalled()
  })

  it('restore() ne se répète pas, et sans initial() le focus initial reste à v0', async () => {
    const trigger = new FakeEl()
    const { open, restore } = setup()
    doc.activeElement = trigger
    open.value = true
    await nextTick()
    expect(focusQuietly).toHaveBeenCalledWith(undefined) // focusQuietly ignore undefined : aucun focus forcé
    focusQuietly.mockClear()
    restore()
    restore()
    expect(focusQuietly).toHaveBeenCalledTimes(1)
  })

  it('un composant monté alors que le parent veut déjà ouvrir (immediate) fonctionne aussi', async () => {
    const trigger = new FakeEl()
    const target = new FakeEl()
    doc.activeElement = trigger
    const open = ref(true)
    const { restore } = effectScope().run(() => useDialogFocus(open, (() => target) as never))!
    await nextTick()
    expect(focusQuietly).toHaveBeenLastCalledWith(target)
    restore()
    expect(focusQuietly).toHaveBeenLastCalledWith(trigger)
  })
})
