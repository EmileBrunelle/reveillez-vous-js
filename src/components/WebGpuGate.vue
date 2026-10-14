<script setup lang="ts">
import IconGithub from '~icons/simple-icons/github'
import { detectBrowser } from '../effects/webgpu'

defineEmits<{ retry: []; about: [] }>()
const browser = detectBrowser(navigator.userAgent)
// Boîte d'instructions: h2 et code stylés par descendance (aucune classe par élément).
const howBox =
  'border-2 border-solid border-alt px-4 py-3 [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-2 [&_h2]:text-[1.1rem] [&_h2]:text-alt [&_code]:bg-[#222] [&_code]:py-0 [&_code]:px-[0.3rem] [&_code]:text-accent [&_code]:select-text'
</script>

<template>
  <main class="min-h-screen max-w-[40rem] mx-auto px-4 py-8 grid gap-4 content-center leading-[1.5] bg-[#000] text-fg select-none [-webkit-tap-highlight-color:transparent]" role="alert">
    <h1 class="m-0 text-accent uppercase text-[1.6rem]">Les ondes divines exigent WebGPU</h1>
    <p>Sans WebGPU, impossible de capter la transmission. Ce n’est pas négociable : le dépliant ne s’ouvrira pas tant que votre navigateur n’aura pas accès à votre carte graphique.</p>

    <section v-if="browser === 'firefox'" :class="howBox">
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

    <section v-else-if="browser === 'chromium'" :class="howBox">
      <h2>Chrome, Edge et cie</h2>
      <p>WebGPU devrait fonctionner sans réglage. Sinon :</p>
      <ol>
        <li>Mettez le navigateur à jour.</li>
        <li>Vérifiez <code>chrome://gpu</code> (ou <code>edge://gpu</code>) : WebGPU doit être « Hardware accelerated ».</li>
        <li>Ouvrez <code>chrome://flags</code> (ou <code>edge://flags</code>), activez « Unsafe WebGPU Support », puis relancez.</li>
        <li>Activez l’accélération matérielle dans les paramètres Système.</li>
      </ol>
    </section>

    <section v-else-if="browser === 'safari'" :class="howBox">
      <h2>Safari</h2>
      <ol>
        <li>Utilisez une version récente de Safari (macOS, iOS ou iPadOS à jour).</li>
        <li>
          Si ça ne passe toujours pas : Réglages › Avancé › cochez « Afficher les fonctionnalités pour développeurs », puis Développement › Fonctionnalités expérimentales (Feature Flags) › WebGPU.
        </li>
        <li>Relancez Safari.</li>
      </ol>
    </section>

    <section v-else :class="howBox">
      <h2>Votre navigateur</h2>
      <p>Essayez une version récente de Chrome, Edge, Safari ou Firefox, avec l’accélération matérielle activée.</p>
    </section>

    <button class="btn justify-self-start" type="button" @click="$emit('retry')">Réessayer</button>
    <footer class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem]">
      <a
        class="linklike opacity-90"
        href="https://fr.wikipedia.org/wiki/Terry_A._Davis"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hommage à Terry A. Davis (1969–2018), Wikipédia (nouvel onglet)"
        >Hommage à Terry A. Davis (1969–2018)</a
      >
      <button class="linklike opacity-90" type="button" @click="$emit('about')">À propos</button>
      <a class="linklike opacity-90" href="https://github.com/EmileBrunelle/reveillez-vous-js" target="_blank" rel="noopener noreferrer" aria-label="Code source sur GitHub (nouvel onglet)">
        <IconGithub class="w-[1em] h-[1em] align-[-0.125em] mr-[0.3em]" aria-hidden="true" />
        Code source
      </a>
    </footer>
  </main>
</template>
