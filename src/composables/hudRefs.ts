import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue'

// Éléments du HUD des activités (bouton Pause, barre de temps) que l’activité parente doit éviter de recouvrir : l’activité les fournit (`provideHudRefs`),
// le HUD enregistre les siens (`registerLayoutEl`, voir layoutRefs.ts) et l’activité les mesure, sans requête DOM sur un nom de classe ou un rôle.
export type HudRefs = {
  pauseEl: ShallowRef<HTMLElement | null>
  barEl: ShallowRef<HTMLElement | null>
}

const createHudRefs = (): HudRefs => ({ pauseEl: shallowRef(null), barEl: shallowRef(null) })

const HUD_KEY: InjectionKey<HudRefs> = Symbol('hudRefs')

/** Appelé par l’activité : crée les références et les fournit au HUD (son descendant). */
export const provideHudRefs = (): HudRefs => {
  const refs = createHudRefs()
  provide(HUD_KEY, refs)
  return refs
}

/** Lit les références fournies ; sans fournisseur (HUD monté seul, test), des références locales vides évitent tout avertissement. */
export const useHudRefs = (): HudRefs => inject(HUD_KEY, null) ?? createHudRefs()
