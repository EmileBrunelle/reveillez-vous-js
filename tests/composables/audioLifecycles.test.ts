import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  stopAmbience: vi.fn(),
  stopMusic: vi.fn(),
  startAmbience: vi.fn(),
  startMusic: vi.fn(),
  cancel: vi.fn(),
  scheduleKnocks: vi.fn(),
  stopStinger: vi.fn(),
  playStinger: vi.fn(),
  wipe: { move: vi.fn(), rest: vi.fn(), stop: vi.fn() },
  startWipeSound: vi.fn(),
  finale: { stop: vi.fn(), bell: vi.fn() },
  startFinaleAudio: vi.fn(),
}))
vi.mock('../../src/audio/ambience', () => ({ startAmbience: mocks.startAmbience }))
vi.mock('../../src/audio/music', () => ({ startMusic: mocks.startMusic }))
vi.mock('../../src/audio/sfx', async () => {
  const { ref: r } = await import('vue')
  return { scheduleKnocks: mocks.scheduleKnocks, muted: r(false) }
})
vi.mock('../../src/audio/stinger', () => ({ playStinger: mocks.playStinger }))
vi.mock('../../src/audio/wipe', () => ({ startWipeSound: mocks.startWipeSound }))
vi.mock('../../src/audio/finale', () => ({ startFinaleAudio: mocks.startFinaleAudio }))

import { muted } from '../../src/audio/sfx'
import { usePlaceAudio } from '../../src/composables/usePlaceAudio'
import { useKnockSchedule } from '../../src/composables/useKnockSchedule'
import { useStinger } from '../../src/composables/useStinger'
import { useWipeSound } from '../../src/composables/useWipeSound'
import { useFinaleAudio } from '../../src/composables/useFinaleAudio'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.startAmbience.mockReturnValue(mocks.stopAmbience)
  mocks.startMusic.mockReturnValue(mocks.stopMusic)
  mocks.scheduleKnocks.mockReturnValue({ cancel: mocks.cancel })
  mocks.playStinger.mockReturnValue(mocks.stopStinger)
  mocks.startWipeSound.mockReturnValue(mocks.wipe)
  mocks.startFinaleAudio.mockReturnValue(mocks.finale)
  ;(muted as unknown as { value: boolean }).value = false
})

describe('usePlaceAudio', () => {
  it('démarre ambiance et piano au montage, les arrête seuls à la destruction', () => {
    const scope = effectScope()
    scope.run(() =>
      usePlaceAudio(
        () => 'forest' as never,
        () => 3,
      ),
    )
    expect(mocks.startAmbience).toHaveBeenCalledWith('forest', expect.any(Function))
    expect(mocks.startMusic).toHaveBeenCalledOnce()
    expect(mocks.stopAmbience).not.toHaveBeenCalled()
    scope.stop()
    expect(mocks.stopAmbience).toHaveBeenCalledOnce()
    expect(mocks.stopMusic).toHaveBeenCalledOnce()
  })
})

describe('useKnockSchedule', () => {
  it('annule le calendrier à la destruction (et à la demande)', () => {
    const scope = effectScope()
    const k = scope.run(() => useKnockSchedule())!
    k.schedule([0, 1], 0.5, () => {})
    expect(mocks.scheduleKnocks).toHaveBeenCalledOnce()
    scope.stop()
    expect(mocks.cancel).toHaveBeenCalledOnce()
  })
  it('sans calendrier, cancel ne fait rien', () => {
    const scope = effectScope()
    scope.run(() => useKnockSchedule())
    expect(() => scope.stop()).not.toThrow()
  })
})

describe('useStinger', () => {
  it('coupe le jingle à la destruction', () => {
    const scope = effectScope()
    const s = scope.run(() => useStinger())!
    s.play('win', 0)
    scope.stop()
    expect(mocks.stopStinger).toHaveBeenCalledOnce()
  })
  it('coupe le jingle si le son passe en muet', async () => {
    const scope = effectScope()
    const s = scope.run(() => useStinger())!
    s.play('fail')
    ;(muted as unknown as { value: boolean }).value = true
    await Promise.resolve()
    expect(mocks.stopStinger).toHaveBeenCalledOnce()
    scope.stop()
  })
})

describe('useWipeSound', () => {
  it('crée le son au premier move, le coupe à la destruction', () => {
    const scope = effectScope()
    const w = scope.run(() => useWipeSound())!
    w.rest() // avant tout geste : rien
    expect(mocks.startWipeSound).not.toHaveBeenCalled()
    w.move(1)
    w.move(2)
    expect(mocks.startWipeSound).toHaveBeenCalledOnce()
    scope.stop()
    expect(mocks.wipe.stop).toHaveBeenCalledOnce()
  })
  it('stop() libère le son ; un nouveau move en recrée un', () => {
    const w = effectScope().run(() => useWipeSound())!
    w.move(1)
    w.stop()
    w.move(1)
    expect(mocks.startWipeSound).toHaveBeenCalledTimes(2)
  })
})

describe('useFinaleAudio', () => {
  it('coupe le son de la finale à la destruction', () => {
    const scope = effectScope()
    const audio = scope.run(() => useFinaleAudio())!
    expect(audio).toBe(mocks.finale)
    scope.stop()
    expect(mocks.finale.stop).toHaveBeenCalledOnce()
  })
})
