import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { paranoiaLevel } from '../engine/paranoia'
import { safeStorage } from '../composables/safeStorage'

export const VISITS_KEY = 'rvj-visits'
export const MEMORY_KEY = 'rvj-memory'

export interface Memory {
  lastArcane: number | null
  /** Nom de la dernière carte (départage les arcanes qui partagent un indice : XIII / XIII bis). */
  lastNom: string | null
  lastLevel: number | null
  finished: boolean
}
const defaultMemory = (): Memory => ({ lastArcane: null, lastNom: null, lastLevel: null, finished: false })

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }
/** Numéro d’arcane (« 0 », « XVII »…) vers un entier ; null si illisible. */
export const arcaneIndex = (numero: string): number | null => {
  if (numero === '0') return 0
  numero = /^[IVXLC]+/.exec(numero)?.[0] ?? '' // « XIII bis », « XIII ½ » : on garde le chiffre romain de tête
  if (!numero) return null
  let n = 0
  for (let i = 0; i < numero.length; i++) {
    const v = ROMAN[numero[i]]
    n += v < (ROMAN[numero[i + 1]] ?? 0) ? -v : v
  }
  return n
}

// Format historique conservé : un simple nombre en clair (les joueur·euses existant·es gardent leur niveau).
const visitsSerializer = {
  read: (raw: string): number => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 ? n : 0
  },
  write: (v: number): string => String(v),
}
const intOrNull = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const memorySerializer = {
  read: (raw: string): Memory => {
    try {
      const o: unknown = JSON.parse(raw)
      if (typeof o !== 'object' || o === null) return defaultMemory()
      const m = o as Record<string, unknown>
      return { lastArcane: intOrNull(m.lastArcane), lastNom: typeof m.lastNom === 'string' && m.lastNom ? m.lastNom : null, lastLevel: intOrNull(m.lastLevel), finished: m.finished === true }
    } catch {
      return defaultMemory()
    }
  },
  write: (v: Memory): string => JSON.stringify(v),
}

export const useProgressStore = defineStore('progress', () => {
  const opts = { flush: 'sync', writeDefaults: false, listenToStorageChanges: false } as const
  const visits = useStorage(VISITS_KEY, 0, safeStorage(), { ...opts, serializer: visitsSerializer })
  const memory = useStorage(MEMORY_KEY, defaultMemory(), safeStorage(), { ...opts, serializer: memorySerializer })

  const level = computed(() => paranoiaLevel(visits.value))
  const paranoia = computed(() => (level.value - 1) / 4)

  /** Une porte rouverte de plus ; renvoie le nouveau nombre de visites. */
  const bump = () => ++visits.value
  /** Retour à 0 visite (niveau 1). Sacs de tirage et mémoire restent intacts. */
  const reset = () => {
    visits.value = 0
  }
  const remember = (arcane: string | number | null, lvl: number, nom: string | null = null) => {
    memory.value = { ...memory.value, lastArcane: typeof arcane === 'string' ? arcaneIndex(arcane) : arcane, lastNom: nom, lastLevel: lvl }
  }
  const finish = () => {
    memory.value = { ...memory.value, finished: true }
  }

  return { visits, memory, level, paranoia, bump, reset, remember, finish }
})
