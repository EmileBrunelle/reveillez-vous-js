import { onMounted, ref, watch, type Ref, type WatchSource } from 'vue'
import { useRafFn, useResizeObserver } from '@vueuse/core'

// Ajuste la police du corps de la carte : la plus grande taille (px) dans [MIN_PX, max] pour laquelle le texte tient dans le panneau sans défiler.
// Mesure les tailles de mise en page (offset/client/scroll*), qui ignorent les transformations de pose, de retournement et d’inclinaison.
// max = min(9 % de la largeur de carte, max(34 px × max(1, largeur/576), 7,5 % de la largeur)) : le second terme laisse grandir les cartes très larges ;
// plancher = 11 px (la plus longue prophétie du niveau 5 doit tenir sur un téléphone 360×640).
const MIN_PX = 11
const MAX_PX = 34
const WIDE_RATIO = 0.075 // plafond relatif des grandes cartes (≥ 453 px de large) ; téléphone et portable restent sous MAX_PX
const REF_W = 576 // largeur de carte de référence : au-delà, le plafond de police grandit avec la carte

type Emblem = '' | 'small' | 'none'
type Options = {
  root: Readonly<Ref<HTMLElement | null>> // la carte (largeur/hauteur de référence ; porte data-emblem pendant la mesure)
  panel: Readonly<Ref<HTMLElement | null>> // le panneau qui borne le texte
  body: Readonly<Ref<HTMLElement | null>> // le paragraphe dont on règle la police
  sources: WatchSource[] // contenu qui, en changeant, force un nouvel ajustement (texte, titre)
}

export const useFitBody = ({ root, panel, body, sources }: Options) => {
  // Résultat de l’ajustement, destiné au gabarit (:style sur le corps, :data-emblem sur la racine) : un re-rendu ne peut ni réinitialiser la police ni l’emblème.
  const bodyPx = ref(0)
  const emblem = ref<Emblem>('')
  let lastW = 0
  let lastH = 0

  const fit = () => {
    const panelNode = panel.value
    const bodyNode = body.value
    const rootNode = root.value
    const w = rootNode?.offsetWidth
    const h = rootNode?.offsetHeight
    if (!rootNode || !panelNode || !bodyNode || !w || !h || !panelNode.clientHeight) return
    if (w === lastW && h === lastH) return
    lastW = w
    lastH = h
    const cs = getComputedStyle(panelNode)
    const room = panelNode.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    // Exception : mesure synchrone (chaque essai exige un offsetHeight juste après l’écriture), impossible à passer par un état réactif.
    const fits = (px: number) => {
      bodyNode.style.fontSize = `${px}px`
      return bodyNode.offsetHeight <= room + 0.5 && panelNode.scrollHeight <= panelNode.clientHeight + 1
    }
    // Règle : on MESURE en impératif (chaque essai exige un offsetHeight synchrone), puis on COMMIT le résultat dans l’état (bodyPx, emblem).
    // Le DOM contient déjà la valeur finale à la sortie : le patch de Vue est un no-op, mais un re-rendu ultérieur la conserve.
    const commit = (emb: Emblem, px: number) => {
      bodyPx.value = px
      emblem.value = emb
    }
    // Emblème entier, puis demi-taille, puis aucun : la police ne descend jamais sous MIN_PX.
    for (const emb of ['', 'small', 'none'] as const) {
      if (emb) rootNode.dataset.emblem = emb
      else delete rootNode.dataset.emblem
      let lo = MIN_PX
      let hi = Math.max(lo, Math.min(w * 0.09, Math.max(MAX_PX * Math.max(1, w / REF_W), w * WIDE_RATIO)))
      if (fits(hi)) return commit(emb, hi)
      if (emb !== 'none' && !fits(lo)) continue
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
      bodyNode.style.fontSize = `${lo}px`
      return commit(emb, lo)
    }
  }

  // Tous les déclencheurs sont fusionnés en une seule image (rAF) ; sauf `force` (contenu ou polices changés), on saute si la taille de la carte n’a pas bougé.
  const { resume, pause } = useRafFn(
    () => {
      pause()
      fit()
    },
    { immediate: false },
  )
  const schedule = (force = false) => {
    if (force) lastW = lastH = 0
    resume()
  }
  watch(sources, () => schedule(true))
  useResizeObserver(root, () => schedule())
  onMounted(() => {
    schedule(true)
    void document.fonts?.ready.then(() => schedule(true))
  })

  return { bodyPx, emblem }
}
