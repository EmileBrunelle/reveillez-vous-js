<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

// Parent v-model = "wants open". Native <dialog>: Esc, focus trap and inert background come for free.
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ confirm: [] }>()
const dlg = ref<HTMLDialogElement>()
const cancelBtn = ref<HTMLButtonElement>()
let opener: HTMLElement | null = null

const sync = async (o: boolean) => {
  const d = dlg.value
  if (!d) return
  if (o && !d.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    d.showModal()
    await nextTick()
    cancelBtn.value?.focus()
  } else if (!o && d.open) d.close()
}
// Composant async : il peut se monter alors que le parent veut déjà l’ouvrir.
watch(open, sync)
onMounted(() => open.value && sync(true))

const onClose = () => {
  open.value = false
  const el = opener
  opener = null
  // The link disappears after a reset: only restore focus if it is still on the page.
  if (el?.isConnected) el.focus()
}
const confirm = () => {
  emit('confirm')
  dlg.value?.close()
}

const btn = 'select-none touch-manipulation [font:inherit] cursor-pointer text-black border-2 border-solid border-black focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px] py-[0.4rem] px-4'
</script>

<template>
  <dialog
    ref="dlg"
    class="m-auto p-0 w-[26rem] max-w-[calc(100vw-1rem)] bg-white text-[#0000aa] border-4 border-solid border-[#0000aa] font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:rgb(0_0_170/0.75)] animate-[reset-in_0.2s_ease-out] motion-reduce:animate-none"
    aria-labelledby="reset-title"
    aria-describedby="reset-desc"
    @close="onClose"
  >
    <div class="bg-[#0000aa] text-white py-1 px-2 select-none">
      <h2 id="reset-title" class="m-0 text-[1rem] font-bold">Tout oublier ?</h2>
    </div>
    <div class="p-4">
      <p id="reset-desc" class="[margin:0_0_1.2rem]">
        La voyante oubliera votre visage et vos visites. Le niveau de vigilance revient à 1.
      </p>
      <div class="flex flex-wrap gap-3 justify-end">
        <button ref="cancelBtn" :class="`${btn} bg-[#ffff55]`" type="button" autofocus @click="dlg?.close()">Annuler</button>
        <button :class="`${btn} bg-[#aaaaaa]`" type="button" @click="confirm">Oublier</button>
      </div>
    </div>
  </dialog>
</template>
