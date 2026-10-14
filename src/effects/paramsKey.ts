/** Clé stable des paramètres d’un lieu : hors `time`, valeurs arrondies à 3 décimales (la paranoïa converge lentement, sans redessin inutile). */
export const paramsKey = (params: Record<string, number>): string =>
  Object.entries(params)
    .filter(([k]) => k !== 'time')
    .map(([k, v]) => `${k}=${v.toFixed(3)}`)
    .join(',')
