// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- hôtes de test : plusieurs petits composants définis dans le même fichier. */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import ActivityHud from '@/components/activities/ActivityHud.vue'
import { useActivityDone } from '@/composables/useActivityDone'

let wrapper: VueWrapper | undefined
let api!: ReturnType<typeof useActivityDone>

// Hôte réel : `useActivityDone` fournit le contrôleur au HUD, comme dans une activité.
const monter = (activity: 'candles' | 'ouija' = 'candles') => {
  const hote = defineComponent({
    setup() {
      api = useActivityDone(() => {}, { durationMs: 60_000 })
      return () => h(ActivityHud, { activity, outcome: api.outcome.value, startedAt: api.startedAt, paused: api.paused.value })
    },
  })
  wrapper = mount(hote, { attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const bouton = (nom: string) => document.body.querySelector<HTMLButtonElement>(`button[aria-label="${nom}"]`)
const reprendre = () => [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Reprendre')
const touche = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('ActivityHud : bouton Pause', () => {
  it('le bouton met en pause, « Reprendre » relance en un seul clic et le focus revient sur le bouton', async () => {
    monter()
    bouton('Mettre en pause')!.click()
    await nextTick()
    expect(api.paused.value).toBe(true)
    expect(document.body.textContent).toContain('EN PAUSE')
    await nextTick()
    expect(document.activeElement).toBe(reprendre())
    reprendre()!.click()
    await nextTick()
    await nextTick()
    expect(api.paused.value).toBe(false)
    expect(document.body.textContent).not.toContain('EN PAUSE')
    expect(document.activeElement).toBe(bouton('Mettre en pause'))
  })

  it('P bascule la pause, Échap la déclenche', async () => {
    monter()
    touche('p')
    await nextTick()
    expect(api.paused.value).toBe(true)
    touche('P')
    await nextTick()
    expect(api.paused.value).toBe(false)
    touche('Escape')
    await nextTick()
    expect(api.paused.value).toBe(true)
  })

  it('à la planche Ouija, P est une lettre : seul Échap met en pause', async () => {
    monter('ouija')
    touche('p')
    await nextTick()
    expect(api.paused.value).toBe(false)
    touche('Escape')
    await nextTick()
    expect(api.paused.value).toBe(true)
  })

  it('fenêtre qui perd le focus puis un seul clic sur « Reprendre » : le jeu reprend', async () => {
    monter()
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(api.paused.value).toBe(true)
    // Le clic ramène le focus de la fenêtre avant d’atteindre le bouton.
    window.dispatchEvent(new Event('focus'))
    await nextTick()
    reprendre()!.click()
    await nextTick()
    expect(api.paused.value).toBe(false)
  })

  it('pause voulue + fenêtre quittée : un seul « Reprendre » lève les deux', async () => {
    monter()
    touche('Escape')
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    reprendre()!.click()
    await nextTick()
    expect(api.paused.value).toBe(false)
  })

  it('la ligne « Revenez dans la fenêtre » garde sa place au retour du focus (le bouton ne bouge pas sous le clic)', async () => {
    monter()
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(document.body.textContent).toContain('Revenez dans la fenêtre')
    window.dispatchEvent(new Event('focus'))
    await nextTick()
    expect(document.body.textContent).toContain('Revenez dans la fenêtre')
  })

  it('pause en quittant la fenêtre : le contrôle du jeu qui avait le focus le retrouve à la reprise', async () => {
    // Hôte à deux frères (zone de jeu + HUD), comme dans une activité : `inert` posé sur la zone de jeu lui retire le focus.
    const hote = defineComponent({
      setup() {
        api = useActivityDone(() => {}, { durationMs: 60_000 })
        return () => [
          h('div', { 'data-testid': 'jeu' }, [h('button', { id: 'controle', type: 'button' }, 'Pendule')]),
          h(ActivityHud, { activity: 'pendulum', outcome: api.outcome.value, startedAt: api.startedAt, paused: api.paused.value }),
        ]
      },
    })
    wrapper = mount(hote, { attachTo: document.body, global: { plugins: [createPinia()] } })
    const controle = document.body.querySelector<HTMLButtonElement>('#controle')!
    controle.focus()
    expect(document.activeElement).toBe(controle)
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(controle.closest('[inert]')).not.toBeNull()
    window.dispatchEvent(new Event('focus'))
    await nextTick()
    reprendre()!.click()
    await nextTick()
    await nextTick()
    expect(controle.closest('[inert]')).toBeNull()
    expect(document.activeElement).toBe(controle)
  })

  it('le bouton disparaît quand l’issue est affichée', async () => {
    monter()
    api.finish()
    await nextTick()
    expect(bouton('Mettre en pause')).toBeNull()
  })
})
