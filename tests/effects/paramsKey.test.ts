import { describe, expect, it } from 'vitest'
import { paramsKey } from '../../src/effects/paramsKey'

describe('paramsKey', () => {
  it('ignores time and sub-millesimal differences', () => {
    expect(paramsKey({ time: 1, paranoia: 0.5001, mist: 1 })).toBe(paramsKey({ time: 9, paranoia: 0.50004, mist: 1 }))
  })
  it('differs when a variant param differs', () => {
    expect(paramsKey({ time: 1, mist: 1 })).not.toBe(paramsKey({ time: 1, mist: 1.7 }))
  })
})
