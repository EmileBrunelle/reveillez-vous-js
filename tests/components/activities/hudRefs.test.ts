// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import ActivityHud from '@/components/activities/ActivityHud.vue'
import { AWAY_KEY } from '@/composables/useActivityDone'
import { provideHudRefs, type HudRefs } from '@/composables/hudRefs'
import { horloge } from './aide'

vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })) }))
vi.mock('@/audio/stinger', () => ({ playStinger: vi.fn(() => vi.fn()) }))
vi.mock('@/audio/music', () => ({ setMusicTension: vi.fn(), releaseMusicTension: vi.fn() }))

let wrapper: VueWrapper | undefined
beforeEach(() => horloge())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

describe('références du HUD fournies à l’activité', () => {
  it('le HUD publie son bouton Pause et sa barre, et les retire au démontage', async () => {
    let refs!: HudRefs
    const Parent = defineComponent({
      setup() {
        refs = provideHudRefs()
        return () => h(ActivityHud, { activity: 'wisps', outcome: 'play', startedAt: Date.now() })
      },
    })
    wrapper = mount(Parent, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [AWAY_KEY as symbol]: { away: ref(false), resumeAway: () => {}, pauseByPlayer: () => {} } } } })
    expect(refs.pauseEl.value?.getAttribute('aria-label')).toBe('Mettre en pause')
    expect(refs.barEl.value?.getAttribute('role')).toBe('progressbar')
    wrapper.unmount()
    wrapper = undefined
    expect(refs.pauseEl.value).toBeNull()
    expect(refs.barEl.value).toBeNull()
  })
})
