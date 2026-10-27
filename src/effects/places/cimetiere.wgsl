struct Params {
  time: f32,
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, adouci côté CPU
  sway: f32, // balancement de la caméra (0 si mouvement réduit)
  swayY: f32,
  drift: f32, // horloge d’animation : brume roulante, bruine, clignements (0 si mouvement réduit)
  eyes: f32, // 0..1 présence d’yeux bas dans la brume
  px: f32, // parallaxe -1..1 (0 si mouvement réduit)
  py: f32,
  mist: f32, // variante : multiplicateur de densité de la brume
  moon: f32, // variante : multiplicateur de taille / luminosité de la lune
  rain: f32, // variante : 0..1 bruine
}
@group(0) @binding(0) var<uniform> params: Params;

// Scène : petit cimetière de village la nuit. Pierres tombales et croix sont des silhouettes analytiques sur 6 plans de profondeur,
// un mur de pierre surmonté d’une clôture en fer ferme le terrain (avec une ouverture pour le portail), toits du village loin derrière, brume basse qui roule, lune.
// Aucun terme de luminance piloté par le temps : la brume et la bruine bougent lentement, dans l’espace.

var<private> MOON_DIR: vec3f;
var<private> MOON_EX: vec3f;
var<private> MOON_EY: vec3f;
const EYE_Y: f32 = 1.45;
const WALL_Z: f32 = 20.0;

fn h11(x: f32) -> f32 { return fract(sin(x * 127.1) * 43758.5453); }
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn h31(p: vec3f) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(h31(i), h31(i + vec3f(1, 0, 0)), u.x), mix(h31(i + vec3f(0, 1, 0)), h31(i + vec3f(1, 1, 0)), u.x), u.y);
  let b = mix(mix(h31(i + vec3f(0, 0, 1)), h31(i + vec3f(1, 0, 1)), u.x), mix(h31(i + vec3f(0, 1, 1)), h31(i + vec3f(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
fn vn1(x: f32) -> f32 {
  let i = floor(x);
  let f = fract(x);
  return mix(h11(i), h11(i + 1.0), f * f * (3.0 - 2.0 * f));
}
fn sd_box2(p: vec2f, b: vec2f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}

// Monument funéraire en unités locales (base à y=0, x centré). kind : 0 pierre tombale arrondie, 1 dalle de travers, 2 croix de bois, 3 croix de fer.
fn marker(lp: vec2f, kind: i32, tilt: f32) -> f32 {
  let cs = cos(tilt);
  let sn = sin(tilt);
  let p = vec2f(lp.x * cs - lp.y * sn, lp.x * sn + lp.y * cs);
  if (kind == 0) {
    return min(sd_box2(p - vec2f(0.0, 0.36), vec2f(0.30, 0.36)), length(p - vec2f(0.0, 0.72)) - 0.30);
  }
  if (kind == 1) {
    var d = sd_box2(p - vec2f(0.0, 0.32), vec2f(0.38, 0.32));
    d = max(d, (p.x - 0.1 + (p.y - 0.4) * 0.8) * 0.8); // coin brisé
    return d;
  }
  if (kind == 2) {
    return min(sd_box2(p - vec2f(0.0, 0.5), vec2f(0.055, 0.5)), sd_box2(p - vec2f(0.0, 0.78), vec2f(0.28, 0.05)));
  }
  var d = min(sd_box2(p - vec2f(0.0, 0.6), vec2f(0.022, 0.6)), sd_box2(p - vec2f(0.0, 0.95), vec2f(0.2, 0.022)));
  d = min(d, abs(length(p - vec2f(0.0, 0.95)) - 0.09) - 0.014); // anneau
  d = min(d, length(p - vec2f(0.0, 1.24)) - 0.045); // fleuron
  d = min(d, length(p - vec2f(0.22, 0.95)) - 0.035);
  d = min(d, length(p - vec2f(-0.22, 0.95)) - 0.035);
  return d;
}

// Rangée de monuments sur le plan z = D : retourne vec2(couverture, kind) pour que l’appelant colore bois / pierre / fer.
fn row_mask(ro: vec3f, rd: vec3f, D: f32, seed: f32, aa: f32) -> vec2f {
  let X = ro.x + rd.x / rd.z * D;
  let Y = ro.y + rd.y / rd.z * D;
  if (Y < 0.0) { return vec2f(0.0); }
  let cw = 2.3 + 0.2 * seed;
  let ci0 = floor(X / cw);
  var m = 0.0;
  var kd = 0.0;
  for (var j = -1; j <= 1; j++) {
    let ci = ci0 + f32(j);
    let hh = h21(vec2f(ci, seed * 5.7));
    let cx = (ci + 0.2 + 0.6 * h21(vec2f(ci, seed * 2.1 + 3.0))) * cw;
    if (hh > 0.84 || abs(cx) < 1.1) { continue; }
    let kind = i32(floor(hh / 0.21));
    let sc = 0.85 + 0.45 * h21(vec2f(ci + 9.0, seed));
    let tilt = (h21(vec2f(ci, seed + 11.0)) - 0.5) * 0.45;
    let d = marker((vec2f(X - cx, Y) / sc), kind, tilt) * sc;
    let mm = smoothstep(aa, -aa, d);
    if (mm > m) { m = mm; kd = f32(kind); }
  }
  return vec2f(m, kd);
}

// Mur de pierre (Y<0,7) + clôture en fer au-dessus, avec une ouverture de portail au milieu. Retourne vec2(couverture, 0 pierre / 1 fer).
fn boundary(ro: vec3f, rd: vec3f, aa: f32) -> vec2f {
  let X = ro.x + rd.x / rd.z * WALL_Z;
  let Y = ro.y + rd.y / rd.z * WALL_Z;
  if (Y < 0.0) { return vec2f(0.0); }
  let ax = abs(X);
  var stone = step(1.5, ax) * step(Y, 0.7);
  stone = max(stone, step(abs(ax - 1.75), 0.2) * step(Y, 2.0)); // piliers du portail
  let bx = abs(fract(X / 0.28 + 0.5) - 0.5) * 0.28;
  let tip = 0.02 * clamp((1.72 - Y) / 0.2, 0.0, 1.0);
  var bars = step(bx, tip + aa) * step(0.7, Y) * step(Y, 1.72);
  bars = max(bars, step(abs(Y - 1.4), 0.03 + aa) + step(abs(Y - 0.82), 0.03 + aa));
  bars *= step(1.5, ax);
  let isStone = stone;
  return vec2f(clamp(max(isStone, bars), 0.0, 1.0), select(1.0, 0.0, isStone > 0.5));
}

// Toits du village (pignons raides, cheminées) en silhouette angulaire ; .y = fenêtre éclairée.
fn village(a: f32, e: f32) -> vec2f {
  let x = a * 26.0 + 3.0;
  let cell = floor(x);
  let f = fract(x);
  let wb = 0.03 + 0.03 * h11(cell * 1.3);
  let roofH = 0.025 + 0.03 * h11(cell * 2.9);
  let tri = 1.0 - abs(f * 2.0 - 1.0);
  var h = wb + roofH * tri * 1.6;
  if (h11(cell * 4.1) > 0.7 && abs(f - 0.72) < 0.05) { h += 0.02; } // cheminée
  let present = step(0.12, h11(cell * 7.7));
  let inside = step(e, h * present) * step(0.0, e);
  let win = step(0.72, h11(cell * 9.1)) * step(abs(f - 0.35), 0.06) * step(abs(e - wb * 0.5), 0.006);
  return vec2f(inside, win * inside);
}

fn treeline(a: f32) -> f32 {
  var h = 0.015 + 0.02 * vn1(a * 2.3 + 4.0);
  let x = a * 30.0;
  let cell = floor(x);
  let tri = 1.0 - abs(fract(x) * 2.0 - 1.0);
  h += (0.015 + 0.03 * h11(cell)) * pow(tri, 1.2);
  return h;
}

fn sky_col(rd: vec3f, p: f32, moonCol: vec3f, r: f32) -> vec3f {
  let up = clamp(rd.y, 0.0, 1.0);
  var c = mix(vec3f(0.21, 0.27, 0.39), vec3f(0.024, 0.036, 0.085), pow(up, 0.42));
  c = mix(c, vec3f(0.07, 0.015, 0.025), p * 0.55 * (1.0 - up));
  let cm = dot(rd, MOON_DIR);
  let ang = acos(clamp(cm, -1.0, 1.0));
  c += moonCol * (0.30 * exp(-ang * 6.0) + 0.65 * exp(-ang * 18.0)) * params.moon;
  let disc = 1.0 - smoothstep(r - 0.0025, r + 0.0015, ang);
  let ex = normalize(cross(MOON_DIR, vec3f(0, 1, 0)));
  let ey = cross(ex, MOON_DIR);
  let mp = vec2f(dot(rd, ex), dot(rd, ey)) / r;
  let maria = 0.78 + 0.22 * vnoise(vec3f(mp * 2.3, 1.7)) + 0.1 * vnoise(vec3f(mp * 6.0, 4.1));
  c = mix(c, moonCol * maria * 1.35, disc);
  let a = atan2(rd.x, rd.z);
  let sp = vec2f(a, asin(clamp(rd.y, -1.0, 1.0))) * 70.0;
  let cell = floor(sp);
  let fp = fract(sp) - 0.5;
  let rnd = h21(cell);
  let star = step(0.965, rnd) * smoothstep(0.17, 0.0, length(fp + (vec2f(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.5));
  c += vec3f(0.8, 0.85, 1.0) * star * (0.35 + 0.65 * h21(cell + 1.3)) * smoothstep(0.03, 0.3, up) * (1.0 - disc) * exp(-ang * 2.0);
  return c;
}

fn streaks(c2: vec2f) -> f32 {
  var q = vec2f(c2.x * 40.0, c2.y * 6.0 + params.drift * 1.6);
  q.x += q.y * 0.12;
  let cell = floor(q);
  let f = fract(q);
  let rnd = h21(cell);
  let o = 0.2 + 0.6 * h21(cell + 1.7);
  return step(0.84, rnd) * smoothstep(0.08, 0.02, abs(f.x - o)) * smoothstep(0.0, 0.3, f.y) * smoothstep(1.0, 0.6, f.y);
}

// Rais de lune obliques : bandes de bruit étirées le long de la direction de la lune (plan perpendiculaire à MOON_DIR),
// qui dérivent lentement avec `drift`; 0..1 = lumière lunaire reçue en q. Aucun terme de luminance rapide.
fn moon_shafts(q: vec3f) -> f32 {
  let u = dot(q, MOON_EX);
  let v = dot(q, MOON_EY);
  let w = params.drift * 0.05;
  let n = vnoise(vec3f(u * 0.55 + w, v * 0.16, 2.0)) * 0.7 + vnoise(vec3f(u * 1.6 - w * 1.5, v * 0.5, 7.0)) * 0.3;
  return smoothstep(0.50, 0.78, n) * exp(-max(q.y, 0.0) * 0.22);
}

// Poussière visible seulement dans les rais (3 tranches de profondeur, cellules hachées, dérive lente).
fn moon_motes(ro: vec3f, rd: vec3f, tEnd: f32) -> f32 {
  var g = 0.0;
  for (var s = 0; s < 3; s++) {
    let d = 2.5 + 4.5 * f32(s) + 1.5 * f32(s * s);
    if (d >= tEnd) { continue; }
    let sc = 2.6 - 0.5 * f32(s);
    let off = vec3f(params.drift * 0.05, -params.drift * 0.03, params.drift * 0.02) * (1.0 + f32(s));
    let pc = (ro + rd * d + off) * sc;
    let cell = floor(pc);
    let h = vec3f(h31(cell + f32(s) * 17.0), h31(cell.yzx + 5.3), h31(cell.zxy + 9.1));
    if (h.x < 0.72) { continue; }
    let m = (cell + 0.3 + 0.4 * h.yzx) / sc - off;
    let oc = m - ro;
    let al = dot(oc, rd);
    if (al < 0.5 || al > tEnd) { continue; }
    let dv = oc - rd * al;
    let lit = moon_shafts(m);
    g += exp(-dot(dv, dv) / (0.00005 * al * al + 0.0003)) * lit * (0.5 + 0.5 * h.z);
  }
  return g;
}

// Une paire d’yeux bas dans la brume, clignement lent.
fn eye_pair(ro: vec3f, rd: vec3f, c: vec3f, ph: f32, tEnd: f32) -> f32 {
  var g = 0.0;
  for (var s = -1; s <= 1; s += 2) {
    let oc = c + vec3f(f32(s) * 0.2, 0.0, 0.0) - ro;
    let al = dot(oc, rd);
    if (al > 0.5) {
      let tc = min(al, tEnd);
      let dv = oc - rd * tc;
      if (al < tEnd) { g += exp(-dot(dv, dv) / (0.013 + 0.0025 * al)); }
    }
  }
  let f = fract(params.drift / 9.0 + ph);
  return g * smoothstep(0.0, 0.04, min(f, 1.0 - f));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = params.paranoia;
  let res = vec2f(params.width, params.height);
  let fc = vec2f(uv.x, 1.0 - uv.y) * res;
  let c2 = (fc * 2.0 - res) / min(res.x, res.y);

  let land = smoothstep(0.7, 1.3, res.x / res.y);
  let moonElev = mix(0.74, 0.56, land);
  let moonAz = mix(-0.34, 0.5, land);
  MOON_DIR = vec3f(sin(moonAz) * cos(moonElev), sin(moonElev), cos(moonAz) * cos(moonElev));
  MOON_EX = normalize(cross(MOON_DIR, vec3f(0, 1, 0)));
  MOON_EY = cross(MOON_EX, MOON_DIR);
  let moonR = mix(0.098, 0.072, land) * params.moon;
  let yaw = params.sway + params.px * 0.06;
  let pitch = mix(-0.10, 0.12, land) + params.swayY - params.py * 0.04;
  var rd = normalize(vec3f(c2.x, c2.y, 1.3));
  let cp = cos(pitch); let sp = sin(pitch);
  rd = vec3f(rd.x, rd.y * cp + rd.z * sp, rd.z * cp - rd.y * sp);
  let cy = cos(yaw); let sy = sin(yaw);
  rd = vec3f(rd.x * cy + rd.z * sy, rd.y, rd.z * cy - rd.x * sy);
  let ro = vec3f(params.px * 0.15, EYE_Y + params.py * 0.05, 0.0);

  let red = smoothstep(0.1, 0.9, p);
  let moonCol = mix(vec3f(0.90, 0.94, 1.0), vec3f(0.95, 0.10, 0.05), red);
  let fogLit = mix(vec3f(0.22, 0.28, 0.40), vec3f(0.42, 0.11, 0.12), red);
  let density = mix(1.0, 2.0, p) * params.mist;

  var col = vec3f(0.0);
  var tEnd = 70.0;
  let a = atan2(rd.x, rd.z);
  let e = asin(clamp(rd.y, -1.0, 1.0));

  // --- Arrière-plan : ciel, arbres lointains, toits du village ; ou sol (herbe, sentier de gravier).
  if (rd.y >= 0.0) {
    col = sky_col(rd, p, moonCol, moonR);
    if (e < treeline(a)) {
      col = mix(vec3f(0.004, 0.007, 0.012), fogLit * 0.25, smoothstep(0.0, 0.1, e) * 0.3);
      tEnd = 60.0;
    }
    let v = village(a, e);
    if (v.x > 0.5) {
      col = vec3f(0.004, 0.006, 0.010) + vec3f(1.0, 0.55, 0.2) * v.y * 0.9;
      tEnd = 45.0;
    }
  } else {
    let tf = EYE_Y / -rd.y;
    let g = ro + rd * tf;
    tEnd = min(tf, 60.0);
    let path = 1.0 - smoothstep(0.55, 1.0, abs(g.x + 0.3 * sin(g.z * 0.2)));
    let n = 0.5 + vnoise(vec3f(g.xz * 1.6, 3.0)) * 0.8;
    var gc = mix(vec3f(0.011, 0.016, 0.017), vec3f(0.060, 0.058, 0.060), path) * n;
    gc += moonCol * 0.012 * pow(max(dot(normalize(vec3f(rd.x, -rd.y, rd.z)), MOON_DIR), 0.0), 40.0) * (1.0 + 3.0 * params.rain);
    col = gc;
  }

  // --- Mur d’enceinte + clôture, puis rangées de tombes du plus loin au plus proche.
  if (rd.z > 0.05) {
    let aaK = 2.4 / (1.3 * min(res.x, res.y));
    let bd = boundary(ro, rd, WALL_Z * aaK);
    if (bd.x > 0.0) {
      let X = ro.x + rd.x / rd.z * WALL_Z;
      let Y = ro.y + rd.y / rd.z * WALL_Z;
      let blk = 0.6 + 0.8 * h21(floor(vec2f(X / 0.45 + 0.5 * floor(Y / 0.22), Y / 0.22)));
      let sc = mix(vec3f(0.045, 0.052, 0.062) * blk, vec3f(0.004, 0.005, 0.008), bd.y);
      col = mix(col, sc, bd.x);
      if (bd.x > 0.5) { tEnd = min(tEnd, WALL_Z / rd.z); }
    }
    for (var li = 5; li >= 0; li--) {
      let D = 2.6 + 1.7 * f32(li) + 0.25 * f32(li * li);
      let r = row_mask(ro, rd, D, f32(li), D * aaK / 0.85);
      if (r.x > 0.0) {
        let Y = ro.y + rd.y / rd.z * D;
        var sc = vec3f(0.055, 0.064, 0.078) * (0.55 + 0.6 * clamp(Y, 0.0, 1.2)); // pierre éclairée par la lune, plus claire vers le haut
        if (r.y > 1.5 && r.y < 2.5) { sc = vec3f(0.020, 0.014, 0.010); } // bois
        if (r.y > 2.5) { sc = vec3f(0.003, 0.004, 0.006); } // fer
        col = mix(col, sc, r.x);
        if (r.x > 0.5) { tEnd = min(tEnd, D / rd.z); }
      }
    }
  }

  // --- Yeux bas dans la brume (forte paranoïa seulement).
  if (params.eyes > 0.01) {
    let ec = mix(vec3f(1.0, 0.65, 0.18), vec3f(1.0, 0.12, 0.05), p);
    let e1 = eye_pair(ro, rd, vec3f(-2.9, 0.7, 8.0), 0.30, tEnd) * smoothstep(0.0, 0.4, params.eyes);
    let e2 = eye_pair(ro, rd, vec3f(3.6, 0.6, 12.0), 0.62, tEnd) * smoothstep(0.35, 0.75, params.eyes);
    let e3 = eye_pair(ro, rd, vec3f(-5.2, 0.8, 16.0), 0.85, tEnd) * smoothstep(0.7, 1.0, params.eyes);
    col += ec * (e1 + e2 + e3) * 2.2;
  }

  // --- Brume basse qui roule : collée au sol, bruit qui dérive lentement.
  let N = 8;
  let jit = fract(52.9829189 * fract(dot(fc, vec2f(0.06711056, 0.00583715))));
  var T = 1.0;
  var scat = vec3f(0.0);
  let wind = vec3f(params.drift * 0.30, 0.0, params.drift * 0.12);
  let cm = max(dot(rd, MOON_DIR), 0.0);
  let lit = fogLit + moonCol * (0.30 * pow(cm, 8.0) + 0.08 * pow(cm, 2.0)) * params.moon;
  var tPrev = 0.0;
  for (var i = 0; i < N; i++) {
    let f = (f32(i) + jit) / f32(N);
    let t = tEnd * f * f;
    let dt = max(t - tPrev, 0.0);
    tPrev = t;
    let q = ro + rd * t;
    let hgt = max(q.y, 0.0);
    let nz = vnoise(q * vec3f(0.18, 0.9, 0.18) + wind) * 0.65 + vnoise(q * vec3f(0.5, 1.6, 0.5) - wind * 1.6) * 0.35;
    let dens = density * (0.05 * exp(-hgt * 0.5) + exp(-hgt * 2.2) * (0.1 + 1.7 * nz));
    let sig = dens * dt * 0.14;
    let k = 1.0 - exp(-sig);
    // Rais de lune dans le brouillard + brume basse qui capte la lune (même facteur, pas de boucle de plus).
    let sh = moon_shafts(q);
    let mistLit = moonCol * params.moon * sh * (0.30 + 0.8 * pow(cm, 4.0)) * (0.6 + 0.4 * exp(-hgt * 1.5));
    let shaftGlow = moonCol * params.moon * sh * (0.05 + 0.22 * pow(cm, 3.0)) * dt * 0.30 * density;
    scat += T * (k * (lit + mistLit) + shaftGlow);
    T *= 1.0 - k;
  }
  col = col * T + scat;
  col += moonCol * moon_motes(ro, rd, tEnd) * 0.5 * params.moon * T;

  // --- Bruine (espace écran, clairsemée, tamisée ; le centre reste dégagé).
  let cc = length(c2 * vec2f(0.8, 0.6));
  if (params.rain > 0.0) {
    col += vec3f(0.45, 0.52, 0.66) * streaks(c2) * 0.10 * params.rain * smoothstep(0.1, 0.6, cc);
  }

  // --- Étalonnage : assombrit le centre pour que la porte et le texte restent lisibles, vignette douce, tramage.
  col *= mix(0.72, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.6);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
