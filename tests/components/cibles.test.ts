import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Pas de DOM dans l’environnement de test : ces garde-fous lisent les gabarits (WCAG 2.5.8 et 2.5.3).
const sfc = (nom: string) => readFileSync(new URL(`../../src/components/${nom}.vue`, import.meta.url), 'utf8')

describe('cibles et noms accessibles', () => {
  it('FakeErrors : le bouton de fermeture fait au moins 24×24 px (WCAG 2.5.8) et rend le focus à la fermeture', () => {
    const src = sfc('FakeErrors')
    const bouton = src.match(/<button[^>]*aria-label="Fermer la fausse erreur"/s)?.[0] ?? ''
    expect(bouton).toContain('min-w-6')
    expect(bouton).toContain('min-h-6')
    expect(src).toContain('lastOutside') // élément à qui le focus revient
  })

  it('Finale : le lien du README garde son texte visible comme nom (WCAG 2.5.3), « nouvel onglet » en sr-only', () => {
    const lien = sfc('Finale').match(/<a [^>]*target="_blank"[\s\S]*?<\/a\s*>/)?.[0] ?? ''
    expect(lien).not.toContain('aria-label')
    expect(lien).toContain('README_LABEL')
    expect(lien).toMatch(/class="sr-only"> \(nouvel onglet\)/)
  })
})
