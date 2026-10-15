// Chargeurs partagés : le même `import()` sert au composant async et au préchargement (le cache de modules évite le double téléchargement).
import type { Component } from 'vue'
export const loadDoorScene = () => import('./components/DoorScene.vue')
export const loadTarotCard = () => import('./components/TarotCard.vue')
export const loadAbout = () => import('./components/AboutTempleOS.vue')
export const loadReset = () => import('./components/ResetConfirm.vue')
export const loadDeckCut = () => import('./components/DeckCut.vue')
export const loadFinale = () => import('./components/FinaleStub.vue')
/** Activité jouée avant la coupe du paquet, par niveau (niveau 1 : aucune). */
const activities: Record<number, () => Promise<{ default: Component }>> = {
  2: () => import('./components/activities/WispsActivity.vue'),
  3: () => import('./components/activities/CandlesActivity.vue'),
  4: () => import('./components/activities/WindowsActivity.vue'),
  5: () => import('./components/activities/CrystalActivity.vue'),
}
export const activityFor = (level: number) => activities[level] ?? null
/** Précharge sans jamais lever (réseau coupé : le chargement « pour de vrai » réessaiera). */
export const prefetch = (...loaders: (() => Promise<unknown>)[]) => loaders.forEach((l) => void l().catch(() => undefined))
