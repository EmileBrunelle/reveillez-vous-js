# Réveillez-vous.js

Votre entrée au défi Fortune.js de l’AGEEI (UQAM), Halloween 2026 : une expérience de voyance interactive. Vous frappez à la porte d’un·e voyant·e, vous vous concentrez, et une carte de tarot vous livre une prophétie tirée au hasard. Plus vous revenez, plus le ton devient inquiet, paranoïaque, et le décor se détraque, sous un écran cathodique de vieil ordinateur hanté.

## Comment jouer

1. Ouvrez la page. Une porte apparaît : des coups résonnent derrière.
2. **Cliquez sur la porte** (ou activez-la au clavier, « Ouvrir la porte ») pour l’ouvrir.
3. Faites le rituel de **concentration** : maintenez une touche ou touchez l’écran jusqu’à ce que la jauge se remplisse.
4. Une **carte de tarot** est distribuée face cachée, puis retournée : lisez votre prophétie. Inclinez la carte avec le pointeur.
5. Cliquez sur **« Fermer la porte »** : la porte claque, une nouvelle porte et un nouveau décor vous attendent.

Le **niveau de vigilance** (de 1 à 5, affiché en badge) monte avec le nombre de visites dans votre navigateur. Les prophéties, les coups à la porte et l’ambiance évoluent avec lui. Un triple clic sur le badge (dans la barre des tâches, en bas) remet le compteur à zéro. L’icône de haut-parleur de la barre des tâches coupe l’audio, entièrement synthétisé ; le menu « Démarrer » donne accès à l’À propos, au code source et à « Recommencer à zéro ».

## Prérequis

- **WebGPU obligatoire** (aucune version de secours, c’est un choix assumé). Chrome ou Edge récents sont recommandés.
- Firefox : WebGPU est actif par défaut sous Windows et macOS (Apple Silicon). Sous Linux, il faut encore activer `dom.webgpu.enabled` dans `about:config`. Un écran d’accueil explique la marche à suivre si WebGPU est absent.
- Sur téléphone, la page doit être servie en HTTPS (WebGPU exige un contexte sécurisé).
- L’animation respecte la préférence « réduire les animations » du système.

## Lancer en local

```bash
npm install
npm run dev       # serveur de développement
npm test          # tests (vitest)
npm run build     # vérification des types + build de production
npm run preview   # prévisualiser le build
```

## Technologies

Vite, Vue 3, TypeScript, [vgpu](https://vgpu.sh) (WebGPU : effet cathodique en WGSL), [motion-v](https://motion.dev), [Vuetify0](https://github.com/vuetifyjs/0) (`@vuetify/v0`), [VueUse](https://vueuse.org), UnoCSS, unplugin-icons, Vitest. Les sons sont synthétisés avec la Web Audio API. Les prophéties sont générées par une petite grammaire maison de type Tracery.

## Crédits et licences

- Polices (SIL OFL 1.1, auto-hébergées via [Fontsource](https://fontsource.org)) : [VT323](https://fonts.google.com/specimen/VT323) (Peter Hull), [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) (Igino Marini), [Cinzel](https://fonts.google.com/specimen/Cinzel) (Natanael Gama).
- Icônes : [game-icons.net](https://game-icons.net) (CC BY 3.0).
- Icône GitHub : [Simple Icons](https://simpleicons.org) (CC0).
- Les bibliothèques ci-dessus sont utilisées selon leurs licences respectives.

## Hommage

Hommage à Terry A. Davis (1969–2018), qui a écrit seul TempleOS, un système d’exploitation complet avec son propre compilateur et son propre langage, HolyC. Son « oracle » tirait des mots au hasard ; ce site tire lui aussi ses prophéties au hasard. Cet hommage porte sur son œuvre uniquement.

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
