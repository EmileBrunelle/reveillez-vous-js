import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWindowsStore } from '@/stores/windows'

const ouvrir = (s: ReturnType<typeof useWindowsStore>, ...ids: number[]) => ids.forEach((id) => s.open({ id, title: `Fenêtre ${id}`, icon: 'warn' }))

describe('store des fenêtres non modales', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('ouvre au premier plan : la dernière ouverte est active et a le z-index le plus haut', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2, 3)
    expect(s.windows.map((w) => w.id)).toEqual([1, 2, 3])
    expect(s.activeId).toBe(3)
    expect([1, 2, 3].map(s.zIndexOf)).toEqual([1, 2, 3])
  })

  it('ouvrir deux fois la même fenêtre ne la duplique pas', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 1)
    expect(s.windows).toHaveLength(1)
  })

  it('focus : passe devant, les z-index restent des rangs (aucun compteur qui grimpe)', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2, 3)
    for (let i = 0; i < 50; i++) {
      s.focus(1)
      s.focus(3)
    }
    s.focus(1)
    expect(s.activeId).toBe(1)
    expect([1, 2, 3].map(s.zIndexOf).sort()).toEqual([1, 2, 3])
    expect(s.zIndexOf(1)).toBe(3)
    // L’ordre des boutons de la barre des tâches ne bouge pas avec le focus.
    expect(s.windows.map((w) => w.id)).toEqual([1, 2, 3])
  })

  it('focus sur une fenêtre réduite ne la restaure pas', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2)
    s.minimize(1)
    s.focus(1)
    expect(s.find(1)?.minimized).toBe(true)
    expect(s.activeId).toBe(2)
  })

  it('minimize : la fenêtre n’est plus active, la suivante la remplace ; restore la remet devant', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2)
    s.minimize(2)
    expect(s.find(2)?.minimized).toBe(true)
    expect(s.activeId).toBe(1)
    s.restore(2)
    expect(s.find(2)?.minimized).toBe(false)
    expect(s.activeId).toBe(2)
  })

  it('toggle : active et visible → réduit ; réduite → restaure devant ; en arrière-plan → passe devant', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2)
    s.toggle(2)
    expect(s.find(2)?.minimized).toBe(true)
    s.toggle(2)
    expect(s.find(2)?.minimized).toBe(false)
    expect(s.activeId).toBe(2)
    s.toggle(1) // 1 est visible mais derrière : on la passe devant sans la réduire
    expect(s.find(1)?.minimized).toBe(false)
    expect(s.activeId).toBe(1)
    s.toggle(1)
    expect(s.find(1)?.minimized).toBe(true)
  })

  it('close retire la fenêtre de la pile et des boutons ; sans fenêtre visible, aucune n’est active', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2)
    s.close(2)
    expect(s.windows.map((w) => w.id)).toEqual([1])
    expect(s.activeId).toBe(1)
    s.minimize(1)
    expect(s.activeId).toBeNull()
    s.close(1)
    expect(s.windows).toEqual([])
  })

  it('retient le décalage de glissement', () => {
    const s = useWindowsStore()
    ouvrir(s, 1)
    expect(s.find(1)?.offset).toEqual({ x: 0, y: 0 })
    s.setOffset(1, { x: 40, y: -10 })
    expect(s.find(1)?.offset).toEqual({ x: 40, y: -10 })
  })

  it('clear vide tout (fin de la lecture)', () => {
    const s = useWindowsStore()
    ouvrir(s, 1, 2, 3)
    s.minimize(2)
    s.clear()
    expect(s.windows).toEqual([])
    expect(s.activeId).toBeNull()
    expect(s.zIndexOf(1)).toBe(0)
  })
})
