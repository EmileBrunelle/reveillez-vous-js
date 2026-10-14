<script setup lang="ts">
import { detectBrowser } from '../effects/webgpu'

defineEmits<{ retry: []; about: [] }>()
const browser = detectBrowser(navigator.userAgent)
</script>

<template>
  <main class="gate" role="alert">
    <h1 class="gate__title">Les ondes divines exigent WebGPU</h1>
    <p>
      Sans WebGPU, impossible de capter la transmission. Ce n’est pas négociable : le dépliant ne
      s’ouvrira pas tant que votre navigateur n’aura pas accès à votre carte graphique.
    </p>

    <section v-if="browser === 'firefox'" class="gate__how">
      <h2>Firefox</h2>
      <ol>
        <li>Mettez Firefox à jour (version récente).</li>
        <li>Ouvrez <code>about:config</code> et acceptez l’avertissement.</li>
        <li>Réglez <code>dom.webgpu.enabled</code> à <code>true</code>.</li>
        <li>Redémarrez complètement Firefox.</li>
        <li>
          En dernier recours seulement, si votre carte graphique est sur la liste noire :
          <code>gfx.webgpu.ignore-blocklist</code> à <code>true</code> (peut causer de l’instabilité).
        </li>
      </ol>
      <p>Sous Linux, WebGPU est souvent désactivé par défaut dans Firefox.</p>
    </section>

    <section v-else-if="browser === 'chromium'" class="gate__how">
      <h2>Chrome, Edge et cie</h2>
      <p>WebGPU devrait fonctionner sans réglage. Sinon :</p>
      <ol>
        <li>Mettez le navigateur à jour.</li>
        <li>Vérifiez <code>chrome://gpu</code> (ou <code>edge://gpu</code>) : WebGPU doit être « Hardware accelerated ».</li>
        <li>
          Ouvrez <code>chrome://flags</code> (ou <code>edge://flags</code>), activez
          « Unsafe WebGPU Support », puis relancez.
        </li>
        <li>Activez l’accélération matérielle dans les paramètres Système.</li>
      </ol>
    </section>

    <section v-else-if="browser === 'safari'" class="gate__how">
      <h2>Safari</h2>
      <ol>
        <li>Utilisez une version récente de Safari (macOS, iOS ou iPadOS à jour).</li>
        <li>
          Si ça ne passe toujours pas : Réglages › Avancé › cochez « Afficher les fonctionnalités pour
          développeurs », puis Développement › Fonctionnalités expérimentales (Feature Flags) › WebGPU.
        </li>
        <li>Relancez Safari.</li>
      </ol>
    </section>

    <section v-else class="gate__how">
      <h2>Votre navigateur</h2>
      <p>
        Essayez une version récente de Chrome, Edge, Safari ou Firefox, avec l’accélération matérielle
        activée.
      </p>
    </section>

    <button class="btn" type="button" @click="$emit('retry')">Réessayer</button>
    <p class="footer">
      Hommage à Terry A. Davis (1969–2018) ·
      <button class="linklike" type="button" @click="$emit('about')">À propos</button>
    </p>
  </main>
</template>
