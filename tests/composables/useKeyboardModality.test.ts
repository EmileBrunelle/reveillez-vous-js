import { describe, expect, it } from 'vitest'
import { keyEntersKeyboardMode } from '../../src/composables/useKeyboardModality'

describe('keyEntersKeyboardMode', () => {
  it.each(['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])('%j bascule en mode clavier', (key) => {
    expect(keyEntersKeyboardMode(key)).toBe(true)
  })

  it.each(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])('la modificatrice seule %s ne bascule pas', (key) => {
    expect(keyEntersKeyboardMode(key)).toBe(false)
  })
})
