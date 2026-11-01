import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Garde-fous de la barre des tâches sur téléphone (Chrome Android) : lus dans les sources, sans DOM.
const src = (chemin: string) => readFileSync(new URL(`../../src/${chemin}`, import.meta.url), 'utf8')

describe('barre des tâches visible sur téléphone', () => {
  it('html et body rognent tout débordement horizontal (sinon la page s’élargit, dézoome et décale la barre fixe)', () => {
    const regle = src('styles.css').match(/html,\s*body\s*\{[^}]*\}/)?.[0] ?? ''
    expect(regle).toMatch(/overflow-x:\s*clip/)
  })

  it('`.app` se limite à la hauteur visible (dvh) : UnoCSS émet `min-h-[100vh]` après `min-h-[100dvh]`, qui gagnerait', () => {
    const main = src('App.vue').match(/<main[^>]*class="app [^"]*"/s)?.[0] ?? ''
    expect(main).toContain('min-h-[100dvh]')
    expect(main).not.toContain('min-h-[100vh]')
  })
})
