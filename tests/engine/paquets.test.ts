import { describe, expect, it } from 'vitest'
import { prophecies } from '../../src/content/prophecies'
import { drawArcane } from '../../src/engine/prophecy'
import { PAQUETS, shufflePaquets } from '../../src/engine/paquets'
import { mulberry32 } from '../../src/engine/rng'

type Row = Record<string, string>
const rows = prophecies.arcane as Row[]

describe('paquets', () => {
  it('chaque arcane appartient à un paquet connu', () => {
    expect(rows.every((a) => (PAQUETS as readonly string[]).includes(a.paquet))).toBe(true)
  })

  it('chaque paquet a au moins un arcane à chaque niveau 1-5 (sans même le repli)', () => {
    for (const p of PAQUETS) for (const n of [1, 2, 3, 4, 5]) expect(rows.some((a) => a.paquet === p && a.niveaux.includes(String(n)))).toBe(true)
  })

  it('choisir un paquet ne donne que ses arcanes quand il en a pour le niveau', () => {
    for (const p of PAQUETS)
      for (const n of [1, 2, 3, 4, 5])
        for (let seed = 1; seed <= 40; seed++) {
          const a = drawArcane(prophecies, n, mulberry32(seed), p)
          expect(a.paquet).toBe(p)
          expect(rows.find((r) => r.nom === a.nom)?.niveaux).toContain(String(n))
        }
  })

  it('repli : un paquet sans arcane au niveau pige dans les autres paquets de ce niveau', () => {
    const g = { arcane: [{ numero: 'I', nom: 'A', symbole: 'moon', paquet: 'nuit', niveaux: '1' }] }
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
