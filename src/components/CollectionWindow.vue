<script setup lang="ts">
import { nextTick, ref, shallowRef, watch, type ComponentPublicInstance } from 'vue'
import { animate } from 'motion-v'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useCollectionStore } from '@/stores/collection'
import WinDialog from './WinDialog.vue'
import TarotEmblem from './TarotEmblem.vue'
import { cardCollect } from '@/audio/cards'

// v-model du parent = « veut ouvert » (fenêtre, focus et fermeture : voir WinDialog).
const open = defineModel<boolean>({ default: false })
const collection = useCollectionStore()
const reduced = useReducedMotion()

// Le « nouveau » est figé à l’ouverture (la fermeture l’efface du stockage) : mis en évidence une seule fois.
const highlight = ref<string | null>(null)
// Seule la case mise en évidence sert (défilement + ressort) : on ne garde qu’elle.
// Ref fonction et non useTemplateRef : dans un v-for, ce dernier donne un tableau dont l’ordre ne suit pas la liste.
const fresh = shallowRef<HTMLElement | null>(null)
// Vue rappelle le ref avec null au démontage ou au changement de fonction : seule la case du « nouveau » écrit, null compris.
const keepFresh = (nom: string) => (el: Element | ComponentPublicInstance | null) => {
  if (nom === highlight.value) fresh.value = el instanceof HTMLElement ? el : null
}

watch(
  open,
  async (o) => {
    if (!o) return
    highlight.value = collection.fresh
    cardCollect(highlight.value !== null)
    await nextTick()
    const el = highlight.value ? fresh.value : null
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      // Un seul ressort léger sur la transformation : pas de changement de luminance, rien en mouvement réduit.
      if (!reduced.value) void animate(el, { scale: [0.86, 1] }, { type: 'spring', stiffness: 260, damping: 14 })
    }
  },
  { immediate: true, flush: 'sync' }, // composant async : il peut se monter alors que le parent veut déjà l’ouvrir
)

// La consultation efface le « nouveau » du stockage ; WinDialog a déjà rendu le focus.
const onClose = () => collection.consult()
</script>

<template>
  <WinDialog v-model="open" title="Collection" content-class="mt-2 mb-[calc(var(--taskbar-h)+0.5rem)] mx-auto w-[34rem] sm:w-[52rem]" @close="onClose">
    <template #default="{ titleId }">
      <p class="m-0 px-3 pt-3 pb-2" role="status">{{ collection.count }} / {{ collection.total }} arcanes révélés</p>
      <ul
        role="list"
        tabindex="0"
        :aria-labelledby="titleId"
        class="list-none m-0 mx-3 mb-3 p-2 grid gap-2 grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] auto-rows-max content-start min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#2a1450] shadow-[inset_1px_1px_grey,inset_-1px_-1px_#fff]"
      >
        <li
          v-for="e in collection.inventory"
          :key="e.nom"
          :ref="keepFresh(e.nom)"
          class="relative aspect-[7/12] shrink-0 min-w-0 box-border overflow-hidden rounded-[0.4rem] border-2 border-solid text-center [container-type:inline-size]"
          :class="[
            collection.seen.has(e.nom) ? 'bg-[#f0e4c8] text-[#2a1450] border-[#2a1450]' : 'bg-[#3a1f66] text-[#b9821a] border-[#1f1038]',
            e.nom === highlight ? 'border-[#e0b030] shadow-[0_0_0_2px_#e0b030,0_0_0.75rem_#e0b030]' : '',
          ]"
          :title="collection.seen.has(e.nom) ? e.nom : undefined"
          :aria-label="collection.seen.has(e.nom) ? `${e.numero}, ${e.nom}${e.nom === highlight ? ' (nouveau)' : ''}` : 'Arcane inconnu'"
          :data-new="e.nom === highlight ? '' : undefined"
        >
          <div class="size-full box-border flex flex-col items-center justify-center gap-[4cqw] p-[5cqw]">
            <template v-if="collection.seen.has(e.nom)">
              <span class="font-title font-bold text-[16cqw] leading-none tracking-[0.08em]" aria-hidden="true">{{ e.numero }}</span>
              <span class="block size-[42cqw] flex-none" aria-hidden="true"><TarotEmblem :symbole="e.symbole" /></span>
              <span class="font-card text-[15cqw] leading-[1.05] line-clamp-2 [overflow-wrap:anywhere]" aria-hidden="true">{{ e.nom }}</span>
            </template>
            <span v-else class="font-title font-bold text-[48cqw] leading-none" aria-hidden="true">?</span>
          </div>
        </li>
      </ul>
    </template>
  </WinDialog>
</template>
