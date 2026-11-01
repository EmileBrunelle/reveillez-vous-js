<script setup lang="ts">
import { computed, useId } from 'vue'
import { lookFor } from './doorLook'

/**
 * Donne du volume à un SVG de porte plat sans le redessiner : un filtre SVG fait de la luminance et de la silhouette une carte de hauteur
 * (panneaux, planches, arêtes), l’éclaire d’une lumière directionnelle (celle de la lune ou de la lampe du lieu), ajoute le grain de la
 * matière et un reflet sur les arêtes et la quincaillerie, puis teinte le tout à la couleur ambiante. Le résultat est découpé sur la
 * silhouette d’origine : rien ne déborde, et le filtre est statique (recalculé seulement si le contenu du SVG change, par exemple la poignée
 * qui tourne), jamais par image du fond ni de la caméra.
 */
const { doorId } = defineProps<{ doorId: string }>()
const fid = `door-shade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const look = computed(() => lookFor(doorId))
// Intensité des lumières : les valeurs vivent ici pour rester lisibles à côté du filtre.
// Dégradé de lumière sur toute la porte (clair côté lune ou lampe, sombre à l’opposé) et assombrissement vers le sol : image SVG intégrée,
// rendue une fois par le filtre (feImage), pas un calque de plus à composer.
const falloff = computed(() => {
  const a = (look.value.azimuth * Math.PI) / 180
  const [c, s] = [Math.cos(a) * 50, Math.sin(a) * 50]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>` +
    `<defs><linearGradient id='l' gradientUnits='userSpaceOnUse' x1='${50 - c}' y1='${50 - s}' x2='${50 + c}' y2='${50 + s}'><stop offset='0' stop-color='#7a7a7a'/><stop offset='1' stop-color='#fff'/></linearGradient>` +
    `<linearGradient id='v' x1='0' y1='0' x2='0' y2='1'><stop offset='0.55' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='0.4'/></linearGradient></defs>` +
    `<rect width='100' height='100' fill='url(#l)'/><rect width='100' height='100' fill='url(#v)'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})
const surface = computed(() => 3.2 * look.value.relief)
const specular = computed(() => 0.55 * look.value.relief)
</script>

<template>
  <div class="door-skin block w-full h-full">
    <svg class="absolute w-0 h-0 pointer-events-none" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter :id="fid" x="-12%" y="-6%" width="124%" height="112%" color-interpolation-filters="sRGB">
          <!-- Carte de hauteur : silhouette + luminance (les traits sombres deviennent des rainures) + grain, adoucie. -->
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.3 0.55 0.15 0 0" result="lum" />
          <feComposite in="SourceAlpha" in2="lum" operator="arithmetic" k2="0.8" k3="0.55" result="relief0" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="rounded" />
          <feComposite in="relief0" in2="rounded" operator="arithmetic" k2="1" k3="0.9" result="relief" />
          <feTurbulence type="fractalNoise" :baseFrequency="look.grain.freq" :numOctaves="look.grain.octaves" seed="7" result="grain" />
          <feComposite in="relief" in2="grain" operator="arithmetic" k2="1" :k3="look.grain.amp" result="height0" />
          <feGaussianBlur in="height0" stdDeviation="0.7" result="height" />
          <!-- Lumière diffuse (surface éclairée), puis modulation de la couleur d’origine. -->
          <feDiffuseLighting in="height" :surfaceScale="surface" diffuseConstant="1" lighting-color="#ffffff" result="lit">
            <feDistantLight :azimuth="look.azimuth" elevation="52" />
          </feDiffuseLighting>
          <feImage :href="falloff" preserveAspectRatio="none" result="falloff" />
          <feComposite in="lit" in2="falloff" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="light" />
          <feComposite in="SourceGraphic" in2="light" operator="arithmetic" :k1="1.3 * look.gain" k2="0" k3="0" k4="0" result="shaded" />
          <feFlood :flood-color="look.tint" result="tint" />
          <feBlend in="shaded" in2="tint" mode="multiply" result="toned" />
          <feComposite in="toned" in2="SourceAlpha" operator="in" result="body" />
          <!-- Reflet des arêtes et de la quincaillerie, côté lumière. -->
          <feSpecularLighting in="height" :surfaceScale="surface" :specularConstant="specular" specularExponent="18" :lighting-color="look.rim" result="spec">
            <feDistantLight :azimuth="look.azimuth" elevation="38" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="glint" />
          <feComposite in="glint" in2="body" operator="arithmetic" k2="1" k3="1" />
        </filter>
      </defs>
    </svg>
    <div class="block w-full h-full" :style="{ filter: `url(#${fid})` }"><slot /></div>
  </div>
</template>
