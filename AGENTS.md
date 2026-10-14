# AGENTS.md

"Réveillez-vous.js": Émile Brunelle's individual entry to the AGEEI (UQAM) Fortune.js Halloween challenge. Interactive voyance game: door, concentration, tarot card prophecy, escalating paranoia levels (1–5) with visits, CRT post-effect in WebGPU.

## Contest constraints (from the rules, voyance.pdf, now removed)
- Deadline: Saturday 2026-10-31 23:59. Submission by form with a public test link and info on technologies.
- Individual, one project per person; must be created specifically for the contest.
- Link must be public and working, no login/authorization, and stay up until winners are announced. Judged anonymously.
- AI allowed, but must be declared: whether used, which tools, how they helped (README section « Déclaration d’utilisation de l’IA »; Émile fills the placeholders).
- Criteria: creativity/originality; functionality/interactivity; design/UX; theme (voyance, predictions, chance, mystery, Halloween); effort/polish.
- Hosting undecided (Vercel Hobby preferred; `.github/workflows/deploy.yml` = GitHub Pages plan B, `BASE_PATH`). Never deploy or commit without Émile's OK.

## Commands and gates (all must pass before reporting done)
- `npx vitest run` (or `npm test`)
- `npx vue-tsc -b`
- `npx vite build` (`npm run build` = vue-tsc -b && vite build)
- `npm run dev` only when Émile asks; never leave servers running.

## Architecture (src/)
- `App.vue`: flow WebGPU gate, door, Concentration, TarotCard, « Fermer la porte », next variant.
- `engine/`: `grammar.ts` (Tracery-like, throws on unknown table/field), `shuffleBag.ts` (no repeats, localStorage `rvj-bags`), `prophecy.ts`, `knock.ts`, `variant.ts`, `rng.ts`, `paranoia.ts`.
- `content/`: `prophecies.ts` (levels 1–5, knocks, questions, paired tables, arcana), `scenes.ts` (5 doors, 5 backgrounds, `minLevel`), `prophecies.test.ts` (regression suite on real content).
- `components/`: door/background variants in `doors/`, `backgrounds/`; TarotCard (`fitBody` fits text 11–26 px, emblem shrinks/hides), Concentration, Vigilance, AboutTempleOS, WebGpuGate, CrtOverlay.
- `effects/`: `crt.wgsl` + `crt.ts` (vgpu, lazy chunk), `webgpu.ts` (navigator.gpu + requestAdapter check).
- `audio/sfx.ts`: all sounds synthesized (Web Audio), mute toggle.
- `composables/`: `useVisits` (localStorage `rvj-visits`; triple-click on the « Niveau de vigilance » badge resets), `useEntropy`.
- `ui/`: UnoCSS-styled components (Windows 98 look; shortcuts `win-window`, `win-btn`).

## Conventions
- Arrow functions everywhere (only generators excepted).
- Components held in refs: `shallowRef` + `markRaw`.
- UnoCSS only in `src/ui/**` (scanning is limited there; reset preflight disabled, presetWind4). Bespoke visuals: scoped CSS.
- Gameplay randomness: `secureRng` (crypto), never `Math.random`. `mulberry32` is for tests only.
- Listeners/timers: VueUse (`@vueuse/core`). CRT pauses when the tab is hidden.
- Keep Vue console warnings at zero.

## Content rules (French, Québec standard, full accents)
- Inclusive writing: épicène wording first; point médian for people only (« voyant·e »). Objects agree normally; templates avoid object participle agreement (put verbs in paired fields).
- Typographic apostrophe ’ everywhere (tests check it).
- Québec references over obscure internet memes. Jokes target places, never people.
- Theme first: every prophecy predicts something about the reader plus a voyance/Halloween element; conspiracy nods are seasoning (~3 in 10 per level).
- Excluded: 5G, vaccines, lizard people, CIA/"glowie", flat earth, real conspiracies; any mental-illness word (fou, schizo…; use « Vendredi noir »); no religion named in our own text (XVI = « La Tour foudroyée »).
- Homage to Terry A. Davis is strictly separate from the paranoia escalation: About text covers his work only; no Terry/Davis/TempleOS/HolyC in prophecy/arcane/knock content (enforced by `prophecies.test.ts`); the level-5 ending must not lead to him; no "TempleOS predicted COVID" joke.
- game-icons attribution (CC BY 3.0) stays in About and README.

## Accessibility and photosensitivity
- No luminance change at ≥ 3 Hz (WCAG 2.3.1); intensify CRT through spatial effects, not flicker.
- Respect `prefers-reduced-motion` (animations, CRT, illusions).
- "Fake illusion" changes must never alter functional UI (buttons, mute, « Fermer la porte »).

## Decisions not to revisit
- WebGPU mandatory, no CSS/WebGL fallback (gate screen only).
- vgpu (raymarching) over Three.js/TresJS.
- No seed system, no share feature.
- `paranoiaLevel()` in `src/engine/paranoia.ts` is Émile's to write (learning mode): do not edit it.

## Testing in a browser
- Playwright headless Chromium with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` reaches the card. The CRT pipeline failing to compile under swiftshader is expected.
- Open the door via aria-label « Ouvrir la porte » (the door itself is the button).
- Phone tests need HTTPS (insecure context has no WebGPU).
- Never `pkill`/`killall` browsers.
