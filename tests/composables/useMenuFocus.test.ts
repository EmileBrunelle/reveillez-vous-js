import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// focusQuietly dépend de la modalité clavier (écouteurs globaux) : on le remplace par un focus simple.
vi.mock('../../src/composables/focusQuietly', () => ({ focusQuietly: (el: { focus: () => void } | null) => el?.focus() }))
const { useMenuFocus } = await import('../../src/composables/useMenuFocus')

type Focusable = { focus: ReturnType<typeof vi.fn> }
const entree = (): Focusable => ({ focus: vi.fn() })
const touche = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() })

describe('useMenuFocus', () => {
  const a = entree()
  const b = entree()
  const c = entree()
  let actif: unknown = null
  const monter = () => {
    const menu = shallowRef({ querySelectorAll: () => [a, b, c] } as unknown as HTMLElement)
    const declencheur = entree()
    const api = effectScope().run(() => useMenuFocus(menu, shallowRef(declencheur as unknown as HTMLElement), () => actif as Element))!
    const envoyer = (e: ReturnType<typeof touche>) => api.onKeydown(e as unknown as KeyboardEvent)
    return { api, declencheur, envoyer }
  }
  beforeEach(() => {
    setActivePinia(createPinia())
    ;[a, b, c].forEach((e) => e.focus.mockClear())
    actif = null
  })

  it('ouvre et place le focus sur la première entrée après nextTick', async () => {
    const { api } = monter()
    const p = api.toggle()
    expect(api.open.value).toBe(true)
    expect(a.focus).not.toHaveBeenCalled()
    await p
    await nextTick()
    expect(a.focus).toHaveBeenCalledTimes(1)
  })

  it('ferme à la deuxième bascule sans déplacer le focus', async () => {
    const { api } = monter()
    await api.toggle()
    await api.toggle()
    expect(api.open.value).toBe(false)
    expect(a.focus).toHaveBeenCalledTimes(1)
  })

  it('ArrowDown/ArrowUp bouclent', () => {
    const { envoyer } = monter()
    actif = c
    const bas = touche('ArrowDown')
    envoyer(bas)
    expect(bas.preventDefault).toHaveBeenCalled()
    expect(a.focus).toHaveBeenCalled()
    actif = a
    envoyer(touche('ArrowUp'))
    expect(c.focus).toHaveBeenCalled()
    actif = a
    envoyer(touche('ArrowDown'))
    expect(b.focus).toHaveBeenCalled()
  })

  it('Home et End visent les extrémités', () => {
    const { envoyer } = monter()
    envoyer(touche('End'))
    expect(c.focus).toHaveBeenCalled()
    envoyer(touche('Home'))
    expect(a.focus).toHaveBeenCalled()
  })

  it('Échap ferme, rend le focus au déclencheur et arrête la propagation', async () => {
    const { api, declencheur, envoyer } = monter()
    await api.toggle()
    const e = touche('Escape')
    envoyer(e)
    expect(api.open.value).toBe(false)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(declencheur.focus).toHaveBeenCalled()
  })

  it('Tab ferme sans prévenir ni rendre le focus', async () => {
    const { api, declencheur, envoyer } = monter()
    await api.toggle()
    const e = touche('Tab')
    envoyer(e)
    expect(api.open.value).toBe(false)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(declencheur.focus).not.toHaveBeenCalled()
  })
})
