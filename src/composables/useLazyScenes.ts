// Chunks chargés à la demande (hors du premier écran) : la carte du tirage, la scène de la porte
// et les fenêtres/écrans secondaires. Les préchargements partent dès que possible (voir `prefetch`).
import { defineAsyncComponent, markRaw, ref, shallowRef, type Component } from 'vue'
import { loadAbout, loadCollection, loadDeckCut, loadDoorScene, loadFinale, loadReset, loadSound, loadTarotCard, prefetch } from '../lazy'

export const useLazyScenes = () => {
  // La carte du tirage est chargée avant la fin de la coupe (jamais de substitut) : on ne la rend qu’une fois le chunk là.
  const TarotCard = shallowRef<Component | null>(null)
  const tarotFailed = ref(false) // le chunk n’a pas pu se charger : lecture de secours en texte, le jeu ne reste jamais bloqué
  const loadTarotOnce = () => loadTarotCard().then((m) => void (TarotCard.value = markRaw(m.default)))
  const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  // Pas de retour anticipé : si le chunk arrive après un échec, tarotFailed doit retomber, sinon la lecture de secours (testée avant TarotCard dans le gabarit) resterait jusqu’à la fin de la session.
  const ensureTarot = async () => {
    for (let n = 0; n < 2 && !TarotCard.value; n++) await Promise.race([loadTarotOnce(), timeout(3000)]).catch(() => undefined)
    tarotFailed.value = !TarotCard.value
  }

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

  return { TarotCard, tarotFailed, ensureTarot, DoorScene, ensureDoor, About, ResetConfirm, CollectionWindow, SoundWindow, DeckCut, Finale }
}
