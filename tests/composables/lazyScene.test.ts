import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, shallowRef, type RendererOptions } from 'vue'
import { lazyScene } from '../../src/composables/lazyScene'

// ChunkFailed est un SFC compilé pour le serveur dans cet environnement (pas de DOM) : on le remplace par un double au même contrat
// (prop `skippable`, événements `retry`/`skip`, `focus()` exposé qui focalise « Réessayer »).
vi.mock('../../src/components/ChunkFailed.vue', async () => {
  const { h, shallowRef } = await import('vue')
  return {
    default: {
      props: { skippable: Boolean },
      emits: ['retry', 'skip'],
      setup(props: { skippable: boolean }, { emit, expose }: { emit: (e: 'retry' | 'skip') => void; expose: (api: object) => void }) {
        const retryBtn = shallowRef<{ focus: () => void } | null>(null)
        expose({ focus: () => retryBtn.value?.focus() })
        return () => h('div', [h('button', { ref: retryBtn, onClick: () => emit('retry') }, 'Réessayer'), props.skippable ? h('button', { onClick: () => emit('skip') }, 'Passer') : null])
      },
    },
  }
})

// Pas de DOM dans l’environnement de test (node) : un rendu client minimal sur des nœuds JS suffit pour poser les refs et suivre le montage.
type N = { tag?: string; text?: string; parent: N | null; children: N[]; props: Record<string, unknown>; focus: ReturnType<typeof vi.fn> }
const node = (init: Partial<N> = {}): N => ({ parent: null, children: [], props: {}, focus: vi.fn(), ...init })
const detach = (n: N) => {
  if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1)
  n.parent = null
}
const created: N[] = []
const track = (n: N) => (created.push(n), n)
const ops: RendererOptions<N, N> = {
  createElement: (tag) => track(node({ tag })),
  createText: (text) => track(node({ text })),
  createComment: (text) => track(node({ text })),
  setText: (n, t) => void (n.text = t),
  setElementText: (n, t) => void (n.text = t),
  insert: (child, parent, anchor) => {
    detach(child)
    child.parent = parent
    const at = anchor ? parent.children.indexOf(anchor) : -1
    if (at < 0) parent.children.push(child)
    else parent.children.splice(at, 0, child)
  },
  remove: detach,
  parentNode: (n) => n.parent,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (el, key, _prev, next) => void (el.props[key] = next),
}
const { createApp } = createRenderer(ops)

const focusSpy = vi.fn()
const Scene = {
  props: { level: { type: Number, default: 0 } },
  setup(props: { level: number }, { expose }: { expose: (api: object) => void }) {
    expose({ focus: focusSpy })
    return () => h('p', `scène niveau ${props.level}`)
  },
}

// Charge un chunk à la main : `settle` le résout ou le rejette.
const manualLoader = () => {
  let settle!: (ok: boolean) => void
  const loader = () => new Promise<object>((resolve, reject) => (settle = (ok) => (ok ? resolve({ __esModule: true, default: Scene }) : reject(new Error('réseau')))))
  return { loader, settle: (ok: boolean) => settle(ok) }
}

const mount = (loader: () => Promise<object>, skip?: () => void) => {
  const Lazy = lazyScene(loader as never, skip)
  const handle = shallowRef<{ focus: () => void } | null>(null)
  const root = node({ tag: 'root' })
  createApp({ render: () => h(Lazy, { ref: handle, level: 3 }) }).mount(root)
  return { handle, root }
}
const settleAll = async () => {
  await new Promise((r) => setTimeout(r))
  await nextTick()
}
const button = (label: string) => created.find((n) => n.tag === 'button' && n.text === label)

afterEach(() => {
  created.length = 0
  focusSpy.mockClear()
  vi.unstubAllGlobals()
})

describe('lazyScene', () => {
  it('le focus demandé avant la résolution du chunk est appliqué après (la ref existe dès le montage)', async () => {
    const { loader, settle } = manualLoader()
    const { handle } = mount(loader)
    expect(handle.value).not.toBeNull()
    handle.value!.focus() // App le fait dès que sa ref est posée, chunk pas encore là
    expect(focusSpy).not.toHaveBeenCalled()
    settle(true)
    await settleAll()
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(created.some((n) => n.text === 'scène niveau 3')).toBe(true) // les attributs traversent
  })

  it('un focus demandé une fois la scène montée est appliqué tout de suite, et une seule fois', async () => {
    const { loader, settle } = manualLoader()
    const { handle } = mount(loader)
    settle(true)
    await settleAll()
    handle.value!.focus()
    expect(focusSpy).toHaveBeenCalledTimes(1)
    await settleAll()
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('chunk introuvable : repli « Réessayer » qui reçoit le focus demandé, sans « Passer » par défaut', async () => {
    const { loader, settle } = manualLoader()
    const { handle } = mount(loader)
    handle.value!.focus()
    settle(false)
    await settleAll()
    const retry = button('Réessayer')
    expect(retry).toBeDefined()
    expect(retry!.focus).toHaveBeenCalledTimes(1)
    expect(button('Passer')).toBeUndefined()
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('« Réessayer » recharge la page ; « Passer » appelle skip quand la scène sait être sautée', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const skip = vi.fn()
    const { loader, settle } = manualLoader()
    mount(loader, skip)
    settle(false)
    await settleAll()
    ;(button('Réessayer')!.props.onClick as () => void)()
    expect(reload).toHaveBeenCalledTimes(1)
    ;(button('Passer')!.props.onClick as () => void)()
    expect(skip).toHaveBeenCalledTimes(1)
  })
})
