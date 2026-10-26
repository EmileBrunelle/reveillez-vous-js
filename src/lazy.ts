// Chargeurs partagés : le même `import()` sert au composant async et au préchargement (le cache de modules évite le double téléchargement).
import type { Component } from 'vue'
import type { ActivityId } from './engine/activityPick'
export const loadDoorScene = () => import('./components/DoorScene.vue')
export const loadTarotCard = () => import('./components/TarotCard.vue')
export const loadAbout = () => import('./components/AboutTempleOS.vue')
export const loadReset = () => import('./components/ResetConfirm.vue')
export const loadDeckCut = () => import('./components/DeckCut.vue')
export const loadFinale = () => import('./components/FinaleStub.vue')
/** Activité jouée avant la coupe du paquet, par id (choix : `engine/activityPick`). */
const activities: Record<ActivityId, () => Promise<{ default: Component }>> = {
  wisps: () => import('./components/activities/WispsActivity.vue'),
  candles: () => import('./components/activities/CandlesActivity.vue'),
  windows: () => import('./components/activities/WindowsActivity.vue'),
  crystal: () => import('./components/activities/CrystalActivity.vue'),
}
export const activityFor = (id: ActivityId | null) => (id ? activities[id] : null)
/** Précharge sans jamais lever (réseau coupé : le chargement « pour de vrai » réessaiera). */
export const prefetch = (...loaders: (() => Promise<unknown>)[]) => loaders.forEach((l) => void l().catch(() => undefined))
