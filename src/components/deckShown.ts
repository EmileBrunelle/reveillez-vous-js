import { ref } from 'vue'

// Le paquet (CardDeck) n’est visible que lorsqu’il est le sujet : à la donne (les cartes en sortent) et au rangement (elles y reviennent) ; le reste du temps il est caché,
// pour qu’on n’essaie pas de cliquer sur quelque chose d’inerte. DeckCut écrit cet état (seul maître), CardDeck le suit. La sortie de la lecture a sa propre chorégraphie (deckInsert).
export const deckShown = ref(false)
