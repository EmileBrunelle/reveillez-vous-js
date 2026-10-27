import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUDIO_KEY, DEFAULT_VOLUMES, useAudioStore } from '../../src/stores/audio'

const memStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const stored = () => localStorage.getItem(AUDIO_KEY)
afterEach(() => vi.unstubAllGlobals())

describe('audio store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    setActivePinia(createPinia())
  })

  it('défauts à 1, sourdine coupée, rien d’écrit au démarrage', () => {
    const s = useAudioStore()
    expect({ ...s.volumes }).toEqual(DEFAULT_VOLUMES)
    expect(s.muted).toBe(false)
    expect(stored()).toBeNull()
  })
  it('persiste un volume et le relit dans un nouveau store', () => {
    useAudioStore().setVolume('effets', 0.3)
    expect(JSON.parse(stored() as string).effets).toBe(0.3)
    setActivePinia(createPinia())
    expect(useAudioStore().volumes).toEqual({ ...DEFAULT_VOLUMES, effets: 0.3 })
  })
  it('JSON stocké illisible : défauts', () => {
    localStorage.setItem(AUDIO_KEY, '{pas du json')
    expect({ ...useAudioStore().volumes }).toEqual(DEFAULT_VOLUMES)
  })
  it('valeurs stockées invalides ignorées une à une', () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ general: 0.5, ambiance: 2, effets: -1, finale: 'fort' }))
    expect({ ...useAudioStore().volumes }).toEqual({ general: 0.5, ambiance: 1, effets: 1, finale: 1 })
  })
  it('ignore une valeur hors limites ou non finie', () => {
    const s = useAudioStore()
    s.setVolume('ambiance', 0.4)
    for (const bad of [NaN, Infinity, -0.1, 1.1]) s.setVolume('ambiance', bad)
    expect(s.volumes.ambiance).toBe(0.4)
  })
  it('resetVolumes remet tout à 1 et le persiste', () => {
    const s = useAudioStore()
    s.setVolume('general', 0.2)
    s.setVolume('finale', 0.1)
    s.resetVolumes()
    expect({ ...s.volumes }).toEqual(DEFAULT_VOLUMES)
    expect(JSON.parse(stored() as string)).toEqual(DEFAULT_VOLUMES)
  })
  it('la sourdine n’est jamais persistée', () => {
    const s = useAudioStore()
    s.toggleMute()
    expect(s.muted).toBe(true)
    expect(stored()).toBeNull()
    setActivePinia(createPinia())
    expect(useAudioStore().muted).toBe(false)
  })
})
