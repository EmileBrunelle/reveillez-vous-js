// Chunks chargés à la demande (hors du premier écran) : la carte du tirage, la scène de la porte
// et les fenêtres/écrans secondaires. Les préchargements partent dès que possible (voir `prefetch`).
import { defineAsyncComponent, markRaw, shallowRef, type Component } from 'vue'
import { loadAbout, loadCollection, loadDeckCut, loadDoorScene, loadFinale, loadReset, loadSound, loadTarotCard, prefetch } from '../lazy'
import { lazyScene } from './lazyScene'

// `skip` : comment la partie continue sans la scène si son chunk reste introuvable (coupe : un paquet au hasard ; finale : retour à la porte).
export const useLazyScenes = (skip: { deck?: () => void; finale?: () => void } = {}) => {
  // La carte du tirage : simple enveloppe paresseuse. Le chunk est déjà là quand on la rend (onPick l’attend, « jamais de substitut »).
  const TarotCard = defineAsyncComponent(loadTarotCard)

  const About = defineAsyncComponent(loadAbout)
  const ResetConfirm = defineAsyncComponent(loadReset)
  const CollectionWindow = defineAsyncComponent(loadCollection)
  const SoundWindow = defineAsyncComponent(loadSound)
  // La coupe et la finale n’ont pas de substitut : essais automatiques, puis repli « Réessayer / Passer » (voir lazyScene).
  const DeckCut = lazyScene(loadDeckCut, skip.deck)
  const Finale = lazyScene(loadFinale, skip.finale)

  // La scène de la porte s’affiche après « Approchez-vous » : on garde ce bouton tant que son chunk n’est pas là (pas de substitut, donc pas de saut).
  const DoorScene = shallowRef<Component | null>(null)
  let doorLoad: Promise<unknown> | null = null
  const ensureDoor = () =>
    (doorLoad ??= loadDoorScene().then(
      (m) => {
        DoorScene.value = markRaw(m.default)
        prefetch(loadDeckCut, loadTarotCard) // la coupe puis la carte suivent les coups : on les réchauffe pendant que la porte s’affiche
      },
      (e) => {
        doorLoad = null // réseau coupé : le prochain clic réessaie
        throw e
      },
    ))

  return { TarotCard, DoorScene, ensureDoor, About, ResetConfirm, CollectionWindow, SoundWindow, DeckCut, Finale }
}
