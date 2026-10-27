struct Params {
  time: f32,
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, adouci côté CPU
  sway: f32, // balancement de la caméra (0 si mouvement réduit)
  swayY: f32,
  drift: f32, // horloge d’animation : brume, vacillement, neige, clignements (0 si mouvement réduit)
  eyes: f32, // 0..1 présence d’yeux dans le noir
  px: f32, // parallaxe -1..1 (0 si mouvement réduit)
  py: f32,
  mist: f32, // variante : multiplicateur de densité de la brume
  moon: f32, // variante : multiplicateur de taille / luminosité de la lune
  snow: f32, // variante : 0..1 rafales de neige
  glow: f32, // intensité des citrouilles
}
@group(0) @binding(0) var<uniform> params: Params;

// Scène : sentier nocturne dans une forêt. Des citrouilles d’Halloween bordent le sentier (ellipsoïdes analytiques au visage sculpté),
// troncs et branches sont des silhouettes analytiques sur 5 plans de profondeur, quelques échantillons de bruit pour la brume qui dérive, la lune, des rafales de neige optionnelles.
// Vacillement de bougie : trois sinus lents (≤ 1,3 Hz), faible amplitude. Rien d’autre ne change la luminance dans le temps.

var<private> MOON_DIR: vec3f;
const EYE_Y: f32 = 1.5;
const NP: i32 = 6;

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
fn tcap(p: vec2f, a: vec2f, b: vec2f, r1: f32, r2: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}

fn path_x(z: f32) -> f32 { return 0.9 * sin(z * 0.11) + 0.35 * sin(z * 0.31 + 1.0); }

// --- Citrouilles d’Halloween : indice i (rangée de profondeur) et côté s (-1 / +1).
fn p_key(i: i32, s: f32) -> f32 { return f32(i) * 2.0 + select(0.0, 1.0, s > 0.0); }
fn p_scale(k: f32) -> f32 { return select(0.8 + 0.4 * h11(k * 2.3), 0.0, h11(k * 7.9) < 0.14); }
fn p_center(i: i32, s: f32) -> vec3f {
  let k = p_key(i, s);
  let z = 1.8 + f32(i) * 2.4 + 0.9 * h11(k * 5.1);
  return vec3f(path_x(z) + s * (1.35 + 0.5 * h11(k * 9.7)), 0.35 * p_scale(k), z);
}
// Vacillement de bougie : ~0,2, 0,7 et 1,3 Hz, amplitude totale ~ ±0,14.
fn flick(k: f32) -> f32 {
  let ph = k * 2.399;
  return 1.0 + 0.05 * sin(params.drift * 1.2 + ph * 3.0) + 0.05 * sin(params.drift * 4.4 + ph) + 0.035 * sin(params.drift * 8.1 + ph * 2.1 + 1.0);
}

// Lumière chaude projetée sur le sol en g.
fn lant_light(g: vec3f) -> f32 {
  var l = 0.0;
  for (var i = 0; i < NP; i++) {
    for (var j = 0; j < 2; j++) {
      let s = select(-1.0, 1.0, j == 1);
      let k = p_key(i, s);
      let c = p_center(i, s);
      let d = g - c;
      l += p_scale(k) * flick(k) / (1.0 + 2.6 * dot(d, d));
    }
  }
  return l;
}

// Masque du visage sculpté (u vers la droite, v vers le haut, ~[-1,1] sur la citrouille) : yeux triangulaires, nez, bouche dentée.
fn face(u: f32, v: f32) -> f32 {
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

// Troncs d’arbres + branches sur le plan z = D (couverture 0..1). Évite la clairière où passe le sentier.
fn trunk_mask(ro: vec3f, rd: vec3f, D: f32, seed: f32, aa: f32) -> f32 {
  let X = ro.x + rd.x / rd.z * D;
  let Y = ro.y + rd.y / rd.z * D;
  if (Y < 0.0) { return 0.0; }
  let cw = 3.2 + 0.45 * seed;
  let ci0 = floor(X / cw);
  let pc = path_x(D);
  var m = 0.0;
  for (var j = -1; j <= 1; j++) {
    let ci = ci0 + f32(j);
    let hs = h21(vec2f(ci, seed * 7.1));
    let cx = (ci + 0.15 + 0.7 * h21(vec2f(ci, seed * 3.3 + 1.0))) * cw;
    if (hs < 0.3 || abs(cx - pc) < 2.5) { continue; }
    let r = 0.17 + 0.2 * h21(vec2f(ci + 4.0, seed));
    let lean = (hs - 0.5) * 0.02 * Y;
    let rr = r * (1.0 + 0.7 * exp(-Y * 1.6));
    m = max(m, smoothstep(rr + aa, rr - aa, abs(X - cx - lean)));
    // branches
    let p2 = vec2f(X, Y);
    let hb = 2.4 + 2.4 * h11(ci * 1.7 + seed);
    let dir = select(-1.0, 1.0, h11(ci * 3.1 + seed) > 0.5);
    let ln = 1.1 + 1.3 * h11(ci * 5.3 + seed);
    let a = vec2f(cx + lean, hb);
    let b = a + vec2f(dir * ln, ln * 0.55);
    var d = tcap(p2, a, b, 0.07, 0.015);
    d = min(d, tcap(p2, a + (b - a) * 0.5, a + (b - a) * 0.5 + vec2f(-dir * ln * 0.3, ln * 0.5), 0.035, 0.01));
    d = min(d, tcap(p2, vec2f(cx + lean, hb + 1.4), vec2f(cx + lean - dir * ln * 0.8, hb + 1.4 + ln * 0.45), 0.05, 0.012));
    m = max(m, smoothstep(aa, -aa, d));
  }
  return m;
}

fn treeline(a: f32) -> f32 {
  var h = 0.10 + 0.04 * vn1(a * 2.3 + 4.0);
  let x = a * 38.0;
  let cell = floor(x);
  let tri = 1.0 - abs(fract(x) * 2.0 - 1.0);
  h += (0.03 + 0.05 * h11(cell)) * pow(tri, 1.2);
  let x2 = a * 21.0 + 7.0;
  let tri2 = 1.0 - abs(fract(x2) * 2.0 - 1.0);
  h += 0.06 * h11(floor(x2) + 9.0) * pow(tri2, 1.3);
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

fn flakes(c2: vec2f, scale: f32, speed: f32, seed: f32) -> f32 {
  let q = c2 * scale + vec2f(sin(params.drift * 0.25 + seed) * 0.8, params.drift * speed);
  let cell = floor(q);
  let f = fract(q) - 0.5;
  let o = (vec2f(h21(cell + seed + 3.1), h21(cell + seed + 7.7)) - 0.5) * 0.6;
  return step(0.74, h21(cell + seed)) * smoothstep(0.2, 0.05, length(f - o));
}

// Une paire d’yeux dans le noir à la position monde c (écartement 0,34), clignement lent.
fn eye_pair(ro: vec3f, rd: vec3f, c: vec3f, ph: f32, tEnd: f32) -> f32 {
  var g = 0.0;
  for (var s = -1; s <= 1; s += 2) {
    let oc = c + vec3f(f32(s) * 0.22, 0.0, 0.0) - ro;
    let al = dot(oc, rd);
    if (al > 0.5 && al < tEnd) {
      let d2 = dot(oc, oc) - al * al;
      g += exp(-d2 / (0.013 + 0.0025 * al));
    }
  }
  let f = fract(params.drift / 8.0 + ph);
  return g * smoothstep(0.0, 0.04, min(f, 1.0 - f));
}

// Braises : quelques points chauds par citrouille, montée lente avec balancement, s’éteignent en haut.
// Cycle de 14 s par braise, vacillement < 0,4 Hz, phases aléatoires : la luminance totale reste stable. Figées si drift = 0.
fn ember(ro: vec3f, rd: vec3f, c: vec3f, sc: f32, k: f32, tEnd: f32) -> vec3f {
  var g = vec3f(0.0);
  let nE = 2.5 + 3.5 * params.paranoia;
  for (var n = 0; n < 6; n++) {
    if (f32(n) > nE) { break; }
    let sd = k * 7.3 + f32(n) * 3.1;
    let age = fract(params.drift / (11.0 + 5.0 * h11(sd)) + h11(sd + 1.0));
    let sw = vec2f(sin(params.drift * 0.55 + sd * 2.0), cos(params.drift * 0.43 + sd * 3.0)) * 0.16 * age;
    let pe = c + vec3f(sw.x + (h11(sd + 2.0) - 0.5) * 0.25, 0.28 * sc + age * 1.5, sw.y + (h11(sd + 3.0) - 0.5) * 0.25);
    let oc = pe - ro;
    let al = dot(oc, rd);
    if (al > 0.5 && al < tEnd) {
      let dv = oc - rd * al;
      let r = 0.034 + 0.008 * al;
      let tw = 0.8 + 0.2 * sin(params.drift * 2.2 + sd * 5.0);
      // Orange vif en bas, rouge profond en haut ; cœur plus net que le halo.
      let hot = mix(vec3f(1.0, 0.50, 0.12), vec3f(0.85, 0.12, 0.03), smoothstep(0.1, 0.9, age));
      let q = dot(dv, dv) / (r * r);
      g += hot * (exp(-q) + 0.6 * exp(-q * 0.25)) * smoothstep(0.0, 0.08, age) * (1.0 - age) * tw * 5.0;
    }
  }
  return g;
}

// Poussière qui capte la lueur des citrouilles : 3 tranches de profondeur, grain par cellule, éclat = lumière reçue.
fn lant_motes(ro: vec3f, rd: vec3f, tEnd: f32) -> f32 {
  var m = 0.0;
  for (var s = 0; s < 3; s++) {
    let t = 2.6 + f32(s) * 2.9;
    if (t < tEnd) {
      let q = ro + rd * t;
      let cs = 0.4;
      let gq = q / cs + vec3f(sin(params.drift * 0.17 + f32(s)) * 0.5, params.drift * 0.04, params.drift * 0.03);
      let cell = floor(gq);
      let h = vec3f(h31(cell + f32(s) * 17.0), h31(cell + 5.2), h31(cell + 9.7));
      if (h.x > 0.9 - 0.05 * params.paranoia && q.y > 0.15 && q.y < 3.0) {
        let f = (fract(gq) - 0.5 - (h.yzx - 0.5) * 0.6) * cs;
        let r = 0.012 + 0.0035 * t;
        let ll = lant_light(q);
        let tw = 0.75 + 0.25 * sin(params.drift * 1.6 + h.z * 6.0);
        m += exp(-dot(f, f) / (r * r)) * ll * tw;
      }
    }
  }
  return m;
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
  let density = mix(0.8, 1.8, p) * params.mist;
  let warm = vec3f(1.0, 0.50, 0.12);

  var col = vec3f(0.0);
  var tEnd = 70.0;
  let a = atan2(rd.x, rd.z);
  let e = asin(clamp(rd.y, -1.0, 1.0));

  // --- Arrière-plan : ciel + crête lointaine, ou sol (feuilles, sentier éclairé, lumière des citrouilles).
  if (rd.y >= 0.0) {
    col = sky_col(rd, p, moonCol, moonR);
    if (e < treeline(a)) {
      col = mix(vec3f(0.004, 0.007, 0.012), fogLit * 0.25, smoothstep(0.0, 0.2, e) * 0.3);
      tEnd = 45.0;
    }
  } else {
    let tf = EYE_Y / -rd.y;
    let g = ro + rd * tf;
    tEnd = min(tf, 60.0);
    let onPath = 1.0 - smoothstep(0.7, 1.3, abs(g.x - path_x(g.z)));
    let n = 0.5 + vnoise(vec3f(g.xz * 1.3, 3.0)) * 0.8;
    var gc = mix(vec3f(0.010, 0.015, 0.016), vec3f(0.085, 0.075, 0.068), onPath) * n;
    gc += moonCol * 0.012 * pow(max(dot(normalize(vec3f(rd.x, -rd.y, rd.z)), MOON_DIR), 0.0), 40.0) * (0.4 + onPath);
    gc += warm * 0.12 * params.glow * lant_light(g) * (0.35 + 0.65 * onPath);
    col = gc;
  }

  // --- Citrouilles d’Halloween (ellipsoïde touché le plus proche) + halos.
  var tL = 1.0e9;
  var halo = 0.0;
  var embers = vec3f(0.0);
  var hitC = vec3f(0.0);
  var hitK = 0.0;
  var hitS = 0.0;
  for (var i = 0; i < NP; i++) {
    for (var j = 0; j < 2; j++) {
      let s = select(-1.0, 1.0, j == 1);
      let k = p_key(i, s);
      let sc = p_scale(k);
      if (sc > 0.0) {
        let c = p_center(i, s);
        let oc0 = c - ro;
        let al = dot(oc0, rd);
        if (al > 0.5) {
          let tc = min(al, tEnd);
          let dv = oc0 - rd * tc;
          let d2 = dot(dv, dv);
          halo += exp(-d2 * 3.0 / (sc * sc)) * flick(k) / (1.0 + tc * 0.12) * sc;
          // Cull : les braises montent de ~1,5 m et ondulent de ~0,3 m ; au-delà, un rayon ne peut pas les toucher.
          let er = 0.28 * sc + 2.4;
          if (params.glow > 0.0 && al < 28.0 && d2 < er * er) { embers += ember(ro, rd, c, sc, k, tEnd); }
          if (d2 < 0.2 * sc * sc && al < tEnd) {
            let rad = vec3f(0.40, 0.35, 0.40) * sc;
            let o = (ro - c) / rad;
            let dd = rd / rad;
            let qa = dot(dd, dd);
            let qb = dot(o, dd);
            let disc = qb * qb - qa * (dot(o, o) - 1.0);
            if (disc > 0.0) {
              let t = (-qb - sqrt(disc)) / qa;
              if (t > 0.1 && t < tL && t < tEnd) { tL = t; hitC = c; hitK = k; hitS = s; }
            }
          }
        }
      }
    }
  }
  col += warm * halo * 0.22 * params.glow;
  col += embers * params.glow;
  if (tL < 1.0e8) {
    let sc = p_scale(hitK);
    let rad = vec3f(0.40, 0.35, 0.40) * sc;
    let q = (ro + rd * tL - hitC) / rad; // sur la sphère unité
    // Le visage regarde vers le sentier et la caméra.
    let fdir = normalize(vec3f(-hitS * 0.55, 0.0, -1.0));
    let right = vec3f(-fdir.z, 0.0, fdir.x);
    let fr = dot(q, fdir);
    let u = dot(q, right);
    let v = q.y;
    let m = face(u * 1.25, v * 1.15) * smoothstep(0.25, 0.55, fr);
    let rib = 0.75 + 0.25 * cos(atan2(q.x, q.z) * 9.0);
    let fl = flick(hitK) * params.glow;
    var body = vec3f(0.075, 0.026, 0.006) * rib;
    body += warm * 0.10 * fl * smoothstep(-0.2, 0.9, fr);
    body += moonCol * 0.02 * max(dot(q, MOON_DIR), 0.0);
    col = mix(body, vec3f(1.0, 0.55, 0.14) * 1.5 * fl, m);
    col = mix(col, vec3f(0.01, 0.014, 0.006), smoothstep(0.78, 0.95, q.y)); // tige
    tEnd = tL;
  }

  // --- Troncs, du plus loin au plus proche, chacun ignoré quand une citrouille est plus proche.
  if (rd.z > 0.05) {
    let aaK = 2.4 / (1.3 * min(res.x, res.y));
    for (var li = 4; li >= 0; li--) {
      let D = 5.5 + 3.3 * f32(li) + 0.55 * f32(li * li);
      let tl = D / rd.z;
      let m = trunk_mask(ro, rd, D, f32(li), D * aaK);
      if (m > 0.0 && tl < tL) {
        col = mix(col, vec3f(0.003, 0.005, 0.008), m);
        if (m > 0.5) { tEnd = min(tEnd, tl); }
      }
    }
  }

  // --- Poussière captant la lueur des citrouilles (masquée derrière les troncs/citrouilles opaques jusqu’à tEnd).
  col += warm * 0.8 * params.glow * lant_motes(ro, rd, tEnd);

  // --- Yeux entre les troncs (forte paranoïa seulement).
  if (params.eyes > 0.01) {
    let ec = mix(vec3f(1.0, 0.65, 0.18), vec3f(1.0, 0.12, 0.05), p);
    let e1 = eye_pair(ro, rd, vec3f(-3.9, 1.35, 8.5), 0.30, tEnd) * smoothstep(0.0, 0.4, params.eyes);
    let e2 = eye_pair(ro, rd, vec3f(4.8, 1.7, 12.0), 0.62, tEnd) * smoothstep(0.35, 0.75, params.eyes);
    let e3 = eye_pair(ro, rd, vec3f(-6.2, 1.25, 17.0), 0.85, tEnd) * smoothstep(0.7, 1.0, params.eyes);
    col += ec * (e1 + e2 + e3) * 2.2;
  }

  // --- Brume : peu d’échantillons, bruit qui dérive lentement, collée au sol.
  let N = 7;
  let jit = fract(52.9829189 * fract(dot(fc, vec2f(0.06711056, 0.00583715))));
  var T = 1.0;
  var scat = vec3f(0.0);
  let wind = vec3f(params.drift * 0.35, 0.0, params.drift * 0.15);
  let cm = max(dot(rd, MOON_DIR), 0.0);
  let lit = fogLit + moonCol * (0.30 * pow(cm, 8.0) + 0.08 * pow(cm, 2.0)) * params.moon + warm * 0.035 * params.glow * halo;
  // Rayons de lune : bandes de visibilité de la lune (bruit 1D dans le plan perpendiculaire à MOON_DIR), traversant la brume.
  let mx = normalize(cross(MOON_DIR, vec3f(0, 1, 0)));
  let my = cross(mx, MOON_DIR);
  let shaftPh = pow(max(cm, 0.0), 3.0) * 1.6 + 0.35;
  let shaftCol = moonCol * params.moon * shaftPh;
  var tPrev = 0.0;
  for (var i = 0; i < N; i++) {
    let f = (f32(i) + jit) / f32(N);
    let t = tEnd * f * f;
    let dt = max(t - tPrev, 0.0);
    tPrev = t;
    let q = ro + rd * t;
    let hgt = max(q.y, 0.0);
    let nz = vnoise(q * vec3f(0.22, 0.5, 0.22) + wind) * 0.65 + vnoise(q * vec3f(0.6, 1.2, 0.6) - wind * 1.7) * 0.35;
    let dens = density * exp(-hgt * 0.55) * (0.15 + 1.3 * nz);
    let sig = dens * dt * 0.12;
    let k = 1.0 - exp(-sig);
    let sp2 = vec2f(dot(q, mx), dot(q, my));
    let band = vn1(sp2.x * 0.7 + sp2.y * 0.12 + params.drift * 0.02) * 0.65 + vn1(sp2.x * 1.9 - sp2.y * 0.3 + 7.0) * 0.35;
    let shaft = smoothstep(0.52, 0.8, band) * smoothstep(0.0, 1.2, q.y + 0.6) * exp(-max(q.y - 4.0, 0.0) * 0.5);
    scat += T * k * (lit + shaftCol * shaft * 1.1 * (0.5 + nz));
    T *= 1.0 - k;
  }
  col = col * T + scat;

  // --- Rafales de neige (espace écran, lentes ; le centre reste dégagé).
  let cc = length(c2 * vec2f(0.8, 0.6));
  if (params.snow > 0.0) {
    let fl = flakes(c2, 13.0, 0.9, 1.0) + 0.7 * flakes(c2 + 0.37, 22.0, 1.4, 5.0);
    col += vec3f(0.55, 0.62, 0.78) * fl * 0.35 * params.snow * smoothstep(0.1, 0.6, cc);
  }

  // --- Étalonnage : assombrit le centre pour que la porte et le texte restent lisibles, vignette douce, tramage.
  col *= mix(0.72, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.6);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
