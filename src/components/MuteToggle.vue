<script setup lang="ts">
import { Switch } from '@vuetify/v0'
import { muted } from '../audio/sfx'
</script>

<template>
  <Switch.Root v-model="muted" class="group inline-flex items-center gap-2 cursor-pointer text-[0.85rem] bg-[#000] px-[0.6rem] py-[0.35rem] border-2 border-solid border-fg select-none [-webkit-tap-highlight-color:transparent] touch-manipulation" aria-label="Couper le son">
    <span>{{ muted ? 'Son coupé' : 'Son actif' }}</span>
    <Switch.Track class="inline-flex w-[2.4rem] h-[1.2rem] border-2 border-solid border-fg bg-[#555] p-px data-[state=checked]:bg-[#aa0000] aria-checked:bg-[#aa0000]">
      <Switch.Thumb class="block w-[0.8rem] h-full bg-fg group-aria-checked:ml-auto group-data-[state=checked]:ml-auto" />
    </Switch.Track>
    <Switch.HiddenInput />
  </Switch.Root>
</template>
