import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useOverlayRegistration, useOverlayStore } from '../../src/stores/overlay'

describe('store des superpositions', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('est inactif au départ', () => {
    expect(useOverlayStore().active).toBe(false)
  })

  it('suit l’ouverture et la fermeture', async () => {
    const open = ref(false)
    effectScope().run(() => useOverlayRegistration(open))
    const store = useOverlayStore()
    expect(store.active).toBe(false)
    open.value = true
    await nextTick()
    expect(store.active).toBe(true)
    open.value = false
    await nextTick()
    expect(store.active).toBe(false)
  })

  it('reste actif tant qu’une des deux superpositions est ouverte', async () => {
    const a = ref(true)
    const b = ref(true)
    effectScope().run(() => {
      useOverlayRegistration(a)
      useOverlayRegistration(b)
    })
    const store = useOverlayStore()
    a.value = false
    await nextTick()
    expect(store.active).toBe(true)
    b.value = false
    await nextTick()
    expect(store.active).toBe(false)
  })

  it('se retire au démontage même si elle est ouverte', () => {
    const scope = effectScope()
    scope.run(() => useOverlayRegistration(ref(true)))
    const store = useOverlayStore()
    expect(store.active).toBe(true)
    scope.stop()
    expect(store.active).toBe(false)
  })
})
