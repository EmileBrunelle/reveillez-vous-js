// Chargeurs partagés : le même `import()` sert au composant async et au préchargement (le cache de modules évite le double téléchargement).
export const loadDoorScene = () => import('./components/DoorScene.vue')
export const loadTarotCard = () => import('./components/TarotCard.vue')
export const loadAbout = () => import('./components/AboutTempleOS.vue')
export const loadReset = () => import('./components/ResetConfirm.vue')
/** Précharge sans jamais lever (réseau coupé : le chargement « pour de vrai » réessaiera). */
export const prefetch = (...loaders: (() => Promise<unknown>)[]) => loaders.forEach((l) => void l().catch(() => undefined))
