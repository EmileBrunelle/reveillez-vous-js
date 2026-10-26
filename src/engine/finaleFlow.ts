/** Les événements de la finale (`collapsed`, `restart`) ne comptent que tant que la phase est la finale : le composant reste monté un instant pendant sa sortie. */
export const finaleActive = (phase: string): boolean => phase === 'finale'
