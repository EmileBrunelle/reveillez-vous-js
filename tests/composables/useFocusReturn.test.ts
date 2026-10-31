import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

// useActiveElement de VueUse lit `window`/`document` à l’import : environnement node, on les simule.
const dom = vi.hoisted(() => {
  class FakeEl {
    children: FakeEl[] = []
    isConnected = true
    focus = vi.fn(() => {
      dom.doc.activeElement = this
      dom.fire('focus')
    })
    contains(el: unknown) {
      return el === this || this.children.includes(el as FakeEl)
    }
    querySelector() {
      return this.children[0] ?? null
    }
  }
  const listeners = new Map<string, Array<() => void>>()
  const doc = { activeElement: null as unknown, body: new FakeEl(), createElement: () => ({}) }
  const win = {
    document: doc,
    addEventListener: (t: string, f: () => void) => listeners.set(t, [...(listeners.get(t) ?? []), f]),
    removeEventListener: () => undefined,
  }
  Object.assign(globalThis, { window: win, document: doc, HTMLElement: FakeEl })
  return { FakeEl, doc, fire: (t: string) => listeners.get(t)?.forEach((f) => f()) }
})
import { useFocusReturn } from '../../src/composables/useFocusReturn'

const focusOn = async (el: InstanceType<typeof dom.FakeEl>) => {
  dom.doc.activeElement = el
  dom.fire('focus')
  await nextTick()
}

describe('useFocusReturn', () => {
  it('si le focus était dans la fenêtre fermée, il va à la fenêtre suivante', async () => {
    const root = new dom.FakeEl()
    const win = new dom.FakeEl()
    const next = new dom.FakeEl()
    root.children = [win, next]
    const close = effectScope().run(() => useFocusReturn(ref(root as unknown as HTMLElement), () => root.querySelector() as unknown as HTMLElement | undefined))!
    await focusOn(win)
    const remove = vi.fn()
    await close(remove)
    expect(remove).toHaveBeenCalledOnce()
    expect(root.querySelector()).toBe(win)
    expect(win.focus).toHaveBeenCalled() // premier résultat du sélecteur simulé
  })

  it('sans fenêtre suivante, le focus revient au dernier élément extérieur encore connecté', async () => {
    const root = new dom.FakeEl()
    const win = new dom.FakeEl()
    const outside = new dom.FakeEl()
    const close = effectScope().run(() => useFocusReturn(ref(root as unknown as HTMLElement), () => root.querySelector() as unknown as HTMLElement | undefined))!
    await focusOn(outside)
    root.children = [win]
    await focusOn(win)
    await close(() => (root.children = []))
    expect(outside.focus).toHaveBeenCalledOnce()
  })

  it('si le focus n’était pas dans la fenêtre, rien ne bouge', async () => {
    const root = new dom.FakeEl()
    const outside = new dom.FakeEl()
    const close = effectScope().run(() => useFocusReturn(ref(root as unknown as HTMLElement), () => root.querySelector() as unknown as HTMLElement | undefined))!
    await focusOn(outside)
    await close(() => undefined)
    expect(outside.focus).not.toHaveBeenCalled()
  })
})
