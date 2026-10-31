// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Taskbar from '@/components/Taskbar.vue'
import { useSessionStore } from '@/stores/session'
import { useWindowsStore } from '@/stores/windows'

let wrapper: VueWrapper | undefined
const monter = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(Taskbar, { props: { level: 3 }, attachTo: document.body, global: { plugins: [pinia] } })
  return { w: wrapper, windows: useWindowsStore(), session: useSessionStore() }
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})
const boutons = (w: VueWrapper) => w.findAll('[data-win-btn]')

describe('Taskbar : boutons des fenêtres', () => {
  it('aucun bouton sans fenêtre ouverte', () => {
    const { w } = monter()
    expect(boutons(w)).toHaveLength(0)
  })

  it('un bouton par fenêtre : titre complet en aria-label, icône, ordre d’ouverture', async () => {
    const { w, windows } = monter()
    windows.open({ id: 1, title: 'Erreur fatale 0x00C0FFEE', icon: 'stop' })
    windows.open({ id: 2, title: 'Avertissement', icon: 'warn' })
    await nextTick()
    const b = boutons(w)
    expect(b.map((x) => x.attributes('aria-label'))).toEqual(['Erreur fatale 0x00C0FFEE', 'Avertissement'])
    expect(b[0].find('.truncate').text()).toBe('Erreur fatale 0x00C0FFEE')
    expect(b[0].find('[aria-hidden="true"]').text()).toBe('×')
    expect(b[0].classes()).toContain('win-btn')
    // Le titre se tronque d’abord ; à la largeur minimale (44 px), il ne reste que l’icône.
    expect(b[0].find('.truncate').classes()).toContain('min-w-0')
    expect(b[0].classes()).toEqual(expect.arrayContaining(['min-w-11', 'flex-1', 'basis-0']))
  })

  it('seul le bouton de la fenêtre active est enfoncé (aria-pressed)', async () => {
    const { w, windows } = monter()
    windows.open({ id: 1, title: 'A', icon: 'info' })
    windows.open({ id: 2, title: 'B', icon: 'info' })
    await nextTick()
    expect(boutons(w).map((x) => x.attributes('aria-pressed'))).toEqual(['false', 'true'])
    windows.focus(1)
    await nextTick()
    expect(boutons(w).map((x) => x.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(boutons(w)[0].classes().join(' ')).toContain('inset_2px_2px_grey')
    windows.minimize(1)
    windows.minimize(2)
    await nextTick()
    expect(boutons(w).map((x) => x.attributes('aria-pressed'))).toEqual(['false', 'false'])
  })

  it('un clic appelle toggle : active → réduite, puis restaurée', async () => {
    const { w, windows } = monter()
    windows.open({ id: 1, title: 'A', icon: 'info' })
    await nextTick()
    await boutons(w)[0].trigger('click')
    expect(windows.find(1)?.minimized).toBe(true)
    await boutons(w)[0].trigger('click')
    expect(windows.find(1)?.minimized).toBe(false)
  })

  it('le bouton disparaît avec sa fenêtre', async () => {
    const { w, windows } = monter()
    windows.open({ id: 1, title: 'A', icon: 'info' })
    await nextTick()
    windows.close(1)
    await nextTick()
    expect(boutons(w)).toHaveLength(0)
  })

  it('la zone des boutons rétrécit et coupe sans pousser la zone de notification', async () => {
    const { w } = monter()
    const zone = w.get('.taskbar-windows').classes()
    expect(zone).toEqual(expect.arrayContaining(['flex-1', 'min-w-0', 'overflow-hidden']))
    expect(w.get('time').element.parentElement?.classList.contains('shrink-0')).toBe(true)
  })
})

describe('Taskbar : bulle retenue au moins 1,5 s', () => {
  it('une bulle fermée puis remplacée pendant l’attente garde ses 1,5 s', async () => {
    vi.useFakeTimers()
    const { w, session } = monter()
    const visible = (t: string) => w.text().includes(t)
    const a = session.notify('Bulle A', 'a')
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    session.setActivityRunning(true) // la retenue démarre : A serait masquée dans 1,4 s
    await vi.advanceTimersByTimeAsync(400)
    session.dismiss(a) // fermée par ×
    session.notify('Bulle B', 'b')
    await nextTick()
    expect(visible('Bulle B')).toBe(true)
    await vi.advanceTimersByTimeAsync(1300) // 1,3 s après B ; avec l’ancienne minuterie (échéance à +1,0 s), B aurait disparu
    expect(visible('Bulle B')).toBe(true)
    await vi.advanceTimersByTimeAsync(400) // > 1,5 s après B
    expect(visible('Bulle B')).toBe(false)
  })
})
