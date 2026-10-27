import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_PULSE_MS, MIN_GAP_MS, MIN_PULSE_MS, planPulse, resetPulseLimiter } from '../../src/composables/haptics'

beforeEach(() => {
  resetPulseLimiter()
})

describe('planPulse', () => {
  it('borne la durée à 10–30 ms', () => {
    expect(planPulse(500, true, 1000)).toBe(MAX_PULSE_MS)
    expect(planPulse(1, true, 2000)).toBe(MIN_PULSE_MS)
    expect(planPulse(20, true, 3000)).toBe(20)
  })
  it('refuse quand la garde (vibrate absent, onglet caché) est fermée, sans consommer le limiteur', () => {
    expect(planPulse(20, false, 1000)).toBeNull()
    expect(planPulse(20, true, 1000)).toBe(20)
  })
  it('n’empile pas deux impulsions trop rapprochées (limiteur partagé)', () => {
    expect(planPulse(20, true, 1000)).toBe(20)
    expect(planPulse(20, true, 1000 + MIN_GAP_MS - 1)).toBeNull()
    expect(planPulse(20, true, 1000 + MIN_GAP_MS)).toBe(20)
  })
})
