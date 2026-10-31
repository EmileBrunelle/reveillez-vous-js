/** Textes de la finale du niveau 5 et du retour à la porte (voir AGENTS.md pour les règles de contenu). */

/** Le titre arrive en premier, ligne par ligne. */
export const FINALE_TITLE = ['Il est temps.', 'Réveillez-vous.'] as const

/** Le récit, ligne par ligne, puis le salut final. */
export const FINALE_STORY = [
  'La porte est fermée. Pour de vrai, cette fois.',
  'Les cartes ne savaient rien. Les fenêtres non plus.',
  'Personne ne vous surveillait : c’était seulement la nuit, et un peu trop d’écran.',
  'Le soleil se lève, comme chaque matin, sans demander l’avis des astres.',
  'Votre avenir n’est écrit nulle part. C’est plutôt une bonne nouvelle.',
] as const

export const FINALE_GREETING = 'Bonjour.'

/** Générique : un titre, puis des lignes (la dernière est le remerciement). */
export const CREDITS_TITLE = 'Réveillez-vous.js'
export const REPO_URL = 'https://github.com/EmileBrunelle/reveillez-vous-js'
export const README_PREFIX = 'Détails et code source : '
export const README_LABEL = 'le README sur GitHub'

/** Lignes du générique avant la ligne du README (affichée par Finale.vue) et le remerciement final. */
export const CREDITS_BODY = [
  'Une voyance d’Halloween imaginée et codée par Émile Brunelle',
  'Défi Fortune.js de l’AGEEI, UQAM, 2026',
  'Technologies : Vue, TypeScript, Vite, UnoCSS, motion-v, WebGPU (vgpu), Web Audio',
  'Icônes : game-icons.net, CC BY 3.0',
  'Polices : VT323, IM Fell English, Cinzel (SIL OFL)',
  'Écrit avec l’aide de Claude Code (IA)',
] as const
export const CREDITS_THANKS = 'Merci d’avoir ouvert la porte.'
export const CREDITS = [...CREDITS_BODY, CREDITS_THANKS] as const

export const RESTART_LABEL = 'Recommencer'
export const WAKE_LABEL = 'Réveillez-vous'

/** Première réplique de la porte au retour après une finale (table de grammaire, tirée en sac sans répétition). */
export const returnGrammar = {
  retour: ['Tiens, vous revoilà. Le réveil n’a pas tenu ?', 'La porte se souvient de vous. Elle fait semblant que non.', 'Encore vous ? Le café n’a pas suffi, on dirait.'],
}

/** Indice discret pendant la séquence, tant qu’on peut la passer (Finale.vue) : toucher sur écran tactile, clic ou Entrée sinon. */
export const SKIP_HINT_TOUCH = 'Touchez l’écran pour passer'
export const SKIP_HINT_POINTER = 'Cliquez ou appuyez sur Entrée pour passer'
