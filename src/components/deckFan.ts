// Éventail des trois cartes de la coupe : partagé entre DeckCut (placement) et TarotCard (point de départ de la donne).
// x/y en % de la largeur de la carte finale (centre de la boîte = 0,0), rot en degrés ; FAN_SCALE = largeur affichée d’une carte de l’éventail, en fraction de la boîte (la carte, large comme la boîte, est réduite à cette échelle puis grandit jusqu’à 1 au choix).
export const FAN_SCALE = 0.5
export const FAN = [
  { x: -17, y: 3, rot: -4 },
  { x: 0, y: -1, rot: 0 },
  { x: 17, y: 3, rot: 4 },
] as const

// Pile de rangement : « rien ne vient de nulle part pour aller nulle part ». Les deux cartes non choisies y glissent au choix, la carte de lecture les y rejoint
// quand on la quitte, et au paquet suivant les trois cartes en ressortent. Point en bas de la boîte (fraction de sa largeur W, centre de la boîte = 0,0),
// carte réduite à STOW_SCALE de la boîte ; chaque carte a un léger décalage (i : 0, 1, 2 ; la carte de lecture se range comme la carte du milieu).
export const STOW_SCALE = 0.3
export const STOW_FADE_MS = 260 // la carte voyage d’abord, puis s’efface une fois sur la pile (jamais de fondu sec)
export const stowOf = (i: number, w: number) => ({ x: (i - 1) * 0.012 * w, y: (0.62 - i * 0.006) * w, r: (i - 1) * 3, s: STOW_SCALE })

// Départ échelonné des cartes non choisies (ms après le choix) : la plus proche du choix part d’abord, le milieu un demi-pas plus tard.
export const STOW_STEP_MS = 70
export const stowDelay = (i: number, chosen: number, base: number) => base + ((i < chosen ? 0 : 1) + (i === 1 ? 0.5 : 0)) * STOW_STEP_MS
