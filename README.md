# Réveillez-vous.js

[![Jouer](https://img.shields.io/badge/jouer-en_ligne-8a2be2?style=flat-square)](https://emilebrunelle.github.io/reveillez-vous-js/)
[![Déploiement](https://img.shields.io/github/actions/workflow/status/EmileBrunelle/reveillez-vous-js/deploy.yml?branch=main&style=flat-square&label=d%C3%A9ploiement)](https://github.com/EmileBrunelle/reveillez-vous-js/actions/workflows/deploy.yml)
![WebGPU requis](https://img.shields.io/badge/WebGPU-requis-005a9c?style=flat-square)
![Tests](https://img.shields.io/badge/tests-709_r%C3%A9ussis-brightgreen?style=flat-square)
![Couverture](https://img.shields.io/badge/couverture-60%25-yellow?style=flat-square)
![Vue 3 et TypeScript](https://img.shields.io/badge/Vue_3-TypeScript-42b883?style=flat-square&logo=vuedotjs&logoColor=white)
[![Défi Fortune.js](https://img.shields.io/badge/d%C3%A9fi-Fortune.js_%C2%B7_AGEEI-ff7518?style=flat-square)](https://ageei.org/calendrier#event-638e0f24-afd5-4d20-b8e2-c76e02931e1c)

> Frappez le bon rythme, ouvrez la porte, recevez votre prophétie.

**[Jouer en ligne](https://emilebrunelle.github.io/reveillez-vous-js/)** : une partie complète dure quelques minutes. Navigateur avec WebGPU requis (Chrome ou Edge récents recommandés, voir [Technologies](#technologies)).

## En bref

- Une personne voyante frappe un rythme derrière une porte ; vous le répétez, la porte s’ouvre et une carte de tarot vous livre une prophétie.
- Plus vous revenez, plus le ton devient paranoïaque et le décor se détraque (niveaux 1 à 5), jusqu’à une finale qui rend la lumière du jour.
- Le tout sous l’écran cathodique d’un vieux PC hanté (Windows 98), avec post-effet CRT en WebGPU.
- Entrée individuelle au défi Fortune.js de l’AGEEI (UQAM), Halloween 2026.

## Comment jouer

1. Ouvrez la page : une porte apparaît. Activez-la (clic, toucher, ou Tab puis Entrée au clavier) : c’est le bouton « Cogner à la porte ».
2. **La personne voyante cogne un rythme** : écoutez-le (ou suivez les points, les sous-titres et la vibration sur appareil compatible).
3. **Reproduisez-le** en cognant sur la porte (clic, toucher, ou Entrée ou Espace au clavier). Après trois échecs, la porte s’ouvre quand même.
4. **Dès le niveau 2, une petite activité** précède la carte ; elle s’achève d’elle-même après 16 à 20 s, ou avec le bouton pour la passer. Au fil des niveaux : attraper des feux follets, allumer des chandelles à l’allumette, épeler un mot à la planche Ouija, frapper aux fenêtres d’une maison dans l’ordre où elles s’allument, essuyer une boule de cristal.
5. **Coupez le paquet** : trois paquets (Nuit, Feu, Brume), chacun avec son dos, sa légende et son tirage d’arcanes. Souris : survolez, puis cliquez. Clavier : Tab, puis Entrée. Tactile : un premier toucher donne un aperçu, un second choisit.
6. Une **carte de tarot** est tirée face cachée, puis retournée : lisez votre prophétie. Inclinez la carte avec le pointeur, avec le doigt ou en bougeant votre téléphone. Chaque arcane vu s’ajoute à la **Collection** (menu Démarrer).
7. « Fermer la porte » : une nouvelle porte, un nouveau lieu, une nouvelle prophétie.

Le **niveau de vigilance** (1 à 5, badge de l’œil dans la barre des tâches) monte avec le nombre de visites de la session en cours (`sessionStorage` : la progression repart à zéro quand l’onglet ou le navigateur se ferme) ; il atteint le niveau 5 après sept fermetures de porte, puis vient la **finale**, avec son générique animé. Prophéties, répliques de la voyante, portes, lieux et sons changent avec lui. Pour recommencer à zéro : menu **Démarrer › Recommencer à zéro**, ou triple-clic sur le badge.

## Ce qui rend le projet spécial

- **Jeu de rythme à la porte** : la personne voyante cogne un motif, vous le rejouez ; jouable sans le son (points, sous-titres, vibration).
- **Prophéties générées** par une grammaire maison de type Tracery, avec arcane et **verset génératif** (livre × référence) ; des « sacs mélangés » persistés évitent les répétitions.
- **Escalade en 5 niveaux** : la paranoïa monte de visite en visite, à travers cinq lieux (perron, forêt, cimetière, rue, nuages) avec leurs variantes de météo et de portes, et cinq petites activités.
- **Décors en raymarching WebGPU** (WGSL) et **post-effet CRT** en WebGPU (vgpu), mis à l’échelle sur grand écran.
- **Interface Windows 98** : barre des tâches, menu Démarrer (À propos, Collection, Son, code source, plein écran), zone de notification (vigilance, son, horloge).
- **Tous les sons sont synthétisés** (Web Audio), sans fichier audio : lits d’ambiance par lieu avec fondus, limiteur de sortie, leitmotif de trois notes (tonalité de la majeur) qui revient jusqu’à la finale, volumes réglables par catégorie.
- Contenu en français québécois, écriture inclusive, références d’ici.

## Accessibilité

- Respect de `prefers-reduced-motion` (animations, effet CRT, illusions).
- Aucun changement de luminosité à 3 Hz ou plus ; l’intensité du CRT passe par des effets spatiaux, pas par du clignotement. Les vibrations sont de courtes impulsions espacées.
- Jeu complet sans le son : points, sous-titres des coups, vibration.
- Utilisable au clavier (porte, paquets, activités, menu Démarrer, fenêtres), avec un focus visible quand on navigue au clavier.
- Annonces `aria-live` pour la porte, la prophétie et les activités ; bouton pour couper le son.
- Zones sûres respectées sur téléphone (encoches, barre de gestes) ; le CRT se met en pause quand l’onglet est caché.

## Technologies

| Projet                   | Rôle                                                                                                          | Site                                                        | Dépôt                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Vue 3                    | interface                                                                                                     | [fr.vuejs.org](https://fr.vuejs.org)                        | [vuejs/core](https://github.com/vuejs/core)                               |
| Vite                     | compilation et serveur de développement                                                                       | [vite.dev](https://vite.dev)                                | [vitejs/vite](https://github.com/vitejs/vite)                             |
| TypeScript               | typage                                                                                                        | [typescriptlang.org/fr](https://www.typescriptlang.org/fr/) | [microsoft/TypeScript](https://github.com/microsoft/TypeScript)           |
| UnoCSS                   | styles utilitaires                                                                                            | [unocss.dev](https://unocss.dev)                            | [unocss/unocss](https://github.com/unocss/unocss)                         |
| VueUse                   | composables (écouteurs, minuteries, vibration)                                                                | [vueuse.org](https://vueuse.org)                            | [vueuse/vueuse](https://github.com/vueuse/vueuse)                         |
| motion-v                 | animations                                                                                                    | [motion.dev](https://motion.dev/docs/vue)                   | [motiondivision/motion-vue](https://github.com/motiondivision/motion-vue) |
| Vuetify0 (`@vuetify/v0`) | primitives de composants sans style, à personnaliser — ici, le dialogue accessible de la fenêtre « À propos » | [0.vuetifyjs.com](https://0.vuetifyjs.com)                  | [vuetifyjs/0](https://github.com/vuetifyjs/0)                             |
| Pinia                    | état partagé (progression, collection)                                                                        | [pinia.vuejs.org](https://pinia.vuejs.org)                  | [vuejs/pinia](https://github.com/vuejs/pinia)                             |
| vgpu                     | WebGPU : filtre CRT et fond 3D (shaders WGSL)                                                                 | [vgpu.sh](https://vgpu.sh)                                  | [vercel-labs/vgpu](https://github.com/vercel-labs/vgpu)                   |
| unplugin-icons + Iconify | icônes (game-icons, Simple Icons)                                                                             | [iconify.design](https://iconify.design)                    | [unplugin/unplugin-icons](https://github.com/unplugin/unplugin-icons)     |
| Fontsource               | polices auto-hébergées                                                                                        | [fontsource.org](https://fontsource.org)                    | [fontsource/fontsource](https://github.com/fontsource/fontsource)         |
| Vitest                   | tests                                                                                                         | [vitest.dev](https://vitest.dev)                            | [vitest-dev/vitest](https://github.com/vitest-dev/vitest)                 |

Polices (Google Fonts, licence SIL OFL) : [VT323](https://fonts.google.com/specimen/VT323), [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English), [Cinzel](https://fonts.google.com/specimen/Cinzel).

**WebGPU est obligatoire** (choix assumé, pas de version de secours). Chrome ou Edge récents sont recommandés ; sans WebGPU, un écran d’accueil l’indique. Sur téléphone, la page doit être servie en **HTTPS** (WebGPU exige un contexte sécurisé).

## Qualité

709 tests (94 fichiers, Vitest) couvrent le moteur, le contenu, l’audio, les stores et les composants. Couverture mesurée avec `npm run test:coverage` (v8, `src/`) :

| Instructions | Branches | Fonctions | Lignes |
| ------------ | -------- | --------- | ------ |
| 59,6 %       | 47,1 %   | 60,3 %    | 60,0 % |

Contrôles à passer avant toute livraison : `npx vitest run`, `npx vue-tsc -b`, `npm run lint` (ESLint, zéro avertissement), `npm run format:check` (Prettier) et `npm run build`.

## Lancer en local

```bash
npm install
npm run dev       # serveur de développement (`npm run dev -- --host` pour l’exposer sur le réseau local)
npm test          # tests (vitest, dossier tests/)
npm run test:coverage  # tests avec rapport de couverture (v8)
npm run lint      # ESLint, zéro avertissement
npm run format:check  # Prettier
npm run build     # vue-tsc -b + build de production
npm run preview   # prévisualiser le build
```

Sur un téléphone, `http://<ip>:5173` n’est pas un contexte sécurisé : WebGPU y est absent, il faut un tunnel ou un déploiement HTTPS. Pour un déploiement sous un sous-chemin, définissez `BASE_PATH` (voir `.github/workflows/deploy.yml`, GitHub Pages).

## Structure du code

```
src/
  App.vue          enchaînement : écran WebGPU, porte, activité, coupe, carte, finale
  engine/          grammaire, sacs mélangés, prophéties, coups, rythme, niveaux, activités, collection, RNG injecté
  content/         prophéties (niveaux 1 à 5), portes, lieux, finale
  components/      DoorScene, KnockPattern, DeckCut, TarotCard, Finale, Taskbar, CrtOverlay, activities/, backgrounds/…
  effects/         shaders WGSL (CRT, lieux, boule de cristal) et leur code, détection WebGPU
  audio/           sons synthétisés (ambiance, leitmotif, finale, effets)
  stores/          progression, collection, session
  composables/     inclinaison, toucher, vibration, mouvement réduit, stockage sûr
tests/             engine/, content/, composables/, effects/, audio/, components/, stores/
```

## Crédits et licences

- Polices (SIL OFL 1.1, via [Fontsource](https://fontsource.org)) : [VT323](https://fonts.google.com/specimen/VT323) (Peter Hull), [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) (Igino Marini), [Cinzel](https://fonts.google.com/specimen/Cinzel) (Natanael Gama).
- Icônes : [game-icons.net](https://game-icons.net) (CC BY 3.0).
- Icône GitHub : [Simple Icons](https://simpleicons.org) (CC0).
- Les bibliothèques ci-dessus sont utilisées selon leurs licences respectives.

## Déclaration d’utilisation de l’IA

Oui, l’IA a été utilisée, et beaucoup. Outil : **Claude Code** (Anthropic), avec les modèles Claude Opus, Sonnet et Haiku. Une session principale découpait le travail et le confiait à des sous-agents, puis vérifiait leurs résultats.

**Ce que l’IA a fait :**

- écrire la grande majorité du code (Vue, TypeScript, shader WGSL du CRT, sons synthétisés, moteur de génération des prophéties, détection du rythme cogné par la personne qui joue, courbe de progression des niveaux) ;
- rédiger des ébauches de prophéties, de répliques et d’arcanes, retravaillées selon mes consignes ;
- écrire les tests automatisés et vérifier l’affichage dans un navigateur automatisé (Playwright) ;
- faire de la recherche (support de WebGPU selon les navigateurs, licences) ;
- rédiger la documentation, dont ce fichier.

**Ce que j’ai fait :**

- le concept, la direction artistique et le ton (vieux PC hanté, carte de tarot, montée du mystère) ;
- toutes les décisions de conception : WebGPU obligatoire, cartes plutôt que dépliant, porte fermée où l’on cogne un rythme à reproduire (règles de réussite et d’échec), pas de partage ni de graine ;
- les règles de contenu : écriture inclusive, références québécoises, blagues qui visent des lieux et jamais des personnes, exclusions ;
- les tests à la main dans le navigateur et les retours sur ce qui n’allait pas (taille de la carte, pépins visuels trop voyants, porte trop petite…) ;
- certaines blagues (dont l’Australie qui devient l’Argentine).

## Défi

Projet créé spécifiquement pour le [défi Fortune.js](https://ageei.org/calendrier#event-638e0f24-afd5-4d20-b8e2-c76e02931e1c) de l’AGEEI (UQAM), participation individuelle.
