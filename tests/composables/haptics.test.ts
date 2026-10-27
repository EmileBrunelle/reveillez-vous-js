import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canVibrate, MAX_PULSE_MS, MIN_GAP_MS, MIN_PULSE_MS, pulse, resetPulseLimiter } from '../../src/composables/haptics'

beforeEach(() => {
  resetPulseLimiter()
})

describe('canVibrate', () => {
  it('refuse sans navigator.vibrate (iOS) et accepte avec', () => {
    expect(canVibrate({})).toBe(false)
    expect(canVibrate(undefined)).toBe(false)
    expect(canVibrate({ vibrate: () => true })).toBe(true)
  })
  it('refuse quand l’onglet est caché, mais pas quand le son est coupé', () => {
    expect(canVibrate({ vibrate: () => true }, true)).toBe(false)
    expect(canVibrate({ vibrate: () => true }, false)).toBe(true)
  })
})

describe('pulse', () => {
  it('vibre avec une durée bornée à 10–30 ms', () => {
    const vibrate = vi.fn(() => true)
    expect(pulse(500, { vibrate }, 1000)).toBe(true)
    expect(vibrate).toHaveBeenLastCalledWith(MAX_PULSE_MS)
    pulse(1, { vibrate }, 2000)
    expect(vibrate).toHaveBeenLastCalledWith(MIN_PULSE_MS)
  })
  it('ne vibre pas sans vibrate', () => {
    expect(pulse(20, {}, 1000)).toBe(false)
  })
  it('n’empile pas deux impulsions trop rapprochées', () => {
    const vibrate = vi.fn(() => true)
    pulse(20, { vibrate }, 1000)
    expect(pulse(20, { vibrate }, 1000 + MIN_GAP_MS - 1)).toBe(false)
    expect(pulse(20, { vibrate }, 1000 + MIN_GAP_MS)).toBe(true)
    expect(vibrate).toHaveBeenCalledTimes(2)
  })
  it('avale une exception de vibrate', () => {
    const vibrate = () => {
      throw new Error('x')
    }
    expect(pulse(20, { vibrate }, 1000)).toBe(false)
  })
})
