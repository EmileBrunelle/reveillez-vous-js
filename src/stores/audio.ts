import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { safeStorage } from '../composables/safeStorage'

// Volumes par catégorie (0 à 1), persistés sous `rvj-audio`. Chaque catégorie a un GainNode branché sur le bus
// « général » (voir `audio/sfx.ts`) : le store ne porte que l’état, pas le câblage Web Audio.
export const AUDIO_KEY = 'rvj-audio'
export const VOLUME_KEYS = ['general', 'ambiance', 'effets', 'finale'] as const
export type VolumeKey = (typeof VOLUME_KEYS)[number]
export type Volumes = Record<VolumeKey, number>
export const DEFAULT_VOLUMES: Readonly<Volumes> = { general: 1, ambiance: 1, effets: 1, finale: 1 }

export const validVolume = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/** Lit le JSON stocké ; chaque valeur invalide ou absente retombe sur 1 sans toucher aux autres. */
export const parseVolumes = (raw: string | null): Volumes => {
  const out: Volumes = { ...DEFAULT_VOLUMES }
  if (!raw) return out
  try {
    const data: unknown = JSON.parse(raw)
    if (data && typeof data === 'object') for (const k of VOLUME_KEYS) if (validVolume((data as Record<string, unknown>)[k])) out[k] = (data as Record<string, number>)[k]
  } catch {
    /* JSON illisible : valeurs par défaut */
  }
  return out
}

const serializer = { read: parseVolumes, write: (v: Volumes): string => JSON.stringify(v) }

/** Réglages audio : volumes (localStorage) et sourdine (session seulement, jamais persistée). */
export const useAudioStore = defineStore('audio', () => {
  const volumes = useStorage<Volumes>(AUDIO_KEY, { ...DEFAULT_VOLUMES }, safeStorage(), { flush: 'sync', writeDefaults: false, listenToStorageChanges: false, serializer, onError: () => {} })
  const muted = ref(false)

  /** Règle un volume (valeur hors 0–1 ou non finie ignorée) et le persiste. */
  const setVolume = (key: VolumeKey, v: number) => {
    if (!validVolume(v)) return
    volumes.value = { ...volumes.value, [key]: v }
  }
  const resetVolumes = () => {
    volumes.value = { ...DEFAULT_VOLUMES }
  }
  const toggleMute = () => {
    muted.value = !muted.value
  }

  return { volumes, muted, setVolume, resetVolumes, toggleMute }
})
