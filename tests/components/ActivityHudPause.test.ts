// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import ActivityHud from '@/components/activities/ActivityHud.vue'
import { AWAY_KEY } from '@/composables/useActivityDone'

const monter = (away: boolean) => {
  const absent = ref(away)
  let reprises = 0
  const hote = defineComponent({
    render: () => h(ActivityHud, { activity: 'ouija', outcome: 'play', startedAt: Date.now() }),
  })
  const wrapper = mount(hote, {
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
  return { wrapper, absent, reprises: () => reprises }
}

describe('ActivityHud : pause « absent »', () => {
  it('sans contrôleur fourni, aucun voile', () => {
    const wrapper = mount(ActivityHud, { props: { activity: 'ouija', outcome: 'play', startedAt: Date.now() }, global: { plugins: [createPinia()] } })
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
    wrapper.unmount()
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
    const voile = wrapper.find('.bg-black\\/60')
    await voile.trigger('pointermove')
    await voile.trigger('pointerdown')
    await voile.trigger('pointerup')
    expect(parent).toEqual([])
    wrapper.unmount()
    scene.remove()
  })
})
