import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { COLLECTION_KEY, useCollectionStore } from '../../src/stores/collection'
import { useProgressStore } from '../../src/stores/progress'
import { arcaneInventory, consulted, emptyCollection, parseCollection, seenCount, withSeen } from '../../src/engine/collection'
import { prophecies } from '../../src/content/prophecies'

const m = new Map<string, string>()
const stub = (map: Map<string, string>) => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) })
const fresh = () => {
  setActivePinia(createPinia())
  return useCollectionStore()
}
const NOMS = (prophecies.arcane as Record<string, string>[]).map((a) => a.nom)

describe('inventaire', () => {
  it('compte exactement les arcanes du contenu, sans doublon', () => {
    const inv = arcaneInventory(prophecies)
    expect(inv.length).toBe(NOMS.length)
    expect(new Set(inv.map((e) => e.nom)).size).toBe(inv.length)
    expect(inv.map((e) => e.nom)).toEqual(NOMS)
  })
  it('table absente ou en chaînes : inventaire vide', () => {
    expect(arcaneInventory({})).toEqual([])
    expect(arcaneInventory({ arcane: ['a'] })).toEqual([])
  })
})

describe('logique pure', () => {
  it('ajout idempotent, nouveau et consulté', () => {
    const a = withSeen(emptyCollection(), 'Le Mat')
    expect(a).toEqual({ seen: ['Le Mat'], fresh: 'Le Mat' })
    expect(withSeen(a, 'Le Mat')).toBe(a)
    const b = withSeen(a, 'La Lune')
    expect(b).toEqual({ seen: ['Le Mat', 'La Lune'], fresh: 'La Lune' })
    expect(consulted(b)).toEqual({ seen: ['Le Mat', 'La Lune'], fresh: null })
    expect(withSeen(emptyCollection(), '')).toEqual(emptyCollection())
  })
  it('compteur : ignore les noms hors inventaire', () => {
    const inv = arcaneInventory(prophecies)
    expect(seenCount({ seen: ['Le Mat', 'Inconnu'], fresh: null }, inv)).toBe(1)
  })
  it('lecture tolérante', () => {
    expect(parseCollection('pas du json')).toEqual(emptyCollection())
    expect(parseCollection('42')).toEqual(emptyCollection())
    expect(parseCollection('{"seen":["A",3,"A"],"fresh":"B"}')).toEqual({ seen: ['A'], fresh: null })
    expect(parseCollection('{"seen":["A"],"fresh":"A"}')).toEqual({ seen: ['A'], fresh: 'A' })
  })
})

describe('store collection', () => {
  beforeEach(() => {
    m.clear()
    vi.stubGlobal('localStorage', stub(m))
    vi.stubGlobal('sessionStorage', stub(new Map()))
  })

  it('commence vide avec le total du contenu', () => {
    const c = fresh()
    expect(c.count).toBe(0)
    expect(c.total).toBe(NOMS.length)
    expect(c.fresh).toBeNull()
  })

  it('enregistre sans doublon, persiste dans rvj-collection, relit au démarrage', () => {
    const c = fresh()
    c.record('Le Mat')
    c.record('Le Mat')
    c.record('La Lune')
    expect(c.count).toBe(2)
    expect(c.fresh).toBe('La Lune')
    expect(JSON.parse(m.get(COLLECTION_KEY) ?? '{}')).toEqual({ seen: ['Le Mat', 'La Lune'], fresh: 'La Lune' })
    const again = fresh()
    expect(again.count).toBe(2)
    expect(again.fresh).toBe('La Lune')
  })

  it('consult efface le nouveau, pas les arcanes vus', () => {
    const c = fresh()
    c.record('Le Mat')
    c.consult()
    expect(c.fresh).toBeNull()
    expect(c.count).toBe(1)
    expect(fresh().fresh).toBeNull()
  })

  it('survit à completeFinale', () => {
    const c = fresh()
    c.record('Le Mat')
    useProgressStore().completeFinale()
    expect(c.count).toBe(1)
    expect(fresh().count).toBe(1)
  })

  it('clear (remise à zéro complète) efface tout', () => {
    const c = fresh()
    c.record('Le Mat')
    c.clear()
    expect(c.count).toBe(0)
    expect(c.fresh).toBeNull()
    expect(fresh().count).toBe(0)
  })

  it('stockage indisponible : fonctionne en mémoire sans lever', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    const c = fresh()
    expect(() => c.record('Le Mat')).not.toThrow()
    expect(c.count).toBe(1)
  })
})
