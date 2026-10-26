<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { animate } from 'motion-v'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useCollectionStore } from '../stores/collection'
import TarotEmblem from './TarotEmblem.vue'

// Parent v-model = « veut ouvert ». <dialog> natif : Échap, piège à focus et arrière-plan inerte sont gratuits.
const open = defineModel<boolean>({ default: false })
const dlg = ref<HTMLDialogElement>()
const closeBtn = ref<HTMLButtonElement>()
const collection = useCollectionStore()
const reduced = useReducedMotion()
let opener: HTMLElement | null = null

// Le « nouveau » est figé à l’ouverture (la fermeture l’efface du stockage) : mis en évidence une seule fois.
const highlight = ref<string | null>(null)
const cells: Record<string, HTMLElement> = {}
const setCell = (nom: string, el: unknown) => {
  if (el instanceof HTMLElement) cells[nom] = el
}

const sync = async (o: boolean) => {
  const d = dlg.value
  if (!d) return
  if (o && !d.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    highlight.value = collection.fresh
    d.showModal()
    await nextTick()
    closeBtn.value?.focus()
    const el = highlight.value ? cells[highlight.value] : undefined
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      // Un seul ressort léger sur la transformation : pas de changement de luminance, rien en mouvement réduit.
      if (!reduced.value) void animate(el, { scale: [0.86, 1] }, { type: 'spring', stiffness: 260, damping: 14 })
    }
  } else if (!o && d.open) d.close()
}
// Composant async : il peut se monter alors que le parent veut déjà l’ouvrir.
watch(open, sync)
onMounted(() => open.value && sync(true))

const onClose = () => {
  open.value = false
  collection.consult()
  const el = opener
  opener = null
  if (el?.isConnected) el.focus()
}

const btn = 'win-btn select-none touch-manipulation [font:inherit] border-0 focus-visible:[outline:2px_dotted_#000] focus-visible:outline-offset-[-4px] min-h-8 px-4'
</script>

<template>
  <dialog
    ref="dlg"
    class="mt-2 mb-[calc(var(--taskbar-h)+0.5rem)] mx-auto p-0 w-[34rem] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-var(--taskbar-h)-1rem)] overflow-hidden bg-transparent border-0 text-black font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:rgb(0_0_0/0.55)]"
    aria-labelledby="collection-title"
    @close="onClose"
  >
    <div class="win-window flex flex-col max-h-[calc(100dvh-var(--taskbar-h)-1rem)]">
      <div class="flex items-center justify-between gap-2 bg-[#000080] text-white py-[2px] px-2 select-none">
        <h2 id="collection-title" class="m-0 text-[1rem] font-bold">Collection</h2>
        <button
          class="win-btn border-0 min-w-6 h-6 p-0 [font:inherit] font-bold leading-none focus-visible:[outline:2px_dotted_#000] focus-visible:outline-offset-[-4px]"
          type="button"
          aria-label="Fermer"
          @click="dlg?.close()"
        >
          ×
        </button>
      </div>
      <p class="m-0 px-3 pt-3 pb-2" role="status">{{ collection.count }} / {{ collection.total }} arcanes révélés</p>
      <ul
        role="list"
        class="list-none m-0 mx-3 mb-3 p-2 grid gap-2 grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] auto-rows-max content-start min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#2a1450] shadow-[inset_1px_1px_grey,inset_-1px_-1px_#fff]"
      >
        <li
          v-for="e in collection.inventory"
          :key="e.nom"
          :ref="(el) => setCell(e.nom, el)"
          class="relative aspect-[7/12] shrink-0 min-w-0 box-border overflow-hidden rounded-[0.4rem] border-2 border-solid flex flex-col items-center justify-center gap-1 p-1 text-center"
          :class="[
            collection.seen.has(e.nom) ? 'bg-[#f0e4c8] text-[#2a1450] border-[#2a1450]' : 'bg-[#3a1f66] text-[#b9821a] border-[#1f1038]',
            e.nom === highlight ? 'border-[#e0b030] shadow-[0_0_0_2px_#e0b030,0_0_0.75rem_#e0b030]' : '',
          ]"
          :aria-label="collection.seen.has(e.nom) ? `${e.numero}, ${e.nom}${e.nom === highlight ? ' (nouveau)' : ''}` : 'Arcane inconnu'"
          :data-new="e.nom === highlight ? '' : undefined"
        >
          <template v-if="collection.seen.has(e.nom)">
            <span class="font-title font-bold text-[1rem] leading-none tracking-[0.1em]" aria-hidden="true">{{ e.numero }}</span>
            <span class="block size-[3rem] flex-none" aria-hidden="true"><TarotEmblem :symbole="e.symbole" /></span>
            <span class="font-card text-[0.85rem] leading-tight [overflow-wrap:anywhere]" aria-hidden="true">{{ e.nom }}</span>
          </template>
          <span v-else class="font-title font-bold text-[2.5rem] leading-none" aria-hidden="true">?</span>
        </li>
      </ul>
      <div class="px-3 pb-3 flex justify-end">
        <button ref="closeBtn" :class="btn" type="button" @click="dlg?.close()">Fermer</button>
      </div>
    </div>
  </dialog>
</template>
