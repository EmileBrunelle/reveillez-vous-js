struct Params {
  time: f32,
  height: f32, // hauteur du canevas en pixels de l’APPAREIL
  motion: f32,
  paranoia: f32, // 0..1
  width: f32, // largeur du canevas en pixels de l’APPAREIL
  rippleAge: f32, // secondes depuis le dernier coup (non ramené), borné par l’appelant
  rippleAmp: f32, // 0..1
}
@group(0) @binding(0) var<uniform> params: Params;

// Le temps arrive ramené dans [0, PERIOD). Chaque terme piloté par le temps est un sin/fract de t * (n * 2*pi/PERIOD)
// avec n entier : le retour à PERIOD est donc sans couture. Fréquences utilisées (Hz = n/100) :
//   scintillement 37 (0,37 Hz) et 150 (1,5 Hz) ; bande 7 (0,07 Hz) ; ligne de suivi 9 (0,09 Hz), fenêtre 11 (0,11 Hz),
//   ondulation de la ligne 300 (3 Hz, position seulement) ; le grain change de graine à 30 Hz (30*100 pas entiers).
const W: f32 = 6.28318531 / 100.0;
const TAU: f32 = 6.28318531;

const RIPPLE_SPEED: f32 = 1.2; // unités du côté court par seconde
const RIPPLE_DUR: f32 = 0.8;
const RIPPLE_W: f32 = 0.07;
const RIPPLE_PX: f32 = 4.0; // déplacement max des termes lisses (vignette, cadre, vitre), px de l’appareil
const RIPPLE_SCAN_PX: f32 = 1.2; // déplacement max des termes haute fréquence (lignes de balayage, masque, grain) : < la moitié de la période de 3 px

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

// Distance signée à une boîte arrondie (demi-taille b, rayon r).
fn sd_round(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Superposition à alpha prémultiplié. Sans risque pour la luminosité (WCAG 2.3.1) : toute la force vient d’éléments
// STATIQUES/spatiaux (lignes de balayage, masque de phosphore, cadre, vignette, vitre, franges) ; le seul terme temporel
// global est un scintillement ≤ ~3,5 % à ≤ 1,5 Hz, conditionné par params.motion (0 = mouvement réduit = tout statique).
@fragment fn fs_main(@location(0) uvIn: vec2f) -> @location(0) vec4f {
  let p = params.paranoia;
  let t = params.time * params.motion;
  let size = vec2f(params.width, params.height);
  let m0 = min(params.width, params.height);
  // Ondulation d’un coup (SPATIAL SEULEMENT, aucun terme de luminance) : un anneau en expansion pousse radialement les
  // coordonnées du motif de quelques pixels de l’appareil, avec amortissement. À garder synchronisé avec rippleDisplacement dans crtMath.ts.
  let rv = (uvIn - vec2f(0.5)) * size / m0;
  let rr0 = length(rv);
  let rd = rr0 - RIPPLE_SPEED * params.rippleAge;
  let rin = smoothstep(0.0, 0.08, params.rippleAge);
  let rdec = pow(max(1.0 - params.rippleAge / RIPPLE_DUR, 0.0), 2.0);
  let rdisp = RIPPLE_PX * clamp(params.rippleAmp, 0.0, 1.0) * rin * rdec * exp(-(rd * rd) / (RIPPLE_W * RIPPLE_W)) * params.motion;
  let uv = uvIn + (rv / max(rr0, 1e-4)) * rdisp / size;
  let px = (uvIn + (rv / max(rr0, 1e-4)) * (rdisp * RIPPLE_SCAN_PX / RIPPLE_PX) / size) * size; // pixels de l’appareil, chemin lignes de balayage/masque
  let aspect = params.width / params.height;

  // Lignes de balayage : période exacte de 3 pixels de l’appareil (entier => pas de moiré à 1x/1,5x/2x DPR), une rangée
  // sombre sur trois, avec une lente modulation statique de l’épaisseur sur la hauteur de l’écran.
  let row = floor(px.y);
  let prof = 0.5 - 0.5 * cos(TAU * (row + 0.5) / 3.0);
  let thick = 0.85 + 0.15 * sin(uv.y * 23.0);
  var dark = (0.26 + 0.14 * p) * prof * thick + 0.03;

  // Vignette de vitre bombée + cadre arrondi (SDF de boîte arrondie en unités respectant le rapport, y dans [-0,5, 0,5]).
  // Correctif téléphone/portrait : sur un écran étroit, l’ancien cadre/frange (lié à la HAUTEUR : ~250 px d’assombrissement
  // sur un téléphone de 390 px) avalait le texte près des côtés. `land` = 0 portrait .. 1 paysage : le paysage garde
  // l’ancien rendu, le portrait utilise des bandes mesurées depuis le côté le PLUS COURT (m) pour qu’elles restent de quelques px.
  let land = smoothstep(0.7, 1.4, aspect);
  let m = min(params.width, params.height);
  let half = vec2f(params.width, params.height) / (2.0 * m);
  let cn = (uv - vec2f(0.5)) * vec2f(params.width, params.height) / m;
  let rr = 0.05 + 0.02 * p;
  let sd_new = sd_round(cn, half, rr);
  let c = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);
  let sd = sd_round(c, vec2f(0.5 * aspect, 0.5), rr);
  let bezel = mix(smoothstep(-0.05, 0.0, sd_new), smoothstep(-0.30, 0.0, sd), land);
  // Lunette atténuée en bas au centre : le bouton principal (« Fermer la porte », « Réveillez-vous ») y reste lisible à tous les niveaux.
  let bz = bezel * (1.0 - 0.7 * smoothstep(0.30, 0.15, abs(uv.x - 0.5)) * smoothstep(0.55, 0.8, uv.y));
  dark = dark + bz * (0.38 + 0.22 * p);
  let c2 = uv - vec2f(0.5);
  let vig = mix(smoothstep(0.16 - 0.04 * p, 0.55, dot(c2, c2)), smoothstep(0.10 - 0.05 * p, 0.55, dot(c2, c2)), land);
  dark = dark + vig * (0.30 + 0.20 * p);

  // Scintillement : deux sinus lents, indépendants de la paranoïa, amplitude totale ≤ ~3,5 % de l’alpha.
  let flick = 0.012 * sin(t * 37.0 * W) + 0.008 * sin(t * 150.0 * W);
  dark = dark + flick * params.motion;

  // Grain : de moyenne nulle, fin, nouvelle graine à 30 Hz.
  let n = hash(floor(px * 0.5) + vec2f(fract(floor(t * 30.0) * 0.6180339) * 91.0, floor(t * 30.0) % 7.0));
  dark = dark + (n - 0.5) * (0.04 + 0.06 * p);

  // Bande douce qui défile lentement : 0,07 Hz, bords larges et doux, faible contraste.
  let band = fract(t * 0.07);
  dark = dark + smoothstep(0.18, 0.0, abs(uv.y - band)) * 0.12 * p * params.motion;

  // Fine ligne de suivi : se déplace (et ondule à ~3 Hz en position), ne change jamais la luminosité globale. Apparaît
  // pendant ~1 fenêtre toutes les ~9 s ; très petite surface, faible contraste.
  let gate = smoothstep(0.55, 0.9, sin(t * 11.0 * W)) * params.motion;
  let ly = fract(t * 0.09 + 0.012 * sin(t * 300.0 * W));
  let line = smoothstep(0.004, 0.0, abs(uv.y - ly)) * gate * (0.2 + 0.3 * p);
  dark = dark + line * 0.35;
  let linelight = line * 0.12;

  // Masque de phosphore / grille d’ouverture : bandes verticales R, V, B, 1 pixel de l’appareil chacune (période de 3 px, entière).
  let k = u32(floor(px.x)) % 3u;
  let stripe = vec3f(select(0.0, 1.0, k == 0u), select(0.0, 1.0, k == 1u), select(0.0, 1.0, k == 2u));
  var col = stripe * (0.035 + 0.035 * p);

  // Franges chromatiques douces sur les bords (rouge à gauche, cyan/bleu à droite).
  // Portrait : confinées aux ~4-6 % extrêmes du côté court (le texte reste net) ; paysage : ancien rendu.
  let ex = abs(c2.x);
  let edge_new = smoothstep(0.04 + 0.02 * p, 0.0, half.x - abs(cn.x));
  let edge_old = smoothstep(0.20 - 0.08 * p, 0.5, ex);
  let edge = mix(edge_new, edge_old, land) * (0.14 + 0.26 * p);
  col = col + vec3f(select(0.0, 1.0, c2.x < 0.0) * edge * 0.6, 0.0, select(0.0, 1.0, c2.x >= 0.0) * edge * 0.6);

  // Halo de phosphore façon « bloom » : faible teinte vert-cyan, plus forte au milieu de l’écran.
  col = col + vec3f(0.0, 0.035, 0.03) * (1.0 - smoothstep(0.0, 0.4, dot(c2, c2)));

  // Reflet sur la vitre : doux éclat blanc près du coin supérieur gauche (statique).
  let g = (uv - vec2f(0.16, 0.14)) * vec2f(1.0, aspect * 1.6);
  col = col + vec3f(0.07) * (1.0 - smoothstep(0.0, 0.22, length(g))) + vec3f(linelight);

  var a = clamp(dark, 0.0, 0.9);
  // Hors du cadre arrondi : coins noirs opaques.
  let outside = smoothstep(-0.004, 0.004, sd);
  a = mix(a, 1.0, outside);
  col = col * (1.0 - outside);
  return vec4f(col, min(a + edge * 0.3, 1.0));
}
