# Réveillez-vous.js

Une voyante frappe un rythme derrière une porte ; vous le répétez, la porte s’ouvre et une carte de tarot vous livre une prophétie. Plus vous revenez, plus le ton devient paranoïaque et le décor se détraque, le tout sous l’écran cathodique d’un vieux PC hanté (Windows 98). Entrée individuelle au défi Fortune.js de l’AGEEI (UQAM), Halloween 2026.

**Jouer : https://emilebrunelle.github.io/reveillez-vous-js/** (navigateur avec WebGPU requis, voir [Technologies](#technologies))

## Comment jouer

1. Ouvrez la page : une porte apparaît. Activez-la (clic, toucher ou clavier, « Ouvrir la porte »).
2. **La voyante cogne un rythme** : écoutez-le (ou suivez les points et les sous-titres à l’écran).
3. **Reproduisez-le** en cogneant sur la porte. Après trois échecs, la porte s’ouvre quand même.
4. Une **carte de tarot** est tirée face cachée, puis retournée : lisez votre prophétie. Inclinez la carte avec le pointeur ou en bougeant votre téléphone.
5. « Fermer la porte » : une nouvelle porte, un nouveau décor, une nouvelle prophétie.

Le **niveau de vigilance** (1 à 5, badge de l’œil dans la barre des tâches) monte avec le nombre de visites enregistrées dans votre navigateur (`localStorage`) ; il atteint le niveau 5 après six fermetures de porte. Prophéties, répliques de la voyante, portes et décors changent avec lui. Pour recommencer à zéro : menu **Démarrer › Recommencer à zéro**, ou triple clic sur le badge.

## Ce qui rend le projet spécial

- **Jeu de rythme à la porte** : la voyante cogne un motif, vous le rejouez ; jouable sans le son (points, sous-titres, vibration sur appareil compatible).
- **Prophéties générées** par une grammaire maison de type Tracery, avec arcane et **verset génératif** (livre × référence) ; des « sacs mélangés » persistés évitent les répétitions.
- **Escalade en 5 niveaux** : la paranoïa monte de visite en visite, jusqu’à un loup-garou qui apparaît au loin aux niveaux élevés.
- **Décor « perron sous la lune » en raymarching WebGPU** (WGSL, avec parallaxe) et **post-effet CRT** en WebGPU (vgpu).
- **Interface Windows 98** : barre des tâches, menu Démarrer, zone de notification (vigilance, son, horloge).
- **Tous les sons sont synthétisés** (Web Audio), sans fichier audio.
- Contenu en français québécois, écriture inclusive, références d’ici.

## Accessibilité

- Respect de `prefers-reduced-motion` (animations, effet CRT, parallaxe).
- Aucun changement de luminosité à 3 Hz ou plus ; l’intensité du CRT passe par des effets spatiaux, pas par du clignotement.
- Jeu complet sans le son : points, sous-titres des coups, vibration.
- Annonces `aria-live` pour la porte et la prophétie ; porte et menu Démarrer utilisables au clavier ; bouton pour couper le son.
- Le CRT se met en pause quand l’onglet est caché.

## Technologies

| Projet                   | Rôle                                                                                                          | Site                                                 | Dépôt                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Vue 3                    | interface                                                                                                     | [vuejs.org](https://vuejs.org)                       | [vuejs/core](https://github.com/vuejs/core)                               |
| Vite                     | build et serveur de dev                                                                                       | [vite.dev](https://vite.dev)                         | [vitejs/vite](https://github.com/vitejs/vite)                             |
| TypeScript               | typage                                                                                                        | [typescriptlang.org](https://www.typescriptlang.org) | [microsoft/TypeScript](https://github.com/microsoft/TypeScript)           |
| UnoCSS                   | styles utilitaires                                                                                            | [unocss.dev](https://unocss.dev)                     | [unocss/unocss](https://github.com/unocss/unocss)                         |
| VueUse                   | composables (écouteurs, minuteries, parallaxe, vibration)                                                     | [vueuse.org](https://vueuse.org)                     | [vueuse/vueuse](https://github.com/vueuse/vueuse)                         |
| motion-v                 | animations                                                                                                    | [motion.dev](https://motion.dev/docs/vue)            | [motiondivision/motion-vue](https://github.com/motiondivision/motion-vue) |
| Vuetify0 (`@vuetify/v0`) | primitives de composants sans style, à personnaliser — ici, le dialogue accessible de la fenêtre « À propos » | [0.vuetifyjs.com](https://0.vuetifyjs.com)           | [vuetifyjs/0](https://github.com/vuetifyjs/0)                             |
| vgpu                     | WebGPU : filtre CRT et fond 3D (shaders WGSL)                                                                 | [vgpu.sh](https://vgpu.sh)                           | [vercel-labs/vgpu](https://github.com/vercel-labs/vgpu)                   |
| unplugin-icons + Iconify | icônes (game-icons, Simple Icons)                                                                             | [iconify.design](https://iconify.design)             | [unplugin/unplugin-icons](https://github.com/unplugin/unplugin-icons)     |
| Fontsource               | polices auto-hébergées                                                                                        | [fontsource.org](https://fontsource.org)             | [fontsource/fontsource](https://github.com/fontsource/fontsource)         |
| Vitest                   | tests                                                                                                         | [vitest.dev](https://vitest.dev)                     | [vitest-dev/vitest](https://github.com/vitest-dev/vitest)                 |

Polices (Google Fonts, licence SIL OFL) : [VT323](https://fonts.google.com/specimen/VT323), [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English), [Cinzel](https://fonts.google.com/specimen/Cinzel).

**WebGPU est obligatoire** (choix assumé, pas de version de secours). Chrome ou Edge récents sont recommandés ; sinon, un écran d’accueil explique comment activer WebGPU selon le navigateur. Sur téléphone, la page doit être servie en **HTTPS** (WebGPU exige un contexte sécurisé).

## Lancer en local

```bash
npm install
npm run dev       # serveur de développement (`npm run dev -- --host` pour l’exposer sur le réseau local)
npm test          # tests (vitest, dossier tests/)
npm run build     # vue-tsc -b + build de production
npm run preview   # prévisualiser le build
```

Sur un téléphone, `http://<ip>:5173` n’est pas un contexte sécurisé : WebGPU y est absent, il faut un tunnel ou un déploiement HTTPS. Pour un déploiement sous un sous-chemin, définissez `BASE_PATH` (voir `.github/workflows/deploy.yml`, GitHub Pages).

## Structure du code

```
src/
  App.vue          enchaînement : écran WebGPU, porte, carte, « Fermer la porte »
  engine/          grammaire, sacs mélangés, prophéties, coups, rythme, niveaux, RNG injecté
  content/         prophéties (niveaux 1 à 5), portes et décors
  components/      DoorScene, KnockPattern, TarotCard, Taskbar, CrtOverlay, doors/, backgrounds/…
  effects/         crt.wgsl + crt.ts, porch.wgsl + porch.ts (perron), détection WebGPU
  audio/           sons synthétisés
  composables/     visites, inclinaison, mouvement réduit, stockage sûr
tests/             engine/, content/, composables/, effects/
```

## Crédits et licences

- Polices (SIL OFL 1.1, via [Fontsource](https://fontsource.org)) : [VT323](https://fonts.google.com/specimen/VT323) (Peter Hull), [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) (Igino Marini), [Cinzel](https://fonts.google.com/specimen/Cinzel) (Natanael Gama).
- Icônes : [game-icons.net](https://game-icons.net) (CC BY 3.0).
- Icône GitHub : [Simple Icons](https://simpleicons.org) (CC0).
- Les bibliothèques ci-dessus sont utilisées selon leurs licences respectives.

**Hommage.** À Terry A. Davis (1969–2018), qui a écrit seul TempleOS, un système d’exploitation complet avec son propre compilateur et son propre langage, HolyC. Son « oracle » tirait des mots au hasard ; ce site tire lui aussi ses prophéties au hasard. Cet hommage porte sur son œuvre uniquement.

## Déclaration d’utilisation de l’IA

Oui, l’IA a été utilisée, et beaucoup. Outil : **Claude Code** (Anthropic), avec les modèles Claude Opus, Sonnet et Haiku. Une session principale découpait le travail et le confiait à des sous-agents, puis vérifiait leurs résultats.

**Ce que l’IA a fait :**

- écrire la grande majorité du code (Vue, TypeScript, shader WGSL du CRT, sons synthétisés, moteur de génération des prophéties, détection du rythme cogné par le joueur, courbe de progression des niveaux) ;
- rédiger des ébauches de prophéties, de répliques et d’arcanes, retravaillées selon mes consignes ;
- écrire les tests automatisés et vérifier l’affichage dans un navigateur automatisé (Playwright) ;
- faire de la recherche (support de WebGPU selon les navigateurs, sources sur TempleOS, licences) ;
- rédiger la documentation, dont ce fichier.

**Ce que j’ai fait :**

- le concept, la direction artistique et le ton (vieux PC hanté, carte de tarot, montée du mystère) ;
- toutes les décisions de conception : WebGPU obligatoire, cartes plutôt que dépliant, porte fermée où l’on cogne un rythme à reproduire (règles de réussite et d’échec), pas de partage ni de graine ;
- les règles de contenu : écriture inclusive, références québécoises, blagues qui visent des lieux et jamais des personnes, exclusions ;
- la décision de séparer l’hommage à Terry A. Davis de la paranoïa, par respect ;
- les tests à la main dans le navigateur et les retours sur ce qui n’allait pas (taille de la carte, glitchs trop visibles, porte trop petite…) ;
- certaines blagues (dont l’Australie qui devient l’Argentine).

## Défi

Projet créé spécifiquement pour le défi Fortune.js de l’AGEEI (UQAM), participation individuelle.
