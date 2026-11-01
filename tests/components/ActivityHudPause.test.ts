// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import ActivityHud from '@/components/activities/ActivityHud.vue'
import { AWAY_KEY } from '@/composables/useActivityDone'

// Tout composant monté est démonté en fin de test : l’effacement du verbe démarre à 800 ms (`dockLater`), un composant resté monté laisserait une animation annulée plus tard (AbortError non gérée).
const montes: VueWrapper[] = []
afterEach(() => {
  for (const w of montes.splice(0)) w.unmount()
  document.body.innerHTML = ''
})

const monter = (away: boolean) => {
  const absent = ref(away)
  let reprises = 0
  const hote = defineComponent({
    render: () => h(ActivityHud, { activity: 'ouija', outcome: 'play', startedAt: Date.now() }),
  })
  const wrapper = mount(hote, {
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
      provide: {
        [AWAY_KEY as symbol]: {
          away: absent,
          resumeAway: () => {
            reprises++
            absent.value = false
          },
        },
      },
    },
  })
  montes.push(wrapper)
  return { wrapper, absent, reprises: () => reprises }
}

describe('ActivityHud : pause « absent »', () => {
  it('sans contrôleur fourni, aucun voile', () => {
    const wrapper = mount(ActivityHud, { props: { activity: 'ouija', outcome: 'play', startedAt: Date.now() }, global: { plugins: [createPinia()] } })
    montes.push(wrapper)
    expect(wrapper.text()).not.toContain('EN PAUSE')
  })

  it('affiche le voile et le bouton « Reprendre » ; le bouton lève la pause', async () => {
    const { wrapper, absent, reprises } = monter(true)
    expect(wrapper.text()).toContain('EN PAUSE')
    expect(wrapper.find('[role="status"]').text()).toBe('Jeu en pause.')
    const bouton = wrapper.find('button')
    expect(bouton.text()).toBe('Reprendre')
    await bouton.trigger('click')
    expect(reprises()).toBe(1)
    expect(absent.value).toBe(false)
    await nextTick()
    expect(wrapper.text()).not.toContain('EN PAUSE')
  })

  it('le voile arrête les pointeurs : la scène derrière ne les reçoit pas', async () => {
    const parent: string[] = []
    const scene = document.createElement('div')
    document.body.append(scene)
    for (const type of ['pointermove', 'pointerdown', 'pointerup']) scene.addEventListener(type, () => parent.push(type))
    const absent = ref(true)
    const wrapper = mount(ActivityHud, {
      props: { activity: 'ouija', outcome: 'play', startedAt: Date.now() },
      attachTo: scene,
      global: { plugins: [createPinia()], provide: { [AWAY_KEY as symbol]: { away: absent, resumeAway: () => (absent.value = false) } } },
    })
    montes.push(wrapper)
    const voile = wrapper.find('.bg-black\\/60')
    await voile.trigger('pointermove')
    await voile.trigger('pointerdown')
    await voile.trigger('pointerup')
    expect(parent).toEqual([])
    scene.remove()
  })

  it('en pause, la zone de jeu est inerte ; le voile, Pause et Reprendre restent atteignables ; la reprise lève l’inertie', async () => {
    const absent = ref(false)
    const hote = defineComponent({
      render: () => h('div', [h('div', { class: 'jeu' }, [h('button', { class: 'dans-le-jeu' }, 'Jouer')]), h(ActivityHud, { activity: 'ouija', outcome: 'play', startedAt: Date.now() })]),
    })
    const wrapper = mount(hote, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        provide: { [AWAY_KEY as symbol]: { away: absent, resumeAway: () => (absent.value = false), pauseByPlayer: () => (absent.value = true) } },
      },
    })
    montes.push(wrapper)
    const jeu = wrapper.get('.jeu').element
    const hud = wrapper.get('[data-testid="activity-hud"]').element
    expect(jeu.hasAttribute('inert')).toBe(false)
    absent.value = true
    await nextTick()
    expect(jeu.hasAttribute('inert')).toBe(true)
    expect(hud.hasAttribute('inert')).toBe(false)
    expect(hud.closest('[inert]')).toBeNull()
    const reprendre = wrapper.findAll('button').find((b) => b.text() === 'Reprendre')!
    expect(reprendre.element.closest('[inert]')).toBeNull()
    await reprendre.trigger('click')
    await nextTick()
    expect(jeu.hasAttribute('inert')).toBe(false)
    // Monté déjà en pause : même règle.
    wrapper.unmount()
    montes.length = 0
    absent.value = true
    const second = mount(hote, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [AWAY_KEY as symbol]: { away: absent, resumeAway: () => (absent.value = false) } } } })
    montes.push(second)
    expect(second.get('.jeu').element.hasAttribute('inert')).toBe(true)
  })
})
