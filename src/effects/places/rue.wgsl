import { ld_scatter, ld_motes, ld_haze } from "./lightDust.wgsl";

struct Params {
  time: f32, // horloge des fenêtres (figée si mouvement réduit)
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, adouci côté CPU
  sway: f32,
  swayY: f32,
  drift: f32, // horloge des précipitations (0 si mouvement réduit)
  px: f32,
  py: f32,
  weather: f32, // variante : 0 dégagé, 1 pluie légère (rue mouillée), 2 feuilles mortes (dégagé, rafales d’automne)
  cold: f32, // variante : proportion de fenêtres à lumière froide 0..1
  shadows: f32, // 1 = ombre de la voiture portée par le lampadaire (0 : tactile, écran étroit ou budget GPU dépassé)
}
@group(0) @binding(0) var<uniform> params: Params;

// Scène : une étroite rue de village la nuit, caméra au milieu de la chaussée, regardant vers le fond.
// Deux façades (plans x = ±W) avec toits en pente et lucarnes, escaliers extérieurs, un lampadaire et une voiture garée.
// Les fenêtres s’allument une à une (à 2 s d’intervalle, fondu de 1,5 s) : le voisinage observe. Aucun terme global de luminance.

const W: f32 = 3.4;
const EYE: f32 = 1.6;
const CELL: f32 = 6.0;
const ROOFK: f32 = 0.85;
const ROOFW: f32 = 3.2;
const FAR: f32 = 130.0;
const LAMP: vec3f = vec3f(-2.4, 4.3, 9.0);
const MOON: vec3f = vec3f(0.0875, 0.479, 0.873);
// Lumière du lampadaire : sodium (orange profond), pour qu’elle tranche sur le bleu de la nuit.
const SODIUM: vec3f = vec3f(1.0, 0.58, 0.22);
var<private> PIX: f32;

fn h11(x: f32) -> f32 { return fract(sin(x * 127.1) * 43758.5453); }
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn h31(p: vec3f) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
fn h33(p: vec3f) -> vec3f {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(h31(i), h31(i + vec3f(1, 0, 0)), u.x), mix(h31(i + vec3f(0, 1, 0)), h31(i + vec3f(1, 1, 0)), u.x), u.y);
  let b = mix(mix(h31(i + vec3f(0, 0, 1)), h31(i + vec3f(1, 0, 1)), u.x), mix(h31(i + vec3f(0, 1, 1)), h31(i + vec3f(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
fn is_rain() -> f32 { return select(0.0, 1.0, abs(params.weather - 1.0) < 0.5); }
fn band(d: f32, w: f32, pw: f32) -> f32 { return 1.0 - smoothstep(w - pw, w + pw, abs(d)); }

fn house_h(side: f32, cell: f32) -> f32 { return 6.1 + 1.5 * h21(vec2f(cell * 1.7 + side, side * 5.3 + 2.0)); }

// État d’une fenêtre : rgb = couleur émise (déjà mise à l’échelle), a = allumée 0..1.
// 5 emplacements par maison (2 étages x 2 colonnes + lucarne), 12 maisons par côté : 120 fenêtres, rangs permutés mod 127,
// chacune réveillée 2 s après la précédente, allumée 100 s, fondu d’entrée de 1,5 s, fondu de sortie de 3 s.
fn win_state(side: f32, cell: f32, slot: f32) -> vec4f {
  let cm = cell - 12.0 * floor(cell / 12.0);
  let n = (select(0.0, 1.0, side > 0.0) * 12.0 + cm) * 5.0 + slot;
  let m = n * 37.0;
  let rank = m - 127.0 * floor(m / 127.0);
  let x = params.time + 40.0 - rank * 2.0;
  let ph = x - 254.0 * floor(x / 254.0);
  let lit = smoothstep(0.0, 1.5, ph) * (1.0 - smoothstep(100.0, 103.0, ph));
  let key = vec2f(n, side + 7.0);
  let occ = step(h21(key), 0.85);
  let p = params.paranoia;
  let hc = h21(key + 3.3);
  let isCold = smoothstep(hc - 0.06, hc + 0.06, clamp(params.cold + 0.3 * p, 0.0, 1.0));
  let col = mix(vec3f(1.0, 0.60, 0.26) * 1.7, vec3f(0.50, 0.72, 1.0) * 1.35, isCold);
  return vec4f(col, lit * occ);
}

// La présence de la silhouette croît en douceur avec la paranoïa (pas de saut pendant l’adoucissement).
fn sil_gate(h: f32) -> f32 {
  let thr = smoothstep(0.35, 0.9, params.paranoia) * 0.6;
  return smoothstep(h - 0.06, h + 0.06, thr) * smoothstep(0.0, 0.05, thr);
}

// Visage de citrouille sculptée (u vers la droite, v vers le haut, ~[-1,1]) : yeux triangulaires, nez, bouche dentée. Même dessin que la forêt.
fn jack_face(u: f32, v: f32) -> f32 {
  let ex = abs(u) - 0.40;
  let ey = v - 0.22;
  let eye = step(abs(ex), (0.20 - ey) * 0.75) * step(-0.12, ey) * step(ey, 0.20);
  let nose = step(abs(u), -(v + 0.02) * 0.9) * step(-0.12, v) * step(v, 0.0);
  let mw = 0.66 - abs(v + 0.36) * 1.5;
  var mouth = step(abs(u), mw) * step(abs(v + 0.36), 0.2);
  let teeth = step(0.72, fract(u * 2.4 + 0.5)) * step(v, -0.28);
  mouth *= 1.0 - teeth;
  return clamp(eye + nose + mouth, 0.0, 1.0);
}

// Distance à une capsule 2D (a→b, rayon r) : doigts de la main sur le rideau.
fn cap2(p: vec2f, a: vec2f, b: vec2f, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}

// Intérieur d’une fenêtre en coordonnées locales `lp` (mètres, ~[-0.5, 0.5] x [-0.7, 0.7]) ; `ws` = état de la fenêtre (lumière émise, allumée),
// `hs` = graine propre à la fenêtre, `gate` = présence d’une silhouette (croît avec la paranoïa), `base` = verre éteint. Quatre sortes selon la graine :
// citrouille sculptée allumée sur le rebord (toujours là), rideau tiré, rideau à demi tiré, et rideau à demi tiré avec une silhouette qui épie de biais
// (tête coupée par le bord du rideau, main sur le tissu, contre-jour). Côté du rideau, largeur, plis et teinte du tissu varient d’une fenêtre à l’autre.
// Tout bouge très lentement (≤ 0,5 Hz) : la lumière ne clignote pas.
fn win_interior(lp: vec2f, pw: f32, ws: vec4f, hs: f32, gate: f32, base: vec3f) -> vec3f {
  let T = params.drift;
  let hh = h33(vec3f(hs, 1.7, 4.2));
  let h2 = h33(vec3f(hs, 8.3, 2.9));
  let aa = pw * 1.4;
  var col = base;
  if (hh.x < 0.10) {
    // Citrouille allumée sur le rebord : respiration de ~0,3 Hz, ±7 %.
    let breath = 1.0 + 0.07 * sin(T * 1.9 + hs * 5.0);
    let c = vec2f((hh.y - 0.5) * 0.3, -0.43);
    let q = (lp - c) / vec2f(0.25, 0.21);
    let body = 1.0 - smoothstep(1.0 - aa / 0.21, 1.0, length(q));
    let m = jack_face(q.x * 1.15, q.y * 1.1);
    col += vec3f(1.0, 0.5, 0.12) * 0.22 * breath * exp(-length((lp - c) * vec2f(1.0, 1.3)) * 3.2);
    var pk = vec3f(0.11, 0.04, 0.01) * (0.8 + 0.2 * cos(atan2(q.x, 0.6) * 5.0)) + vec3f(1.0, 0.5, 0.12) * 0.22 * breath * (1.0 - 0.5 * length(q));
    pk = mix(pk, vec3f(1.0, 0.58, 0.16) * 1.7 * breath, m);
    col = mix(col, pk, body);
    return col;
  }
  let a = ws.a;
  let lit = ws.rgb * a * (0.9 - 0.2 * length(lp));
  col += lit;
  if (hh.x < 0.32) { return col; } // fenêtre allumée, sans rideau
  let sgn = select(-1.0, 1.0, hh.y > 0.5);
  let x = lp.x * sgn; // x < bord = côté du rideau
  let closed = hh.x < 0.50;
  let spy = hh.x > 0.76;
  let sway = 0.018 * sin(T * 0.3 + hs * 3.0) + 0.012 * sin(T * 0.17 + hs);
  let ec = select(mix(-0.10, 0.22, h2.x) + sway, 0.62 + 0.3 * sway, closed);
  let edge = ec + 0.09 * sin(lp.y * 2.4 + hs * 2.0);
  // Silhouette qui épie : derrière le rideau (le tissu la coupe), penchée vers le jour.
  if (spy && !closed) {
    let lean = (h2.y - 0.5) * 0.24;
    let hx = ec + 0.04 + lean * 0.4;
    let hy = 0.03 + 0.08 * h2.z;
    let hq = vec2f((x - hx) / 0.105, (lp.y - hy) / 0.125);
    let head = 1.0 - smoothstep(1.0 - aa / 0.11, 1.0, length(hq));
    let neck = (1.0 - smoothstep(0.07 - aa, 0.07 + aa, abs(x - hx - lean * 0.2))) * step(lp.y, hy) * step(hy - 0.3, lp.y);
    let sq = vec2f((x - hx - 0.16 - lean * 0.6) / 0.30, (lp.y + 0.50 - 0.08 * h2.z) / 0.36);
    let sho = 1.0 - smoothstep(0.9, 1.0, length(sq));
    let fig = max(max(head, neck), sho) * gate;
    col = mix(col, vec3f(0.006, 0.006, 0.01) + base * 0.5, 0.96 * fig);
  }
  // Rideau : tissu à plis, éclairé à travers par la lumière de la pièce (très sombre si la pièce est éteinte).
  let cov = 1.0 - smoothstep(-aa, aa, x - edge);
  let folds = 0.5 + 0.5 * sin(x * (24.0 + 10.0 * h2.z) + hs * 5.0 + 0.5 * sin(T * 0.26 + hs));
  let tint = mix(vec3f(1.0, 0.80, 0.55), mix(vec3f(0.95, 0.55, 0.40), vec3f(0.75, 0.85, 0.65), step(0.5, h2.y)), step(0.5, h2.z));
  let hem = smoothstep(edge - 0.07, edge, x); // bord du tissu plus épais, plus sombre
  var fab = base * 0.8 + ws.rgb * a * tint * (0.22 + 0.34 * folds) * (1.0 - 0.45 * hem) * (0.85 - 0.15 * length(lp));
  fab *= 1.0 - 0.5 * smoothstep(0.55, 0.7, lp.y); // tringle
  col = mix(col, fab, cov);
  // Main sur le tissu (sombre, à contre-jour), seulement avec la silhouette.
  if (spy && !closed) {
    let hp = vec2f(edge - 0.01, -0.12 + 0.06 * h2.z) ;
    let q = vec2f((x - hp.x) * 1.0, lp.y - hp.y);
    var d = length(q * vec2f(1.0, 0.8)) - 0.045;
    d = min(d, cap2(q, vec2f(0.0, 0.03), vec2f(-0.035, 0.115), 0.013));
    d = min(d, cap2(q, vec2f(0.015, 0.035), vec2f(0.0, 0.13), 0.013));
    d = min(d, cap2(q, vec2f(0.035, 0.03), vec2f(0.045, 0.115), 0.012));
    let hand = (1.0 - smoothstep(-aa, aa, d)) * gate;
    col = mix(col, vec3f(0.01, 0.008, 0.008), 0.92 * hand);
  }
  return col;
}

// --- Citrouilles sculptées au pied des murs : ellipsoïdes (0,40 x 0,35 x 0,40 m) analytiques, visage tourné vers la caméra, lueur de bougie
// qui respire (~0,3 Hz, ±8 %) ; jamais de clignotement. xyz = centre, w = échelle.
fn pk_at(i: i32) -> vec4f {
  return select(select(vec4f(-2.85, 0.35, 4.6, 1.0), vec4f(-2.2, 0.245, 5.6, 0.7), i == 1), vec4f(2.7, 0.33, 7.6, 0.95), i == 2);
}
fn pk_breath(i: i32) -> f32 { return 1.0 + 0.08 * sin(params.drift * 2.0 + f32(i) * 2.1); }
// Lueur des citrouilles sur les surfaces proches (mur, chaussée) au point P.
fn pk_glow(P: vec3f) -> vec3f {
  var l = 0.0;
  for (var i = 0; i < 3; i++) {
    let c = pk_at(i);
    let d = P - c.xyz;
    l += c.w * pk_breath(i) / (1.0 + 9.0 * dot(d, d));
  }
  return vec3f(1.0, 0.45, 0.10) * l;
}

fn wall_col(s: f32, P: vec3f, pw: f32) -> vec3f {
  let cell = floor(P.z / CELL);
  let zl = P.z - cell * CELL;
  let y = P.y;
  let hh = h21(vec2f(cell, s + 11.0));
  let tone = 0.75 + 0.5 * h21(vec2f(cell, s + 31.0));
  var alb = mix(vec3f(0.30, 0.14, 0.10), vec3f(0.22, 0.23, 0.27), step(0.5, hh)) * tone;
  alb = mix(alb, vec3f(0.17, 0.22, 0.21) * tone, step(0.82, hh));
  alb *= 0.85 + 0.3 * vnoise(vec3f(zl * 3.0, y * 6.0, hh * 10.0));
  alb *= 1.0 - 0.14 * clamp(1.0 - pw * 22.0, 0.0, 1.0) * smoothstep(0.35, 0.5, abs(fract(y / 0.15) - 0.5));
  // Lumière : ambiante + lampadaire.
  let amb = mix(vec3f(0.06, 0.075, 0.135), vec3f(0.045, 0.05, 0.075), is_rain());
  let n = vec3f(-s, 0.0, 0.0);
  let L = LAMP - P;
  let d2 = dot(L, L);
  let lamp = SODIUM * 15.0 / (4.0 + d2) * max(dot(n, L) * inverseSqrt(d2), 0.0);
  var col = alb * (amb + lamp + pk_glow(P) * 1.6);

  // Fenêtres / porte
  let f = select(0.0, 1.0, y > 3.1);
  let c = select(0.0, 1.0, zl > 3.0);
  let cx = 1.5 + 2.8 * c;
  let cy = 1.75 + 2.8 * f;
  let st = h21(vec2f(cell, s + 23.0)) > 0.55;
  let wu = zl - cx;
  let wv = y - cy;
  if (st && f > 0.5 && c > 0.5) {
    let door = band(zl - 3.9, 0.55, pw) * band(y - 4.3, 1.0, pw);
    col = mix(col, vec3f(0.012, 0.010, 0.010) + vec3f(1.0, 0.6, 0.3) * 0.04 * band(zl - 3.9, 0.12, pw), door);
  } else {
    let ws = win_state(s, cell, f * 2.0 + c);
    let ins = (1.0 - smoothstep(0.5 - pw, 0.5, abs(wu))) * (1.0 - smoothstep(0.7 - pw, 0.7, abs(wv)));
    let lp = vec2f(wu, wv);
    var glass = win_interior(lp, pw, ws, cell * 7.7 + (f * 2.0 + c) * 3.1 + s * 1.3, sil_gate(h21(vec2f(cell * 3.1, f * 2.0 + c + s))), vec3f(0.012, 0.020, 0.040) + amb * 0.5);
    let mull = max(band(wu, 0.03, pw), band(wv, 0.03, pw));
    let frame = max(step(0.44, abs(wu)), step(0.64, abs(wv)));
    let fcol = alb * 0.7 + amb * 0.5 + ws.rgb * ws.a * 0.05;
    glass = mix(glass, fcol, max(mull, frame) * 0.85);
    col += ws.rgb * ws.a * 0.11 * exp(-length(vec2f(wu, wv * 0.7)) * 1.6) * (1.0 - ins);
    col = mix(col, glass, ins);
  }

  // Escalier extérieur (ferronnerie sombre) + palier devant la porte
  if (st) {
    let sy = 0.25 + (zl - 0.3) * (3.1 / 2.7);
    var iron = 0.0;
    if (zl > 0.3 && zl < 3.0) {
      iron = max(band(y - sy, 0.06, pw), band(y - sy - 0.95, 0.025, pw));
      let sp = band(fract(zl / 0.27) - 0.5, 0.05, pw / 0.27) * step(sy, y) * step(y, sy + 0.95);
      iron = max(iron, sp * 0.9);
    }
    if (zl >= 3.0 && zl < 4.6) {
      iron = max(band(y - 3.2, 0.06, pw), band(y - 4.1, 0.025, pw) * step(zl, 4.5));
      iron = max(iron, band(fract(zl / 0.27) - 0.5, 0.05, pw / 0.27) * step(3.2, y) * step(y, 4.1) * 0.9);
    }
    col = mix(col, vec3f(0.010, 0.009, 0.010) + lamp * 0.03, iron);
  }
  return col;
}

fn sky(rd: vec3f) -> vec3f {
  let up = clamp(rd.y, 0.0, 1.0);
  let isClear = 1.0 - is_rain();
  let hor = mix(vec3f(0.14, 0.17, 0.30), vec3f(0.17, 0.13, 0.15), is_rain());
  let top = mix(vec3f(0.010, 0.018, 0.055), vec3f(0.05, 0.055, 0.08), is_rain());
  var c = mix(hor, top, pow(up, 0.5));
  c = mix(c, vec3f(0.18, 0.04, 0.05), params.paranoia * 0.4 * (1.0 - up));
  if (isClear > 0.5) {
    let cm = dot(rd, MOON);
    let ang = acos(clamp(cm, -1.0, 1.0));
    let mc = mix(vec3f(0.90, 0.94, 1.0), vec3f(1.0, 0.55, 0.45), params.paranoia * 0.6);
    c += mc * (0.12 * exp(-ang * 7.0) + 0.35 * exp(-ang * 22.0));
    let disc = 1.0 - smoothstep(0.063, 0.069, ang);
    let ex = normalize(cross(MOON, vec3f(0, 1, 0)));
    let ey = cross(ex, MOON);
    let mp = vec2f(dot(rd, ex), dot(rd, ey)) / 0.07;
    c = mix(c, mc * (0.74 + 0.22 * vnoise(vec3f(mp * 2.3, 1.7))) * 1.2, disc);
    let a = atan2(rd.x, rd.z);
    let sp = vec2f(a, asin(clamp(rd.y, -1.0, 1.0))) * 90.0;
    let cell = floor(sp);
    let fp = fract(sp) - 0.5;
    let star = step(0.96, h21(cell)) * smoothstep(0.17, 0.0, length(fp));
    c += vec3f(0.8, 0.85, 1.0) * star * (0.3 + 0.6 * h21(cell + 1.3)) * smoothstep(0.05, 0.4, up) * (1.0 - disc);
  }
  return c;
}

fn glow_lamp(ro: vec3f, rd: vec3f) -> vec3f {
  let L = LAMP - ro;
  let a = 1.0 - dot(rd, normalize(L));
  return SODIUM * (1.1 * exp(-a * 300.0) + 0.30 * exp(-a * 30.0) + 0.07 * exp(-a * 8.0));
}

// Façades, toits et ciel. Retourne (couleur, distance) ; ni sol ni accessoires.
fn env(ro: vec3f, rd: vec3f) -> vec4f {
  let s = select(-1.0, 1.0, rd.x >= 0.0);
  let adx = max(abs(rd.x), 0.0001);
  let tw = (W - s * ro.x) / adx;
  let zw = ro.z + rd.z * tw;
  let yw = ro.y + rd.y * tw;
  let hw = house_h(s, floor(zw / CELL));
  if (tw < FAR && yw <= hw) {
    return vec4f(wall_col(s, vec3f(s * W, yw, zw), tw * PIX), tw);
  }
  // Toit en pente : y = H + (s*x - W) * K pour s*x - W dans [0, ROOFW] ; H pris dans la cellule où le rayon atterrit.
  let denom = rd.y - ROOFK * s * rd.x;
  if (abs(denom) > 0.0001 && tw < FAR) {
    let k0 = ROOFK * s * ro.x - ROOFK * W - ro.y;
    let t1 = (hw + k0) / denom;
    let h2 = house_h(s, floor((ro.z + rd.z * t1) / CELL));
    let t2 = (h2 + k0) / denom;
    let u = s * (ro.x + rd.x * t2) - W;
    if (t2 >= tw * 0.98 && u >= 0.0 && u <= ROOFW && t2 < FAR) {
      let P = ro + rd * t2;
      let cell = floor(P.z / CELL);
      let zl = P.z - cell * CELL;
      let pw = t2 * PIX;
      let nrm = normalize(vec3f(-s * ROOFK, 1.0, 0.0));
      var col = vec3f(0.020, 0.026, 0.040) * (0.7 + 0.6 * vnoise(vec3f(P.z * 2.0, u * 8.0, 2.0)));
      let L = LAMP - P;
      let d2 = dot(L, L);
      col *= 1.0 + 12.0 / (4.0 + d2) * max(dot(nrm, L) * inverseSqrt(d2), 0.0);
      col += vec3f(0.05, 0.07, 0.11) * (1.0 - is_rain()) * max(dot(nrm, MOON), 0.0);
      col += vec3f(0.01, 0.012, 0.02);
      // Décalque de lucarne.
      let hasD = step(h21(vec2f(cell + 5.0, s + 41.0)), 0.55);
      let dx = zl - 3.0;
      let dv = u - 1.05;
      let inD = (1.0 - smoothstep(0.7 - pw, 0.7, abs(dx))) * (1.0 - smoothstep(0.55 - pw, 0.55, abs(dv))) * hasD;
      if (inD > 0.0) {
        let ws = win_state(s, cell, 4.0);
        let lp = vec2f(dx, dv * 1.4);
        var g = win_interior(lp * 0.72, pw * 0.72, ws, cell * 5.3 + s * 2.9 + 40.0, sil_gate(h21(vec2f(cell * 3.1, 9.0 + s))), vec3f(0.010, 0.016, 0.03));
        let fr = max(step(0.55, abs(dx)), step(0.4, abs(dv))) * 0.8;
        g = mix(g, vec3f(0.03, 0.03, 0.04), fr);
        col = mix(col, g, inD);
      }
      return vec4f(col, t2);
    }
  }
  return vec4f(sky(rd), 1000.0);
}

fn fog_col() -> vec3f {
  return mix(vec3f(0.07, 0.09, 0.17), vec3f(0.08, 0.075, 0.095), is_rain());
}

fn sd_box(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Distance à la voiture garée (les deux boîtes de `box_hit` : caisse et habitacle, mêmes dimensions).
fn car_sd(p: vec3f) -> f32 {
  return min(sd_box(p - vec3f(1.95, 0.55, 15.4), vec3f(0.95, 0.30, 2.4)), sd_box(p - vec3f(1.95, 1.125, 15.4), vec3f(0.85, 0.275, 1.2)));
}

// Ombre douce de la voiture sur la chaussée : marche de sphère (24 pas au plus) du point du sol vers le lampadaire ; res = min(k·h / t), la pénombre
// s’élargit avec la distance parcourue. Départ décalé de 0,08 m hors du sol contre l’acné d’ombre, sortie anticipée dès que le rayon est
// franchement dans l’ombre ou a passé la lampe. Sans bruit ni temps : l’ombre est fixe. 1 = éclairé, 0 = à l’ombre.
fn lamp_shadow(g: vec3f) -> f32 {
  if (g.z < 12.5) { return 1.0; } // la voiture est plus loin que la lampe (z = 9) : un point en deçà ne peut pas être masqué
  let L = LAMP - g;
  let dist = length(L);
  let ld = L / dist;
  var res = 1.0;
  var t = 0.08;
  for (var i = 0; i < 24; i++) {
    let h = car_sd(g + ld * t);
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.05, 0.9);
    if (res < 0.01 || t > dist) { break; }
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

fn box_hit(ro: vec3f, rd: vec3f, lo: vec3f, hi: vec3f) -> vec4f {
  let inv = 1.0 / (rd + vec3f(0.00001));
  let a = (lo - ro) * inv;
  let b = (hi - ro) * inv;
  let mn = min(a, b);
  let mx = max(a, b);
  let tn = max(mn.x, max(mn.y, mn.z));
  let tf = min(mx.x, min(mx.y, mx.z));
  if (tf < max(tn, 0.0)) { return vec4f(1e9, 0, 0, 0); }
  var n = vec3f(0.0);
  if (tn == mn.x) { n = vec3f(-sign(rd.x), 0, 0); } else if (tn == mn.y) { n = vec3f(0, -sign(rd.y), 0); } else { n = vec3f(0, 0, -sign(rd.z)); }
  return vec4f(tn, n);
}

// --- Feuilles mortes d’automne ---------------------------------------------------------------------------------------------------------
// Couverture 0..1 d’une feuille (forme de feuille d’érable simplifiée : ovale pointu aux deux bouts) en coordonnées locales `lp`
// (mètres, axe x = longueur), demi-longueur `len`, `aa` = largeur d’un pixel en mètres, `fs` = raccourci de la feuille qui se retourne.
fn leaf_cov(lp: vec2f, len: f32, aa: f32, fs: f32) -> f32 {
  let u = lp.x / len;
  let v = lp.y / (len * fs);
  let hw = 0.68 * pow(max(1.0 - u * u, 0.0), 0.75) * (0.8 - 0.3 * u);
  return (1.0 - smoothstep(-aa / len, aa / len, abs(v) - hw)) * step(abs(u), 1.0);
}

// Couleur d’une feuille (brun, rouille, orange, ocre) d’après un nombre au hasard h dans [0, 1).
fn leaf_albedo(h: f32) -> vec3f {
  let a = mix(vec3f(0.30, 0.15, 0.06), vec3f(0.60, 0.20, 0.05), smoothstep(0.0, 0.35, h));
  let b = mix(vec3f(0.60, 0.20, 0.05), vec3f(0.90, 0.46, 0.08), smoothstep(0.35, 0.7, h));
  return mix(mix(a, b, step(0.35, h)), vec3f(0.78, 0.55, 0.12), smoothstep(0.88, 0.94, h));
}

// Lumière reçue par une feuille au point P : ambiant de la nuit + lampadaire (sodium) ; `wet` assombrit sous la pluie.
fn leaf_light(P: vec3f) -> vec3f {
  let L = LAMP - P;
  return vec3f(0.10, 0.11, 0.17) + SODIUM * 15.0 / (4.0 + dot(L, L)) * 1.1;
}

// Une tranche de feuilles qui tombent : plan z = zs, grille de cellules de `cell` mètres emportée par le vent (vers la droite, vers le bas),
// chaque feuille décrit une spirale (rayon ≤ 0,14 cellule), tourne sur elle-même et se retourne lentement (≤ 0,5 Hz).
// Retourne (rgb, couverture) ; rien si un mur ou la voiture se trouve devant la tranche.
fn leaf_slice(ro: vec3f, rd: vec3f, zs: f32, tHit: f32, cell: f32, dens: f32, seed: f32, fogc: vec3f) -> vec4f {
  if (rd.z < 0.05) { return vec4f(0.0); }
  let td = (zs - ro.z) / rd.z;
  if (td > tHit) { return vec4f(0.0); }
  let P = ro + rd * td;
  let T = params.drift;
  let gust = 0.35 * sin(T * 0.21 + seed);
  let adv = vec2f(0.38 * T + 1.1 * gust, -0.5 * T);
  let q = (P.xy - adv) / cell;
  let c = floor(q);
  let f = fract(q);
  let key = vec3f(c, seed);
  let hh = h33(key);
  let h2 = h33(key + 17.0);
  if (hh.x > dens) { return vec4f(0.0); }
  let ph = T * (0.7 + 0.5 * hh.y) + hh.z * 6.2832;
  let ctr = vec2f(0.5) + 0.14 * vec2f(cos(ph), 0.7 * sin(ph)) + 0.08 * (h2.xy - 0.5);
  var lp = (f - ctr) * cell;
  let th = h2.z * 6.2832 + T * (h2.x - 0.5) * 2.4;
  let cs = cos(th);
  let sn = sin(th);
  lp = vec2f(lp.x * cs + lp.y * sn, -lp.x * sn + lp.y * cs);
  let fs = mix(0.3, 1.0, abs(cos(T * 0.9 * (0.4 + h2.y) + hh.z * 6.2832)));
  let len = cell * (0.16 + 0.04 * h2.x);
  let cov = leaf_cov(lp, len, td * PIX, fs);
  if (cov <= 0.0) { return vec4f(0.0); }
  var alb = leaf_albedo(h2.y);
  alb *= 1.0 - 0.35 * (1.0 - smoothstep(0.02, 0.09, abs(lp.y / (len * fs)))) * step(abs(lp.x / len), 0.95);
  var col = alb * leaf_light(P);
  col = mix(col, fogc, 1.0 - exp(-min(td, 100.0) * 0.034));
  return vec4f(col, cov * (1.0 - smoothstep(26.0, 40.0, td)));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let res = vec2f(params.width, params.height);
  let fc = vec2f(uv.x, 1.0 - uv.y) * res;
  let c2 = (fc * 2.0 - res) / min(res.x, res.y);
  PIX = 2.0 / (min(res.x, res.y) * 1.3);

  let land = smoothstep(0.7, 1.3, res.x / res.y);
  let yaw = params.sway + params.px * 0.07;
  let pitch = mix(0.06, 0.10, land) + params.swayY - params.py * 0.04;
  var rd = normalize(vec3f(c2.x, c2.y, 1.3));
  let cp = cos(pitch); let sp = sin(pitch);
  rd = vec3f(rd.x, rd.y * cp + rd.z * sp, rd.z * cp - rd.y * sp);
  let cy = cos(yaw); let sy = sin(yaw);
  rd = vec3f(rd.x * cy + rd.z * sy, rd.y, rd.z * cy - rd.x * sy);
  let ro = vec3f(params.px * 0.3, EYE + params.py * 0.08, 0.0);
  let isRain = is_rain();

  let e = env(ro, rd);
  var col = e.xyz;
  var t = e.w;
  let fogc = fog_col();

  // Sol
  var tg = 1e9;
  if (rd.y < -0.0001) { tg = -ro.y / rd.y; }
  if (tg < t) {
    let g = ro + rd * tg;
    t = tg;
    let side = smoothstep(2.3, 2.5, abs(g.x));
    let nz = vnoise(vec3f(g.xz * 0.9, 1.0)) * 0.6 + vnoise(vec3f(g.xz * 4.0, 5.0)) * 0.4;
    let alb = mix(vec3f(0.16, 0.17, 0.20), vec3f(0.24, 0.23, 0.24), side) * (0.6 + 0.8 * nz);
    let L = LAMP - g;
    let d2 = dot(L, L);
    var lampL = SODIUM * 15.0 / (4.0 + d2) * max(L.y * inverseSqrt(d2), 0.0);
    // Ombre de la voiture : multiplie la lumière de la lampe seulement ; l’ambiant (`amb`) reste intact, donc jamais de noir pur.
    if (params.shadows > 0.5) { lampL *= mix(0.15, 1.0, lamp_shadow(g)); }
    let amb = vec3f(0.06, 0.075, 0.135);
    col = alb * (amb * 1.6 + lampL * 1.6 + pk_glow(g) * 2.4);
    if (isRain > 0.5) {
      let wet = 0.55 + 0.45 * smoothstep(0.35, 0.6, vnoise(vec3f(g.xz * vec2f(0.5, 0.25), 9.0)));
      let rdr = vec3f(rd.x, -rd.y, rd.z);
      let rf = env(g, rdr);
      let rk = 1.0 - exp(-min(rf.w, 100.0) * 0.034);
      var refl = mix(rf.xyz, fogc, rk);
      refl += glow_lamp(g, rdr) * 0.8;
      let fres = 0.12 + 0.5 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 3.0);
      col = mix(col, refl, fres * wet * 1.4);
    }
  }

  // Accessoires : mât et tête du lampadaire, voiture garée.
  if (abs(rd.z) > 0.001) {
    let tm = (LAMP.z - ro.z) / rd.z;
    if (tm > 0.0 && tm < t) {
      let q = ro + rd * tm;
      let dx = q.x - LAMP.x;
      let mast = band(dx, 0.06, tm * PIX) * step(0.0, q.y) * step(q.y, 4.3);
      let head = band(dx, 0.20, tm * PIX) * step(4.28, q.y) * step(q.y, 4.52);
      if (head > 0.0) {
        col = mix(col, vec3f(1.0, 0.72, 0.36) * 1.6, head);
        t = tm;
      } else if (mast > 0.0) {
        col = mix(col, vec3f(0.01, 0.01, 0.012), mast);
        t = tm;
      }
    }
  }
  var car = box_hit(ro, rd, vec3f(1.0, 0.25, 13.0), vec3f(2.9, 0.85, 17.8));
  let car2 = box_hit(ro, rd, vec3f(1.1, 0.85, 14.2), vec3f(2.8, 1.4, 16.6));
  if (car2.x < car.x) { car = car2; }
  if (car.x < t) {
    let q = ro + rd * car.x;
    let n = car.yzw;
    let L = LAMP - q;
    let lit = max(dot(n, normalize(L)), 0.0) * 9.0 / (4.0 + dot(L, L));
    col = vec3f(0.014, 0.016, 0.022) + SODIUM * lit * 0.09 + vec3f(0.01, 0.015, 0.03) * max(n.y, 0.0);
    t = car.x;
  }

  // Citrouilles sculptées : corps éclairé de l’intérieur, visage émissif ; halo dans l’air au passage du rayon.
  var pkHalo = vec3f(0.0);
  for (var i = 0; i < 3; i++) {
    let pc = pk_at(i);
    let br = pk_breath(i);
    let oc = pc.xyz - ro;
    let al = dot(oc, rd);
    if (al > 0.5) {
      let dv = oc - rd * min(al, t);
      pkHalo += vec3f(1.0, 0.5, 0.12) * exp(-dot(dv, dv) * 3.0 / (pc.w * pc.w)) * br * pc.w / (1.0 + al * 0.12);
      if (dot(dv, dv) < 0.2 * pc.w * pc.w) {
        let rad = vec3f(0.40, 0.35, 0.40) * pc.w;
        let o = (ro - pc.xyz) / rad;
        let dd = rd / rad;
        let qa = dot(dd, dd);
        let qb = dot(o, dd);
        let disc = qb * qb - qa * (dot(o, o) - 1.0);
        if (disc > 0.0) {
          let th = (-qb - sqrt(disc)) / qa;
          if (th > 0.1 && th < t) {
            let q = (ro + rd * th - pc.xyz) / rad;
            let fdir = normalize(vec3f(-pc.x, 0.0, -pc.z));
            let right = vec3f(-fdir.z, 0.0, fdir.x);
            let fr = dot(q, fdir);
            let m = jack_face(dot(q, right) * 1.25, q.y * 1.15) * smoothstep(0.25, 0.55, fr);
            let rib = 0.75 + 0.25 * cos(atan2(q.x, q.z) * 9.0);
            let Ll = LAMP - (ro + rd * th);
            var body = vec3f(0.075, 0.026, 0.006) * rib * (1.0 + 4.0 * SODIUM.x * 9.0 / (4.0 + dot(Ll, Ll)));
            body += vec3f(1.0, 0.5, 0.12) * 0.10 * br * smoothstep(-0.2, 0.9, fr);
            col = mix(body, vec3f(1.0, 0.55, 0.14) * 1.5 * br, m);
            col = mix(col, vec3f(0.012, 0.016, 0.006), smoothstep(0.78, 0.95, q.y)); // tige
            t = th;
          }
        }
      }
    }
  }

  // Brume selon la distance, halo du lampadaire par-dessus.
  if (t < 900.0) { col = mix(col, fogc, 1.0 - exp(-min(t, 100.0) * 0.034)); }
  col += glow_lamp(ro, rd) + pkHalo * 0.18;

  // Lumière volumétrique : cône du lampadaire, poussière révélée par la lumière, brume lunaire (lightDust.wgsl).
  // Variation spatiale seulement avec la paranoïa ; respiration < 0,1 Hz et ±5 %.
  {
    let tv = min(t, 60.0);
    let pa = params.paranoia;
    let breath = 1.0 + 0.05 * sin(params.drift * 0.5);
    let warm = SODIUM;
    let fogK = (0.18 + 0.07 * pa) * breath;
    col += warm * ld_scatter(ro, rd, tv, LAMP, fogK);
    col += warm * ld_motes(ro, rd, tv, LAMP, params.drift, 0.95 + 0.05 * pa, PIX) * (3.2 + 1.2 * pa) * breath;
    let hz = ld_haze(ro, rd, tv, params.drift);
    col += vec3f(0.12, 0.17, 0.30) * hz * (0.10 + 0.07 * pa) * (0.6 + 0.4 * smoothstep(-0.3, 0.9, dot(rd, MOON)));
  }

  // Précipitations (espace écran, faible contraste ; figées si mouvement réduit)
  if (isRain > 0.5) {
    let cx = floor(fc.x / 2.0);
    let r = h11(cx);
    let yy = fract(fc.y * 0.012 / (0.6 + r) + params.drift * (0.5 + 0.6 * r) + r * 7.0);
    let streak = smoothstep(0.0, 0.5, yy) * (1.0 - smoothstep(0.5, 0.56, yy)) * step(0.82, h11(cx * 1.3 + 4.0));
    col += vec3f(0.30, 0.36, 0.5) * streak * 0.07;
  }

  // Feuilles mortes en l’air : trois tranches de profondeur (grandes devant, petites au fond), toutes sur le même vent. Absentes sous la pluie.
  {
    let lk = select(0.4, 1.0, params.weather > 1.5) * (1.0 - isRain);
    if (lk > 0.0) {
      for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let lf = leaf_slice(ro, rd, 3.5 + fi * fi * 2.1 + fi * 1.6, t, 1.1 - 0.12 * fi, (0.30 - 0.08 * fi) * lk, 3.0 + fi * 7.1, fogc);
        col = mix(col, lf.rgb, lf.a);
      }
    }
  }

  // Étalonnage : apaise le centre pour la porte/le texte, vignette, tramage.
  let cc = length(c2 * vec2f(0.8, 0.6));
  col *= mix(0.72, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.6);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
