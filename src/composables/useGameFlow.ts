// Machine à états d’une visite. Le portail WebGPU (`gpu`) reste dans App.vue ; ici, tout ce qui suit.
//
//   door ──(open → onDone)──> activity ──(onActivityDone)──> cut ──(onPick)──> reading
//     │   (niveau 1 : pas d’activité, direct à cut)                               │
//     │                                                                  (onClose)│
//     └<──(leave : porte claquée, closing → onClosed → enterDoor)<────────────────┤
//                                                                                  │ niveau 5
//   door <──(onFinaleRestart → enterDoor)────────────── finale <──────────────────┘
//
// - `enterDoor` tire lieu, porte, réplique et activité de la visite, puis remet la phase à `door`.
// - `leave(count)` fait claquer la porte (`closing`) ; la porte suivante est tirée à `onClosed`.
// - `resetLevel` (« Recommencer à zéro ») peut survenir depuis n’importe quelle phase.
// - Les bulles de la barre des tâches appartiennent à la porte (voir useBubbles).
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { promiseTimeout, useMediaQuery } from '@vueuse/core'
import { doors, pickDoor, pickPlaceVariant, placeForLevel, places } from '../content/scenes'
import { prophecies } from '../content/prophecies'
import { nextClockLine } from '../engine/horloge'
import { nextDoorLine, nextProphecy, nextReturnLine, nextTitled, type Prophecy, EMPTY_ARCANE } from '../engine/prophecy'
import { secureRng } from '../engine/rng'
import { PAQUETS, type Paquet } from '../engine/paquets'
import { LAST_ACTIVITY_KEY, PLAYED_ACTIVITIES_KEY, parseActivityId, parsePlayed, pickActivity, type ActivityId } from '../engine/activityPick'
import { finaleActive } from '../engine/finaleFlow'
import { hymn, unlock } from '../audio/sfx'
import { activityFor, loadFinale, loadTarotCard, prefetch } from '../lazy'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useCollectionStore } from '../stores/collection'
import { safeSessionStorage, safeStorage } from './safeStorage'
import { useBubbles } from './useBubbles'
import { lazyScene } from './lazyScene'

type Phase = 'door' | 'activity' | 'cut' | 'reading' | 'finale'
const FALLBACK_LINE = 'Toc toc toc… Avez-vous un moment pour parler de votre avenir ?'

// Où le focus doit atterrir après un changement d’écran (App.vue le traduit en élément, puis remet la valeur à null) :
// 'door' le bouton de la porte, 'activity' le conteneur de l’activité, 'deck' le paquet à couper, 'reading' la section de lecture,
// 'close' « Fermer la porte » (lecture de secours ou carte retournée), 'finale' le conteneur de la finale.
export type FocusTarget = 'door' | 'activity' | 'deck' | 'reading' | 'close' | 'finale' | null

const TAROT_TIMEOUT_MS = 3000
// « Jamais de substitut » : la carte est chargée avant la lecture. Sans le chunk (échec ou délai), la lecture de secours en texte prend le relais.
const tarotReady = () => Promise.race([loadTarotCard().then(() => true), promiseTimeout(TAROT_TIMEOUT_MS).then(() => false)]).catch(() => false)

export const useGameFlow = () => {
  const rng = secureRng()
  const progress = useProgressStore()
  const { level } = storeToRefs(progress)
  const session = useSessionStore()
  const collection = useCollectionStore()
  const { startBubble, stopBubble, clearBubbles } = useBubbles(rng)

  const focusTarget = ref<FocusTarget>(null)
  const tarotOk = ref(true) // décidé une seule fois par pioche (onPick) : carte si le chunk est là à temps, sinon lecture de secours, sans bascule après coup
  const listening = ref(false)
  const phase = ref<Phase>('door')
  const closing = ref(false)
  const sceneKey = ref(0)
  const door = shallowRef(doors[0])
  const place = shallowRef(placeForLevel(level.value))
  const placeVariant = shallowRef(place.value.variants[0])
  let variantSeen = false // la toute première visite n’a pas de décor précédent à éviter
  const pickedPaquet = ref<Paquet>('nuit')
  const cardSettled = ref(false) // la carte est retournée : les fausses erreurs peuvent se mesurer
  const doorLine = ref(FALLBACK_LINE)
  const crtOff = ref(false) // finale : la télé est éteinte
  // Au retour après une finale, la toute première porte salue la personne (une fois par départ, y compris après « Recommencer »).
  let returnGreeted = false
  const prophecy = ref<Prophecy>({ question: '', body: '', verse: '', arcane: EMPTY_ARCANE })

  // Activité de la visite (tirée à l’ouverture de la porte ; null au niveau 1).
  const activityId = ref<ActivityId | null>(parseActivityId(safeSessionStorage().getItem(LAST_ACTIVITY_KEY))) // relue : un rechargement ne rejoue pas la même
  // Efface la mémoire d’activités (dernière jouée et liste des jouées) : nouvelle partie.
  const forgetActivities = () => {
    safeSessionStorage().removeItem(LAST_ACTIVITY_KEY)
    safeSessionStorage().removeItem(PLAYED_ACTIVITIES_KEY)
  }
  const Activity = computed(() => {
    const loader = activityFor(activityId.value)
    return loader ? lazyScene(loader, () => onActivityDone()) : null // chunk introuvable : « Passer » enchaîne sur la coupe
  })

  // « Recommencer à zéro » : on repart tout de suite au niveau 1, sans compter la visite en cours.
  const resetLevel = () => {
    progress.reset()
    forgetActivities()
    stopBubble()
    clearBubbles()
    if (phase.value === 'finale')
      enterDoor() // finale interrompue : retour direct à la porte du niveau 1
    else if (phase.value === 'door') {
      if (!closing.value) enterDoor() // porte pas encore ouverte : on retire porte, réplique et lieu pour le niveau 1
    } else leave(false)
  }

  // Réplique de la porte : salutation de retour après une finale, sinon ligne du niveau, parfois remplacée par l’heure locale.
  const pickDoorLine = () => {
    const greet = progress.memory.finished && level.value === 1 && !returnGreeted
    returnGreeted = true
    if (greet) return nextReturnLine(safeStorage(), rng, FALLBACK_LINE)
    const line = nextDoorLine(prophecies, level.value, safeStorage(), rng, FALLBACK_LINE, progress.memory)
    // La voyante remarque parfois l’heure locale (une fois par session ; pas au niveau 5, dont les répliques sont en capitales).
    return level.value < 5 ? (nextClockLine(new Date(), rng, safeSessionStorage()) ?? line) : line
  }

  // Activité de la visite (null au niveau 1) : tirée, mémorisée pour la session, puis préchargée.
  const pickActivityForVisit = () => {
    const played = parsePlayed(safeSessionStorage().getItem(PLAYED_ACTIVITIES_KEY))
    activityId.value = pickActivity(progress.visits, activityId.value, safeStorage(), rng, played)
    if (activityId.value) {
      safeSessionStorage().setItem(LAST_ACTIVITY_KEY, activityId.value)
      safeSessionStorage().setItem(PLAYED_ACTIVITIES_KEY, JSON.stringify([...new Set([...played, activityId.value])]))
    } else forgetActivities()
    const loadActivity = activityFor(activityId.value)
    if (loadActivity) prefetch(loadActivity) // on réchauffe celle qui sera vraiment jouée
  }

  const enterDoor = () => {
    place.value = placeForLevel(level.value)
    door.value = pickDoor(place.value.id, rng)
    placeVariant.value = pickPlaceVariant(place.value, variantSeen ? placeVariant.value.id : null, rng)
    variantSeen = true
    crtOff.value = false
    doorLine.value = pickDoorLine()
    pickActivityForVisit()
    if (level.value >= 4) prefetch(loadFinale) // le niveau 5 se termine par la finale : on la réchauffe dès le niveau 4
    phase.value = 'door'
    listening.value = false
    closing.value = false
    sceneKey.value++
  }
  enterDoor()

  // Dev seulement (exclu du build de prod) : ?phase=deck, ?phase=card ou ?phase=finale saute la porte et les activités, pour tester la mise en page.
  const devPhase = import.meta.env.DEV ? new URLSearchParams(location.search).get('phase') : null

  // Une visite : la porte s’ouvre -> activité (niveau 2+) -> coupe du paquet -> lecture. La prophétie est tirée une fois, à l’ouverture.
  const onDone = () => {
    prefetch(loadTarotCard)
    phase.value = activityId.value ? 'activity' : 'cut'
    focusTarget.value = activityId.value ? 'activity' : 'deck'
    listening.value = false
  }
  const onActivityDone = () => {
    // Un `done` tardif (activité en sortie après « Recommencer à zéro » ou « Fermer la porte ») ne doit rien relancer.
    if (phase.value !== 'activity' || closing.value) return
    phase.value = 'cut'
    focusTarget.value = 'deck'
  }
  // La prophétie est tirée ici, une fois par visite : l’arcane vient du paquet choisi.
  let picking = false // un tirage en cours : un second clic (paquet, « Passer ») n’en tire pas un deuxième pendant l’attente du chunk
  const onPick = async (paquet: Paquet) => {
    if (picking || phase.value !== 'cut' || closing.value) return // « Recommencer à zéro » pendant le vol : on ne rouvre pas une lecture
    picking = true
    const tarot = await tarotReady().finally(() => (picking = false))
    if (phase.value !== 'cut' || closing.value) return
    pickedPaquet.value = paquet
    tarotOk.value = tarot
    prophecy.value = nextProphecy(prophecies, level.value, safeStorage(), rng, paquet, progress.visits === 0)
    progress.remember(prophecy.value.arcane.numero, level.value, prophecy.value.arcane.nom)
    cardSettled.value = false
    phase.value = 'reading'
    hymn()
    focusTarget.value = tarot ? 'reading' : 'close' // la coupe disparaît : le focus reste sur la lecture (ou « Fermer la porte » si la carte n’a pas pu se charger)
  }
  if (devPhase === 'finale') phase.value = 'finale'
  if (devPhase === 'deck' || devPhase === 'card') {
    phase.value = 'cut'
    if (devPhase === 'card') void onPick('nuit')
  }
  const leave = (count: boolean) => {
    if (closing.value) return
    stopBubble()
    closing.value = true
    unlock()
    if (count) progress.bump()
    // The open door slams first; the next variant is picked once it is shut (see onClosed).
    sceneKey.value++
    phase.value = 'door'
  }

  const narrow = useMediaQuery('(max-width: 900px)')
  const onFlipped = () => {
    collection.record(prophecy.value.arcane.nom)
    cardSettled.value = true
    // Première lecture de la session : une bulle discrète annonce que la suite existe (pas sur écran étroit : elle couvrirait la carte).
    if (progress.visits === 0 && !narrow.value) {
      const b = nextTitled(prophecies, 'bulle1', safeStorage(), rng)
      if (b) session.notify(`${b.title}|${b.text}`)
    }
    focusTarget.value = 'close'
  }
  // Une bulle appartient à la porte : dès qu’on la quitte, la bulle en attente est annulée ; l’affichée est retirée sur écran étroit (elle couvrirait la carte).
  watch(phase, (p) => {
    if (p === 'door') return
    stopBubble()
    if (narrow.value) clearBubbles()
  })
  const onClosed = () => {
    enterDoor()
  }
  // Niveau 5 : « Fermer la porte » passe par la finale, puis reprend le chemin habituel.
  const onClose = () => {
    if (level.value < 5) return leave(true)
    phase.value = 'finale'
    focusTarget.value = 'finale'
  }
  // L’écran est noir : le CRT s’éteint et le lieu passe à l’aube sans qu’on le voie.
  const onCollapsed = () => {
    if (!finaleActive(phase.value)) return // Finale encore montée pendant sa sortie : un collapsed tardif ne touche plus la porte
    progress.markFinaleSeen() // point de non-retour : un rechargement repart au niveau 1
    crtOff.value = true
    place.value = places.find((p) => p.id === 'nuages') ?? place.value
    placeVariant.value = place.value.variants.find((v) => v.id === 'aube') ?? placeVariant.value
  }
  // Coupe introuvable (chunk absent) : « Passer » tire un paquet au hasard et la lecture suit.
  const skipDeck = () => void onPick(PAQUETS[Math.floor(rng() * PAQUETS.length)] ?? 'nuit')
  // « Recommencer » : visites et sacs à zéro, finale marquée, retour à la porte du niveau 1.
  const onFinaleRestart = () => {
    if (!finaleActive(phase.value)) return // double clic pendant la sortie : un seul « Recommencer »
    progress.completeFinale()
    forgetActivities()
    returnGreeted = false
    stopBubble()
    clearBubbles()
    enterDoor()
  }

  return {
    rng,
    phase,
    focusTarget,
    tarotOk,
    closing,
    listening,
    sceneKey,
    door,
    place,
    placeVariant,
    doorLine,
    crtOff,
    pickedPaquet,
    prophecy,
    cardSettled,
    Activity,
    activityId,
    startBubble,
    skipDeck,
    resetLevel,
    onDone,
    onActivityDone,
    onPick,
    onFlipped,
    onClose,
    onClosed,
    onCollapsed,
    onFinaleRestart,
  }
}
