<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import IconFool from '~icons/game-icons/jester-hat'
import IconWheel from '~icons/game-icons/ship-wheel'
import IconStar from '~icons/game-icons/star-formation'
import IconMoon from '~icons/game-icons/moon'
import IconSun from '~icons/game-icons/sun'
import IconLantern from '~icons/game-icons/lantern'
import IconTower from '~icons/game-icons/tower-fall'
import IconPumpkin from '~icons/game-icons/pumpkin'
import IconCone from '~icons/game-icons/traffic-cone'
import IconBridge from '~icons/game-icons/suspension-bridge'
import IconCrystal from '~icons/game-icons/crystal-ball'
import IconCat from '~icons/game-icons/cat'
import IconSignpost from '~icons/game-icons/doorway'
import IconGhost from '~icons/game-icons/ghost'
import IconEye from '~icons/game-icons/all-seeing-eye'

// Static imports: tree-shaken, no runtime fetching. Plain object of component definitions (never put in a ref).
const ICONS: Record<string, Component> = {
  fool: IconFool,
  wheel: IconWheel,
  star: IconStar,
  moon: IconMoon,
  sun: IconSun,
  lantern: IconLantern,
  tower: IconTower,
  pumpkin: IconPumpkin,
  cone: IconCone,
  bridge: IconBridge,
  crystal: IconCrystal,
  cat: IconCat,
  signpost: IconSignpost,
  ghost: IconGhost,
  eye: IconEye,
}
const props = defineProps<{ symbole: string }>()
const icon = computed(() => ICONS[props.symbole] ?? IconEye)
</script>

<template>
  <component :is="icon" class="block size-full" aria-hidden="true" />
</template>
