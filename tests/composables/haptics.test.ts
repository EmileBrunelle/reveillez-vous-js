import { beforeEach, describe, expect, it, vi } from 'vitest'
import { muted } from '../../src/audio/sfx'
import { canVibrate, MAX_PULSE_MS, MIN_GAP_MS, MIN_PULSE_MS, pulse, resetPulseLimiter } from '../../src/composables/haptics'

beforeEach(() => {
  muted.value = false
  resetPulseLimiter()
})

describe('canVibrate', () => {
  it('refuse sans navigator.vibrate (iOS) et accepte avec', () => {
    expect(canVibrate({})).toBe(false)
    expect(canVibrate(undefined)).toBe(false)
    expect(canVibrate({ vibrate: () => true })).toBe(true)
  })
  it('refuse quand le son est coupé', () => {
    muted.value = true
    expect(canVibrate({ vibrate: () => true })).toBe(false)
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
  it('ne vibre pas si muet ou sans vibrate', () => {
    const vibrate = vi.fn(() => true)
    muted.value = true
    expect(pulse(20, { vibrate }, 1000)).toBe(false)
    muted.value = false
    expect(pulse(20, {}, 1000)).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
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
