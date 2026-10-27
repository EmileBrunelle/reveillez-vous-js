import { describe, expect, it } from 'vitest'
import { DROP_EXTENT, DWELL_MS, advanceDwell, clampDrop, nextLetter, normalizeKey, pickDriftAt, pickWord, pressLetter, shouldDrift, wrongLetterMessage } from '../../src/engine/ouija'
import { mulberry32 } from '../../src/engine/rng'

describe('ouija', () => {
  it('valide une lettre après DWELL_MS de survol, retombe sans survol', () => {
    let p = 0
    for (let t = 0; t < DWELL_MS; t += 100) p = advanceDwell(p, true, 100)
    expect(p).toBeCloseTo(1, 6)
    expect(advanceDwell(0.5, false, 100)).toBeLessThan(0.5)
    expect(advanceDwell(0.01, false, 1000)).toBe(0)
  })
  it('normalise les touches : accents retirés, majuscules, le reste ignoré', () => {
    expect(normalizeKey('a')).toBe('A')
    expect(normalizeKey('é')).toBe('E')
    expect(normalizeKey('Ç')).toBe('C')
    for (const k of ['Enter', 'ArrowLeft', '1', ' ', '-', 'ab']) expect(normalizeKey(k)).toBeNull()
  })
  it('progression : seule la lettre attendue avance, jusqu’à la fin du mot', () => {
    expect(nextLetter('LUNE', 0)).toBe('L')
    expect(pressLetter('LUNE', 0, 'U')).toBe(0)
    let i = 0
    for (const l of 'LUNE') i = pressLetter('LUNE', i, l)
    expect(i).toBe(4)
    expect(nextLetter('LUNE', i)).toBeNull()
    expect(pressLetter('LUNE', i, 'E')).toBe(4)
  })
  it('pickWord : tiré au Rng, jamais le précédent', () => {
    const words = ['LUNE', 'SORT', 'NUIT']
    for (let seed = 1; seed <= 100; seed++) expect(pickWord(words, mulberry32(seed), 'SORT')).not.toBe('SORT')
    expect(pickWord(['LUNE'], mulberry32(1), 'LUNE')).toBe('LUNE')
    expect(pickWord(words, mulberry32(3))).toBe(pickWord(words, mulberry32(3)))
  })
  it('dérive : aucune sous le niveau 4, sinon une fois entre la 1re et l’avant-dernière lettre', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const level of [1, 2, 3]) expect(pickDriftAt(level, 5, mulberry32(seed))).toBe(-1)
      for (const level of [4, 5]) {
        const at = pickDriftAt(level, 5, mulberry32(seed))
        expect(at).toBeGreaterThanOrEqual(1)
        expect(at).toBeLessThanOrEqual(4)
      }
    }
    const seen = new Set(Array.from({ length: 200 }, (_, s) => pickDriftAt(4, 6, mulberry32(s + 1))))
    expect(seen.size).toBeGreaterThan(2)
  })
  it('la dérive part une seule fois, au bon compte', () => {
    expect(shouldDrift(2, 2, false)).toBe(true)
    expect(shouldDrift(2, 2, true)).toBe(false)
    expect(shouldDrift(2, 1, false)).toBe(false)
    expect(shouldDrift(-1, 0, false)).toBe(false)
  })
  it('clampDrop garde toute la goutte dans la scène, pour chaque cible (lettres, OUI, NON, AU REVOIR en bas)', () => {
    const { left, right, top, bottom } = DROP_EXTENT
    for (const [w, h] of [
      [384, 600],
      [384, 677],
      [1280, 497],
      [1280, 737],
    ]) {
      // Cibles : coins, centre, et AU REVOIR / OUI / NON placés à ras du bord bas ou au-delà.
      const targets = [
        [0, 0],
        [w / 2, h],
        [w / 2, h + 40],
        [w + 50, h / 2],
        [-30, -30],
        [w / 2 - 80, h - 10],
        [w / 2, h / 2],
      ]
      for (const [x, y] of targets) {
        const c = clampDrop(x, y, w, h)
        expect(c.x - left).toBeGreaterThanOrEqual(0)
        expect(c.x + right).toBeLessThanOrEqual(w)
        expect(c.y - top).toBeGreaterThanOrEqual(0)
        expect(c.y + bottom).toBeLessThanOrEqual(h)
      }
    }
  })
  it('clampDrop ne bouge pas une cible déjà dans les bornes', () => {
    expect(clampDrop(100, 200, 384, 600)).toEqual({ x: 100, y: 200 })
  })

  it('annonce une mauvaise lettre : la lettre touchée et la lettre attendue', () => {
    expect(wrongLetterMessage('Z', 'M')).toBe('Z : ce n’est pas la bonne lettre. La lettre attendue est M.')
    // Deux essais différents ne donnent pas le même texte (la région aria-live ne réannonce pas un texte identique).
    expect(wrongLetterMessage('Z', 'M')).not.toBe(wrongLetterMessage('Y', 'M'))
    expect(wrongLetterMessage('Z', null)).toBe('Z : ce n’est pas la bonne lettre.')
  })
})
