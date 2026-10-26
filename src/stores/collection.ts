import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { prophecies } from '../content/prophecies'
import { arcaneInventory, consulted, emptyCollection, parseCollection, seenCount, withSeen, type Collection } from '../engine/collection'
import { safeStorage } from '../composables/safeStorage'

export const COLLECTION_KEY = 'rvj-collection'

const serializer = { read: parseCollection, write: (v: Collection): string => JSON.stringify(v) }

/** Collection d’arcanes (localStorage). Survit à « Recommencer » de la finale ; seule la remise à zéro complète l’efface. */
export const useCollectionStore = defineStore('collection', () => {
  const state = useStorage(COLLECTION_KEY, emptyCollection(), safeStorage(), { flush: 'sync', writeDefaults: false, listenToStorageChanges: false, serializer })
  const inventory = arcaneInventory(prophecies)
  const total = inventory.length
  const count = computed(() => seenCount(state.value, inventory))
  const seen = computed(() => new Set(state.value.seen))
  const fresh = computed(() => state.value.fresh)

  /** Enregistre l’arcane révélé à la lecture (idempotent). */
  const record = (nom: string) => {
    const next = withSeen(state.value, nom)
    if (next !== state.value) state.value = next
  }
  /** La fenêtre Collection a été fermée : plus de « nouveau ». */
  const consult = () => {
    const next = consulted(state.value)
    if (next !== state.value) state.value = next
  }
  /** Remise à zéro complète (menu Démarrer, « Oublier »). */
  const clear = () => {
    state.value = emptyCollection()
  }

  return { inventory, total, count, seen, fresh, record, consult, clear }
})
