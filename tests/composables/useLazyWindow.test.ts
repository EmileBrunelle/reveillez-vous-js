import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

class FakeEl {
  isConnected = true
  focus = vi.fn()
}
let active: unknown
beforeEach(() => {
  vi.stubGlobal('HTMLElement', FakeEl)
  vi.stubGlobal('document', {
    get activeElement() {
      return active
    },
  })
  active = null
})
afterEach(() => vi.unstubAllGlobals())

const load = async () => (await import('../../src/composables/useLazyWindow')).useLazyWindow

describe('useLazyWindow', () => {
  it('ne monte rien avant la première ouverture, puis reste monté après fermeture', async () => {
    const { open, wanted, show } = (await load())()
    expect(wanted.value).toBe(false)
    show()
    expect(open.value).toBe(true)
    expect(wanted.value).toBe(true)
    open.value = false
    await nextTick()
    expect(wanted.value).toBe(true)
  })
  it('suit une ouverture posée directement sur open', async () => {
    const { open, wanted } = (await load())()
    open.value = true
    await nextTick()
    expect(wanted.value).toBe(true)
  })
  it('rend le focus au déclencheur à la fermeture avec restoreFocus', async () => {
    const trigger = new FakeEl()
    active = trigger
    const { open, show } = (await load())({ restoreFocus: true })
    show()
    await nextTick()
    open.value = false
    await nextTick()
    await nextTick()
    expect(trigger.focus).toHaveBeenCalledTimes(1)
  })
  it('ne touche pas au focus sans restoreFocus', async () => {
    const trigger = new FakeEl()
    active = trigger
    const { open, show } = (await load())()
    show()
    await nextTick()
    open.value = false
    await nextTick()
    await nextTick()
    expect(trigger.focus).not.toHaveBeenCalled()
  })
})
