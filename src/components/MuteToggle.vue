<script setup lang="ts">
import { Switch } from '@vuetify/v0'
import { muted } from '../audio/sfx'
</script>

<template>
  <Switch.Root v-model="muted" class="mute" aria-label="Couper le son">
    <span class="mute__label">{{ muted ? 'Son coupé' : 'Son actif' }}</span>
    <Switch.Track class="mute__track">
      <Switch.Thumb class="mute__thumb" />
    </Switch.Track>
    <Switch.HiddenInput />
  </Switch.Root>
</template>
