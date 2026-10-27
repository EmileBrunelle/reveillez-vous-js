# AGENTS.md

"Réveillez-vous.js": Émile Brunelle's individual entry to the AGEEI (UQAM) Fortune.js Halloween challenge. Interactive voyance game: door, concentration, tarot card prophecy, escalating paranoia levels (1–5) with visits, CRT post-effect in WebGPU.

## Contest constraints (from the rules, voyance.pdf, now removed)

- Deadline: Saturday 2026-10-31 23:59. Submission by form with a public test link and info on technologies.
- Individual, one project per person; must be created specifically for the contest.
- Link must be public and working, no login/authorization, and stay up until winners are announced.
- AI allowed, but must be declared: whether used, which tools, how they helped (README section « Déclaration d’utilisation de l’IA »; Émile fills the placeholders).
- Criteria: creativity/originality; functionality/interactivity; design/UX; theme (voyance, predictions, chance, mystery, Halloween); effort/polish.
- Hosting: GitHub Pages (Émile, 2026-10-27) via `.github/workflows/deploy.yml` (`BASE_PATH=/reveillez-vous-js/`); every push to main deploys, so push only verified batches. Never deploy or commit without Émile's OK.

## Commands and gates (all must pass before reporting done)

- `npx vitest run` (or `npm test`)
- `npx vue-tsc -b`
- `npx vite build` (`npm run build` = vue-tsc -b && vite build)
- `npm run lint` (ESLint 10, zero warnings)
- `npm run format:check` (Prettier; `npm run format` to fix; `.git-blame-ignore-revs` hides the reformat commit)
- `npm run dev` only when Émile asks; never leave servers running.

## Architecture (src/)

- `App.vue`: template + WebGPU gate and windows (About, Son, Collection, reset). Visit state machine (door → activity → cut → reading → finale: `enterDoor`, `leave`, `onPick`, `resetLevel`…) lives in `composables/useGameFlow.ts` (phase diagram in its header); lazy chunks (`ensureTarot`/`tarotFailed`, `ensureDoor`, async windows) in `composables/useLazyScenes.ts`; taskbar bubbles in `composables/useBubbles.ts`.
- `engine/`: `grammar.ts` (Tracery-like, throws on unknown table/field), `shuffleBag.ts` (no repeats, localStorage `rvj-bags`), `prophecy.ts`, `knock.ts`, `variant.ts`, `rng.ts`, `paranoia.ts`.
- `content/`: `prophecies.ts` (levels 1–5, knocks, questions, paired tables, arcana), `scenes.ts` (5 backgrounds; doors: 5 place doors + 2 rare humorous ones without `place`, picked by place first via `pickDoor`, `weight` 12 vs 1). Tests live in top-level `tests/` (mirrors `src/`, outside the bundle; `tests/content/prophecies.test.ts` = regression suite on real content, typed by `tsconfig.test.json`).
- `components/`: door/background variants in `doors/`, `backgrounds/`; TarotCard (`fitBody` fits text 11–26 px, emblem shrinks/hides), Concentration, Vigilance, About, WebGpuGate, CrtOverlay.
- `effects/`: `crt.wgsl` + `crt.ts` (vgpu, lazy chunk), `webgpu.ts` (navigator.gpu + requestAdapter check; the gate screen only says WebGPU is required, no per-browser instructions).
- Fonts: self-hosted via Fontsource (no CDN), latin subset only. VT323 = UI/terminal (`font-ui`, own `@font-face` in `styles.css` with `size-adjust: 125%` since VT323 is much smaller than Courier at equal size), IM Fell English 400/italic = card body and verse (`font-card`), Cinzel 700 = card numeral, question and banner (`font-title`). Families registered in `uno.config.ts` theme.font; imports in `main.ts`.
- `audio/sfx.ts`: all sounds synthesized (Web Audio), mute toggle.
- Piano (background music): phrases are hand-composed data in `content/pianoPhrases.ts` (5 phrases in A major, 63–68 BPM; Émile rejected procedural melodies, so new music means new composed phrases, not generators). `audio/musicPlan.ts` is pure (injected `Rng`): shuffle bag, F♯m/A minor re-harmonisation by level, humanisation, pedal, L5 degradation, `canStartPhrase`/`releaseBusy`/`musicGap`. `audio/pianoVoice.ts` = additive felt piano; cost cap (partials cut under -40 dB, voice stealing above 7 notes) keeps peak sources ≤ 60, enforced by `tests/audio/pianoCost.test.ts`. `audio/music.ts` (`startMusic`, started in `backgrounds/BgPlace.vue` beside `startAmbience`) plays through the ambience bus and never overlaps the motif or stingers (`motifBusyUntil`, `stingerBusyUntil` in `stinger.ts`); mute, hidden tab and finale fade it out. Keep Web Audio ramps > 0 (`setTargetAtTime` on the damper produced NaN offline).
- `stores/` (Pinia, setup-style `defineStore`; persistence via VueUse `useStorage`, not a Pinia plugin): `session.ts` (not persisted: knock pulse, taskbar notifications), `collection.ts` (arcana seen, localStorage `rvj-collection`, survives « Recommencer »), `audio.ts` (volumes persisted under `rvj-audio` via `useStorage` + `parseVolumes`, `muted` not persisted; `audio/sfx.ts` keeps the Web Audio buses and follows the store through watchers in a detached `effectScope`, because the first `ac()` can come from a component that later unmounts). `stores/progress.ts`: visit count (sessionStorage `rvj-visits` via `safeSessionStorage`, so progress resets when the tab or browser closes; the old localStorage key is deleted at startup; `rvj-bags` and `rvj-memory` stay in localStorage; triple-click on the « Niveau de vigilance » badge resets). `composables/`: `safeStorage`, `useActivityDone` (shared activity completion: per-activity timer, `outcome` play/win/fail, fail shows a funny line then continues; verbs, durations and outcome texts in `content/activityPrompts.ts`, HUD in `activities/ActivityHud.vue`, stingers in `audio/stinger.ts`), `useReducedMotion`, `useTilt`, `useTabTitle`.
- `components/Taskbar.vue`: fixed Windows 98 taskbar (Start menu: À propos, Code source, reset; tray: Vigilance badge, sound toggle, clock); `--taskbar-h` in styles.css is the reserved height.
- `ui/`: UnoCSS-styled components (Windows 98 look; shortcuts `win-window`, `win-btn`).
- `assets/svg/`: inline SVGs live as `.svg` files (doors, seer, icons), imported as components via `~icons/rvj/<name>` (unplugin-icons custom collection in `vite.config.ts`, `iconCustomizer` sets width/height to `unset` for `rvj` only, so no 1.2em: size with CSS classes on the usage, game-icons keep theirs; `class="door-handle"` inside door SVGs is animated by DoorScene).

## Conventions

- Arrow functions everywhere (only generators excepted).
- Components held in refs: `shallowRef` + `markRaw`.
- UnoCSS utilities and shortcuts (from `uno.config.ts`) for layout, spacing, color, typography, borders, states; reset preflight disabled, presetWind4. Scoped CSS stays for @keyframes, 3D chains (preserve-3d/perspective/backface/container queries), JS-driven CSS vars, decorative ::before/::after and multi-layer gradients, :deep/:has/data-attribute selectors. Dynamic class names must be full literals (the scanner can't see template-string classes).
- Code comments may be in French.
- Gameplay randomness goes through an injected `Rng` (`secureRng` in production, `mulberry32` in tests) so draws stay testable. Crypto is not a requirement; `Math.random` is fine for purely cosmetic noise (sparks, dust, audio).
- Listeners/timers: VueUse (`@vueuse/core`). CRT pauses when the tab is hidden.
- Keep Vue console warnings at zero.

## Content rules (French, Québec standard, full accents)

- Inclusive writing follows the UQAM rules (UQ network guide 2021 + UQAM BIRÉ 2023; BIRÉ wins): épicène wording first (« une personne », « on », « quiconque », collective nouns, « vous »); complete doublets (« voyantes et voyants ») sparingly; point médian only as a last resort in tight UI spots, one point per word (« voyant·e », « voyant·es », never « ·e·s »), never in prophecies or other running text (every table in `prophecies.ts`). No iel/iels/celleux/toustes or other neologisms in public text. « ils/elles » for undetermined people gets rephrased (« on », a noun); « ils/elles » for objects or animals is fine. Objects agree normally; templates avoid object participle agreement (put verbs in paired fields). Enforced by `tests/content/inclusive.test.ts`.
- Typographic apostrophe ’ everywhere (tests check it).
- Québec references over obscure internet memes. Jokes target places, never people.
- Deliberate exception, approved by Émile: a nod to the meme « Les gens qui parlent en français ont tellement de charisme » (Pokimane origin, widely reshared by Québec meme pages such as Fruiter, so it counts as Québec-circulated). Quoted affectionately, mocks no one; never name Pokimane in game content. The pronoun « iels » of the original is dropped (no neologisms).
- Theme first: every prophecy predicts something about the reader plus a voyance/Halloween element; conspiracy nods are seasoning (~3 in 10 per level).
- Excluded: 5G, vaccines, lizard people, CIA/"glowie", flat earth, real conspiracies; any mental-illness word (fou, schizo…; use « Vendredi noir »); no religion named in our own text (XVI = « La Tour foudroyée »).
- No homage to Terry A. Davis/TempleOS anywhere (removed 2026-10-26, Émile’s decision); the content tests keep banning those names.
- game-icons attribution (CC BY 3.0) stays in About and README.

## Accessibility and photosensitivity

- No luminance change at ≥ 3 Hz (WCAG 2.3.1); intensify CRT through spatial effects, not flicker.
- Respect `prefers-reduced-motion` (animations, CRT, illusions).
- "Fake illusion" changes must never alter functional UI (buttons, mute, « Fermer la porte »).

## Decisions not to revisit

- WebGPU mandatory, no CSS/WebGL fallback (gate screen only).
- vgpu (raymarching) over Three.js/TresJS.
- No seed system, no share feature.

## Testing in a browser

- Real GPU (CRT and shaders render, Intel Iris Xe via Vulkan): Playwright headless Chromium with `--enable-unsafe-webgpu --enable-features=Vulkan,WebGPU --ignore-gpu-blocklist --enable-gpu`, and NO swiftshader flag. Phone proxy (Galaxy S26+): viewport 384×832 (384×740 with toolbars), deviceScaleFactor 3, isMobile, hasTouch. Install Playwright in the scratchpad, not in the project.
- With `--use-webgpu-adapter=swiftshader` the app still reaches the card, but the CRT pipeline fails to compile (expected).
- Open the door via aria-label « Ouvrir la porte » (the door itself is the button).
- Phone tests need HTTPS (insecure context has no WebGPU).
- Never `pkill`/`killall` browsers.
