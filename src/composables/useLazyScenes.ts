// Chunks chargés à la demande (hors du premier écran) : la carte du tirage, la scène de la porte
// et les fenêtres/écrans secondaires. Les préchargements partent dès que possible (voir `prefetch`).
import { defineAsyncComponent, h, markRaw, shallowRef, type Component } from 'vue'
import TarotFallback from '../components/TarotFallback.vue'
import { loadAbout, loadCollection, loadDeckCut, loadDoorScene, loadFinale, loadReset, loadSound, loadTarotCard, prefetch } from '../lazy'

export const useLazyScenes = (reading: () => { title: string; body: string; verse: string }) => {
  // La carte du tirage est chargée avant la lecture (voir onPick : jamais de substitut) ; si le chunk échoue, defineAsyncComponent
  // réessaie deux fois puis affiche la lecture de secours. errorComponent ne reçoit pas les props du parent : on lui rend le texte tiré.
  const TarotFallbackBound = () => h(TarotFallback, reading())
  const TarotCard = defineAsyncComponent({
    loader: loadTarotCard,
    timeout: 3000,
    errorComponent: TarotFallbackBound,
    onError: (_err, retry, fail, attempts) => (attempts <= 2 ? retry() : fail()),
  })

  const About = defineAsyncComponent(loadAbout)
  const ResetConfirm = defineAsyncComponent(loadReset)
  const CollectionWindow = defineAsyncComponent(loadCollection)
  const SoundWindow = defineAsyncComponent(loadSound)
  const DeckCut = defineAsyncComponent(loadDeckCut)
  const Finale = defineAsyncComponent(loadFinale)

  // La scène de la porte s’affiche après « Approchez-vous » : on garde ce bouton tant que son chunk n’est pas là (pas de substitut, donc pas de saut).
  const DoorScene = shallowRef<Component | null>(null)
  let doorLoad: Promise<unknown> | null = null
  const ensureDoor = () =>
    (doorLoad ??= loadDoorScene().then(
      (m) => {
        DoorScene.value = markRaw(m.default)
        prefetch(loadTarotCard) // la carte se tire après les coups : on la réchauffe pendant que la porte s’affiche
      },
      (e) => {
        doorLoad = null // réseau coupé : le prochain clic réessaie
        throw e
      },
    ))

  return { TarotCard, DoorScene, ensureDoor, About, ResetConfirm, CollectionWindow, SoundWindow, DeckCut, Finale }
}
