// Lumière qui révèle la poussière (partagé entre les lieux).
//
// Câblage : import WGSL natif du chargeur @vgpu/wgsl (pas de concaténation : la source est préparée au build).
// Ce fichier n’a pas de point d’entrée ni de `params` ; chaque fonction exportée prend ses entrées en arguments.
// Dans le .wgsl d’un lieu, en tête de fichier :
//   import { ld_scatter, ld_motes, ld_haze } from "./lightDust.wgsl";
//
//   ld_cone(ro, rd, tmax, L, cosA)        diffusion analytique d’un point lumineux dans un brouillard homogène,
//                                          limitée à un cône dirigé vers le bas (aucune étape de marche supplémentaire)
//   ld_scatter(ro, rd, tmax, L, k)         cône adouci (3 ouvertures) : lampadaire
//   ld_motes(ro, rd, tmax, L, drift, dens) poussière en 4 tranches de profondeur, visible seulement dans la lumière
//   ld_haze(ro, rd, tmax, drift)           densité 0..1 d’une brume froide lente
// `drift` est l’horloge en secondes (0 en mouvement réduit : image figée).

fn ld_hash(p: vec3f) -> vec3f {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}

fn ld_noise(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(ld_hash(i).x, ld_hash(i + vec3f(1, 0, 0)).x, u.x), mix(ld_hash(i + vec3f(0, 1, 0)).x, ld_hash(i + vec3f(1, 1, 0)).x, u.x), u.y);
  let b = mix(mix(ld_hash(i + vec3f(0, 0, 1)).x, ld_hash(i + vec3f(1, 0, 1)).x, u.x), mix(ld_hash(i + vec3f(0, 1, 1)).x, ld_hash(i + vec3f(1, 1, 1)).x, u.x), u.y);
  return mix(a, b, u.z);
}

// ∫ dt / (h² + (t - a)²) sur [t0, t1] (forme close), 0 si l’intervalle est vide.
fn ld_seg(t0: f32, t1: f32, a: f32, h: f32) -> f32 {
  if (t1 <= t0) { return 0.0; }
  return (atan((t1 - a) / h) - atan((t0 - a) / h)) / h;
}

// Nappe inférieure d’un cône d’axe -Y, sommet L, demi-angle de cosinus cosA : intégrale de 1/d² le long du rayon.
export fn ld_cone(ro: vec3f, rd: vec3f, tmax: f32, L: vec3f, cosA: f32) -> f32 {
  let w = ro - L;
  var lo = 0.0;
  var hi = tmax;
  // Demi-espace sous le sommet.
  if (rd.y < -0.00001) { lo = max(lo, -w.y / rd.y); }
  else if (rd.y > 0.00001) { hi = min(hi, -w.y / rd.y); }
  else if (w.y >= 0.0) { return 0.0; }
  if (hi <= lo) { return 0.0; }
  let c = cosA * cosA;
  let ra = -rd.y;
  let wa = -w.y;
  var A = ra * ra - c;
  if (abs(A) < 0.0001) { A = 0.0001; }
  let B = 2.0 * (wa * ra - c * dot(w, rd));
  let C = wa * wa - c * dot(w, w);
  let a = -dot(w, rd);
  let h = sqrt(max(dot(w, w) - a * a, 0.09));
  let disc = B * B - 4.0 * A * C;
  if (disc < 0.0) {
    if (A > 0.0) { return ld_seg(lo, hi, a, h); }
    return 0.0;
  }
  let sq = sqrt(disc);
  let r1 = min((-B - sq) / (2.0 * A), (-B + sq) / (2.0 * A));
  let r2 = max((-B - sq) / (2.0 * A), (-B + sq) / (2.0 * A));
  if (A < 0.0) { return ld_seg(max(lo, r1), min(hi, r2), a, h); }
  return ld_seg(lo, min(hi, r1), a, h) + ld_seg(max(lo, r2), hi, a, h);
}

// Lampadaire : trois ouvertures superposées = bord de cône adouci. k = intensité.
export fn ld_scatter(ro: vec3f, rd: vec3f, tmax: f32, L: vec3f, k: f32) -> f32 {
  return k * (0.40 * ld_cone(ro, rd, tmax, L, 0.90) + 0.35 * ld_cone(ro, rd, tmax, L, 0.82) + 0.25 * ld_cone(ro, rd, tmax, L, 0.72));
}

// Éclairement d’un point P par le cône (sans la couleur).
export fn ld_light(P: vec3f, L: vec3f) -> f32 {
  let d = P - L;
  let d2 = dot(d, d);
  let cs = -d.y * inverseSqrt(max(d2, 0.0001));
  return smoothstep(0.68, 0.86, cs) * 14.0 / (3.0 + d2);
}

// Poussière : 4 tranches de profondeur, un grain par tranche et par pixel ; luminosité = lumière reçue au grain.
// Retourne une luminosité (à teinter côté lieu). Dérive lente : balancement + légère chute, jamais rapide.
export fn ld_motes(ro: vec3f, rd: vec3f, tmax: f32, L: vec3f, drift: f32, dens: f32, pix: f32) -> f32 {
  var acc = 0.0;
  for (var i = 0; i < 4; i++) {
    let s = 0.42 + 0.1 * f32(i);
    let tk = 4.5 + 2.6 * f32(i);
    if (tk >= tmax) { continue; }
    let P = ro + rd * tk;
    let off = vec3f(0.0, drift * 0.035 + f32(i) * 3.7, f32(i) * 11.0);
    let g = (P + off) / s;
    let cell = floor(g);
    let hh = ld_hash(cell + f32(i) * 17.0);
    if (hh.x > dens) { continue; }
    let ph = hh * 6.2832;
    let sway = vec3f(sin(drift * 0.23 + ph.x), sin(drift * 0.19 + ph.y) * 0.6, cos(drift * 0.21 + ph.z)) * 0.18;
    let m = (cell + 0.15 + 0.7 * ld_hash(cell + 5.1) + sway) * s - off;
    let tm = dot(m - ro, rd);
    if (tm < 0.5 || tm > tmax) { continue; }
    let dist = length(m - ro - rd * tm);
    let rad = max(tm * pix * 1.1, 0.012);
    let shape = 1.0 - smoothstep(rad * 0.4, rad, dist);
    let tw = 0.7 + 0.3 * sin(drift * 0.8 + ph.x * 3.0);
    acc += shape * ld_light(m, L) * tw * (0.5 + hh.y);
  }
  return acc;
}

// Brume froide : deux couches de bruit lent, plus épaisse au loin.
export fn ld_haze(ro: vec3f, rd: vec3f, tmax: f32, drift: f32) -> f32 {
  let t1 = min(tmax, 22.0);
  let t2 = min(tmax, 55.0);
  let p1 = ro + rd * t1 * 0.6;
  let p2 = ro + rd * t2 * 0.6;
  let n1 = ld_noise(vec3f(p1.x * 0.18 + drift * 0.012, p1.y * 0.3, p1.z * 0.12));
  let n2 = ld_noise(vec3f(p2.x * 0.1 - drift * 0.008, p2.y * 0.2, p2.z * 0.07 + 4.0));
  return clamp(0.6 * n1 * (1.0 - exp(-t1 * 0.06)) + 0.6 * n2 * (1.0 - exp(-t2 * 0.03)) - 0.15, 0.0, 1.0);
}
