import { describe, expect, it } from 'vitest'
import { ACTIVITY_PROMPTS, type TimedActivity } from '../../src/content/activityPrompts'
import { MAX_ACTIVITY_MS, OUTCOME_MS, durationOf, outcomeAt, timeLeft } from '../../src/engine/activityTiming'

const ids = Object.keys(ACTIVITY_PROMPTS) as TimedActivity[]

describe('activityTiming', () => {
  it('chaque activité a une durée dans [5 s ; plafond]', () => {
    for (const id of ids) {
      expect(durationOf(id), id).toBeGreaterThanOrEqual(5000)
      expect(durationOf(id), id).toBeLessThanOrEqual(MAX_ACTIVITY_MS)
    }
  })

  it('l’issue d’affichage dure environ 1 s', () => {
    expect(OUTCOME_MS).toBe(1000)
  })

  it('réussite avant la fin du temps, échec sinon', () => {
    expect(outcomeAt(3000, 8000, true)).toBe('win')
    expect(outcomeAt(7999, 8000, true)).toBe('win')
    expect(outcomeAt(8000, 8000, true)).toBe('fail')
    expect(outcomeAt(9000, 8000, true)).toBe('fail')
    expect(outcomeAt(1000, 8000, false)).toBe('fail')
  })

  it('la part de temps restante décroît de 1 à 0 et reste bornée', () => {
    expect(timeLeft(0, 8000)).toBe(1)
    expect(timeLeft(2000, 8000)).toBe(0.75)
    expect(timeLeft(8000, 8000)).toBe(0)
    expect(timeLeft(20_000, 8000)).toBe(0)
    expect(timeLeft(-5, 8000)).toBe(1)
    expect(timeLeft(10, 0)).toBe(0)
  })

  it('chaque verbe est un impératif en capitales terminé par « ! »', () => {
    for (const id of ids) expect(ACTIVITY_PROMPTS[id].verb, id).toMatch(/^[A-ZÉÈÀÂÊÎÔÛÇ’ ]+ !$/u)
  })
})
