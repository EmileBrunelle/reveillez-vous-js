# AGENTS.md

"Réveillez-vous.js": Émile Brunelle's individual entry to the AGEEI (UQAM) Fortune.js Halloween challenge. Interactive voyance game: door, concentration, tarot card prophecy, escalating paranoia levels (1–5) with visits, CRT post-effect in WebGPU.

## Contest constraints (from the rules, voyance.pdf, now removed)

- Deadline: Saturday 2026-10-31 23:59. Submission by form with a public test link and info on technologies.
- Individual, one project per person; must be created specifically for the contest.
- Link must be public and working, no login/authorization, and stay up until winners are announced.
- AI allowed, but must be declared: whether used, which tools, how they helped (README section « Déclaration d’utilisation de l’IA »; Émile fills the placeholders).
- Criteria: creativity/originality; functionality/interactivity; design/UX; theme (voyance, predictions, chance, mystery, Halloween); effort/polish.
- Hosting undecided (Vercel Hobby preferred; `.github/workflows/deploy.yml` = GitHub Pages plan B, `BASE_PATH`). Never deploy or commit without Émile's OK.

## Commands and gates (all must pass before reporting done)

- `npx vitest run` (or `npm test`)
- `npx vue-tsc -b`
- `npx vite build` (`npm run build` = vue-tsc -b && vite build)
- `npm run lint` (ESLint 10, zero warnings)
- `npm run format:check` (Prettier; `npm run format` to fix; `.git-blame-ignore-revs` hides the reformat commit)
- `npm run dev` only when Émile asks; never leave servers running.

## Architecture (src/)

- `App.vue`: flow WebGPU gate, door, Concentration, TarotCard, « Fermer la porte », next variant.
- `engine/`: `grammar.ts` (Tracery-like, throws on unknown table/field), `shuffleBag.ts` (no repeats, localStorage `rvj-bags`), `prophecy.ts`, `knock.ts`, `variant.ts`, `rng.ts`, `paranoia.ts`.
- `content/`: `prophecies.ts` (levels 1–5, knocks, questions, paired tables, arcana), `scenes.ts` (5 doors, 5 backgrounds, `minLevel`). Tests live in top-level `tests/` (mirrors `src/`, outside the bundle; `tests/content/prophecies.test.ts` = regression suite on real content, typed by `tsconfig.test.json`).
- `components/`: door/background variants in `doors/`, `backgrounds/`; TarotCard (`fitBody` fits text 11–26 px, emblem shrinks/hides), Concentration, Vigilance, AboutTempleOS, WebGpuGate, CrtOverlay.
- `effects/`: `crt.wgsl` + `crt.ts` (vgpu, lazy chunk), `webgpu.ts` (navigator.gpu + requestAdapter check).
- Fonts: self-hosted via Fontsource (no CDN), latin subset only. VT323 = UI/terminal (`font-ui`, own `@font-face` in `styles.css` with `size-adjust: 125%` since VT323 is much smaller than Courier at equal size), IM Fell English 400/italic = card body and verse (`font-card`), Cinzel 700 = card numeral, question and banner (`font-title`). Families registered in `uno.config.ts` theme.font; imports in `main.ts`.
- `audio/sfx.ts`: all sounds synthesized (Web Audio), mute toggle.
- `composables/`: `useVisits` (localStorage `rvj-visits`; triple-click on the « Niveau de vigilance » badge resets), `useEntropy`.
- `components/Taskbar.vue`: fixed Windows 98 taskbar (Start menu: À propos, Code source, homage, reset; tray: Vigilance badge, sound toggle, clock); `--taskbar-h` in styles.css is the reserved height.
- `ui/`: UnoCSS-styled components (Windows 98 look; shortcuts `win-window`, `win-btn`).
- `assets/svg/`: inline SVGs live as `.svg` files (doors, seer, icons), imported as components via `~icons/rvj/<name>` (unplugin-icons custom collection in `vite.config.ts`, no default 1.2em size: size with CSS classes on the usage; `class="door-handle"` inside door SVGs is animated by DoorScene).

## Conventions

- Arrow functions everywhere (only generators excepted).
- Components held in refs: `shallowRef` + `markRaw`.
- UnoCSS utilities and shortcuts (from `uno.config.ts`) for layout, spacing, color, typography, borders, states; reset preflight disabled, presetWind4. Scoped CSS stays for @keyframes, 3D chains (preserve-3d/perspective/backface/container queries), JS-driven CSS vars, decorative ::before/::after and multi-layer gradients, :deep/:has/data-attribute selectors. Dynamic class names must be full literals (the scanner can't see template-string classes).
- Code comments may be in French.
- Gameplay randomness goes through an injected `Rng` (`secureRng` in production, `mulberry32` in tests) so draws stay testable. Crypto is not a requirement; `Math.random` is fine for purely cosmetic noise (sparks, dust, audio).
- Listeners/timers: VueUse (`@vueuse/core`). CRT pauses when the tab is hidden.
- Keep Vue console warnings at zero.

## Content rules (French, Québec standard, full accents)

- Inclusive writing: épicène wording first; point médian for people only (« voyant·e »). Objects agree normally; templates avoid object participle agreement (put verbs in paired fields).
- Typographic apostrophe ’ everywhere (tests check it).
- Québec references over obscure internet memes. Jokes target places, never people.
- Deliberate exception, approved by Émile: a nod to the meme « Les gens qui parlent en français, iels ont tellement de charisme » (Pokimane origin, widely reshared by Québec meme pages such as Fruiter, so it counts as Québec-circulated). Quoted affectionately, mocks no one; never name Pokimane in game content. « iel/iels » is acceptable for people where it fits the tone.
- Theme first: every prophecy predicts something about the reader plus a voyance/Halloween element; conspiracy nods are seasoning (~3 in 10 per level).
- Excluded: 5G, vaccines, lizard people, CIA/"glowie", flat earth, real conspiracies; any mental-illness word (fou, schizo…; use « Vendredi noir »); no religion named in our own text (XVI = « La Tour foudroyée »).
- Homage to Terry A. Davis is strictly separate from the paranoia escalation: About text covers his work only; no Terry/Davis/TempleOS/HolyC in prophecy/arcane/knock content (enforced by `tests/content/prophecies.test.ts`); the level-5 ending must not lead to him; no "TempleOS predicted COVID" joke.
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
