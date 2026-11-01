// Masque du reflet sur l’emblème : le même SVG game-icons que TarotEmblem, en chaîne brute (seul l’alpha compte pour `mask-image`).
import fool from '~icons/game-icons/jester-hat?raw'
import wheel from '~icons/game-icons/ship-wheel?raw'
import star from '~icons/game-icons/star-formation?raw'
import moon from '~icons/game-icons/moon?raw'
import sun from '~icons/game-icons/sun?raw'
import lantern from '~icons/game-icons/lantern?raw'
import tower from '~icons/game-icons/tower-fall?raw'
import pumpkin from '~icons/game-icons/pumpkin?raw'
import cone from '~icons/game-icons/traffic-cone?raw'
import bridge from '~icons/game-icons/suspension-bridge?raw'
import crystal from '~icons/game-icons/crystal-ball?raw'
import cat from '~icons/game-icons/cat?raw'
import signpost from '~icons/game-icons/doorway?raw'
import ghost from '~icons/game-icons/ghost?raw'
import eye from '~icons/game-icons/all-seeing-eye?raw'
import beaver from '~icons/game-icons/beaver?raw'
import hourglass from '~icons/game-icons/hourglass?raw'
import web from '~icons/game-icons/spider-web?raw'
import bat from '~icons/game-icons/bat?raw'
import snowman from '~icons/game-icons/snowman?raw'
import antenna from '~icons/game-icons/tv-tower?raw'

const RAW: Record<string, string> = { fool, wheel, star, moon, sun, lantern, tower, pumpkin, cone, bridge, crystal, cat, signpost, ghost, eye, beaver, hourglass, web, bat, snowman, antenna }

/** `url("data:…")` prêt pour la propriété CSS `mask-image` (« none » si le symbole est inconnu). */
export const emblemMask = (symbole: string) => (RAW[symbole] ? `url("data:image/svg+xml,${encodeURIComponent(RAW[symbole])}")` : 'none')
