import { describe, expect, it } from 'vitest'
import { prophecies } from '../../src/content/prophecies'
import type { ArcaneTable, Grammar } from '../../src/engine/grammar'
import { drawArcane } from '../../src/engine/prophecy'
import { PAQUETS, PAQUET_NOMS, PAQUET_PRESAGES, shufflePaquets } from '../../src/engine/paquets'
import { mulberry32 } from '../../src/engine/rng'

const NIVEAUX = [1, 2, 3, 4, 5] as const
const rows = prophecies.arcane as ArcaneTable

describe('paquets', () => {
  it('chaque arcane appartient à un paquet connu', () => {
    expect(rows.every((a) => (PAQUETS as readonly string[]).includes(a.paquet))).toBe(true)
  })

  it('chaque paquet a au moins un arcane à chaque niveau 1-5 (sans même le repli)', () => {
    for (const p of PAQUETS) for (const n of NIVEAUX) expect(rows.some((a) => a.paquet === p && a.niveaux.includes(n))).toBe(true)
  })

  it('choisir un paquet ne donne que ses arcanes quand il en a pour le niveau', () => {
    for (const p of PAQUETS)
      for (const n of NIVEAUX)
        for (let seed = 1; seed <= 40; seed++) {
          const a = drawArcane(prophecies, n, mulberry32(seed), p)
          expect(a.paquet).toBe(p)
          expect(rows.find((r) => r.nom === a.nom)?.niveaux).toContain(n)
        }
  })

  it('repli : un paquet sans arcane au niveau pige dans les autres paquets de ce niveau', () => {
    const g: Grammar = { arcane: [{ numero: 'I', nom: 'A', symbole: 'moon', paquet: 'nuit', niveaux: [1] }] }
    const a = drawArcane(g, 1, mulberry32(1), 'feu')
    expect(a.nom).toBe('A')
    expect(a.paquet).toBe('nuit')
  })

  it('l’ordre de l’éventail est une permutation, déterministe pour un Rng donné', () => {
    const o = shufflePaquets(mulberry32(5))
    expect([...o].sort()).toEqual([...PAQUETS].sort())
    expect(shufflePaquets(mulberry32(5))).toEqual(o)
    expect(new Set(Array.from({ length: 30 }, (_, i) => shufflePaquets(mulberry32(i)).join())).size).toBeGreaterThan(2)
  })
})

describe('présages des paquets', () => {
  const entries = Object.entries(PAQUET_PRESAGES)
  it('un présage par paquet, rien de plus', () => {
    expect(entries.map(([k]) => k).sort()).toEqual([...PAQUETS].sort())
  })
  it('apostrophe typographique, jamais droite', () => {
    for (const [, t] of entries) expect(t).not.toContain("'")
  })
  it('une ligne courte : 3 à 10 mots, 50 caractères au plus, ponctuation finale', () => {
    for (const [, t] of entries) {
      const mots = t.split(/\s+/).length
      expect(mots).toBeGreaterThanOrEqual(3)
      expect(mots).toBeLessThanOrEqual(10)
      expect(t.length).toBeLessThanOrEqual(50)
      expect(t).toMatch(/[.!…]$/)
    }
  })
  it('chaque paquet a un nom', () => {
    for (const p of PAQUETS) expect(PAQUET_NOMS[p].length).toBeGreaterThan(0)
  })
})
