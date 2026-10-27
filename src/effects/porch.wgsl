struct Params {
  time: f32,
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, eased on the CPU
  sway: f32, // camera sway phase already scaled (0 when reduced motion)
  swayY: f32,
  drift: f32, // fog drift clock (0 when reduced motion)
  wolf: f32, // 0..1 werewolf presence
  px: f32, // parallax -1..1 (0 when reduced motion), already smoothed on the CPU
  py: f32,
  mist: f32, // variant: fog density multiplier
  moon: f32, // variant: moon brightness (halo, disc, fog light)
  rain: f32, // variant: 0..1 fine drizzle
  leaves: f32, // variant: 0..1 falling autumn leaves
  lamp: f32, // variant: 0..1 lit jack-o’-lantern on the porch
}
@group(0) @binding(0) var<uniform> params: Params;

// Scene: night, a porch railing in the foreground (raymarched), fog (a few noise samples along each ray),
// a full moon with halo, sparse stars, a conifer treeline and, at high paranoia, a werewolf on a hill.
// Everything moves slowly and spatially (camera sway, fog drift); there is no time-driven global luminance term.

var<private> MOON_DIR: vec3f;
const EYE_Y: f32 = 1.5;
const RAIL_Z: f32 = 1.7;

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

fn sd_box(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Porch railing: posts every 1.6, balusters every 0.24, top and bottom rails, post caps.
fn railing(p: vec3f) -> f32 {
  let q = vec3f(p.x + 0.8, p.y, p.z - RAIL_Z);
  let px = (fract(q.x / 1.6 + 0.5) - 0.5) * 1.6;
  var d = sd_box(vec3f(px, q.y - 0.6, q.z), vec3f(0.08, 0.66, 0.08));
  d = min(d, sd_box(vec3f(px, q.y - 1.28, q.z), vec3f(0.115, 0.03, 0.115)));
  d = min(d, sd_box(vec3f(q.x, q.y - 1.12, q.z), vec3f(1000.0, 0.04, 0.075)));
  d = min(d, sd_box(vec3f(q.x, q.y - 0.22, q.z), vec3f(1000.0, 0.035, 0.05)));
  let bx = (fract(q.x / 0.24 + 0.5) - 0.5) * 0.24;
  d = min(d, sd_box(vec3f(bx, q.y - 0.67, q.z), vec3f(0.022, 0.45, 0.022)));
  return d;
}

fn tcap(p: vec2f, a: vec2f, b: vec2f, r1: f32, r2: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}

// Werewolf standing, in local units (feet at y=0, head top around y=1), facing left, hunched shoulders.
fn wolf_sd(p: vec2f) -> f32 {
  var d = tcap(p, vec2f(-0.07, 0.0), vec2f(-0.10, 0.40), 0.035, 0.06);
  d = min(d, tcap(p, vec2f(0.08, 0.0), vec2f(0.10, 0.40), 0.035, 0.06));
  d = min(d, tcap(p, vec2f(0.0, 0.36), vec2f(0.02, 0.70), 0.10, 0.15));
  d = min(d, tcap(p, vec2f(-0.18, 0.69), vec2f(0.20, 0.71), 0.07, 0.07));
  d = min(d, tcap(p, vec2f(-0.19, 0.68), vec2f(-0.27, 0.40), 0.055, 0.03));
  d = min(d, tcap(p, vec2f(0.21, 0.68), vec2f(0.27, 0.38), 0.055, 0.03));
  d = min(d, tcap(p, vec2f(-0.27, 0.40), vec2f(-0.30, 0.31), 0.03, 0.006)); // claws
  d = min(d, tcap(p, vec2f(0.27, 0.38), vec2f(0.30, 0.29), 0.03, 0.006));
  d = min(d, tcap(p, vec2f(0.0, 0.74), vec2f(-0.04, 0.82), 0.08, 0.06)); // neck
  d = min(d, length(p - vec2f(-0.05, 0.86)) - 0.075); // head
  d = min(d, tcap(p, vec2f(-0.05, 0.86), vec2f(-0.21, 0.84), 0.055, 0.022)); // snout
  d = min(d, tcap(p, vec2f(-0.02, 0.92), vec2f(0.00, 1.04), 0.03, 0.004)); // ears
  d = min(d, tcap(p, vec2f(-0.09, 0.93), vec2f(-0.10, 1.04), 0.03, 0.004));
  d = min(d, tcap(p, vec2f(0.08, 0.40), vec2f(0.27, 0.20), 0.035, 0.008)); // tail
  return d;
}

fn treeline(a: f32) -> f32 {
  // Far, gentle ridge + conifer spikes, plus a hill under the wolf.
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

// Fine drizzle: sparse slanted streaks in screen space, falling with the drift clock (static when reduced motion).
fn streaks(c2: vec2f) -> f32 {
  var q = vec2f(c2.x * 40.0, c2.y * 6.0 + params.drift * 1.6);
  q.x += q.y * 0.12;
  let cell = floor(q);
  let f = fract(q);
  let rnd = h21(cell);
  let o = 0.2 + 0.6 * h21(cell + 1.7);
  return step(0.84, rnd) * smoothstep(0.08, 0.02, abs(f.x - o)) * smoothstep(0.0, 0.3, f.y) * smoothstep(1.0, 0.6, f.y);
}

// Autumn leaves: layers of small tilted ellipses that fall slowly and sway sideways.
fn leaf_layer(c2: vec2f, scale: f32, speed: f32, seed: f32) -> f32 {
  var q = c2 * scale;
  q.y += params.drift * speed;
  let cell = floor(q);
  let h = h21(cell + seed);
  let h2 = h21(cell + seed + 5.3);
  var f = fract(q) - vec2f(0.5 + (h - 0.5) * 0.4 + 0.18 * sin(q.y * 0.9 + h * 6.28), 0.5);
  let a = h2 * 6.28 + q.y * 0.5;
  f = vec2f(f.x * cos(a) - f.y * sin(a), f.x * sin(a) + f.y * cos(a));
  let d = length(f * vec2f(1.0, 2.6));
  return step(0.55, h) * smoothstep(0.24, 0.12, d);
}

// Jack-o’-lantern in screen space: p relative to its centre, unit = body radius. Returns (body mask, face mask).
fn pumpkin(p: vec2f) -> vec2f {
  let body = 1.0 - smoothstep(0.92, 1.0, length(p * vec2f(1.0, 1.2)));
  let ty = p.y - 0.18;
  let eyeL = step(-0.14, ty) * step(ty, 0.16) * step(abs(p.x + 0.40), (0.16 - ty) * 0.8);
  let eyeR = step(-0.14, ty) * step(ty, 0.16) * step(abs(p.x - 0.40), (0.16 - ty) * 0.8);
  let y0 = -0.38 + 0.5 * p.x * p.x;
  let mouth = step(abs(p.y - y0), 0.11) * step(abs(p.x), 0.62) * step(0.22, fract(p.x * 3.2 + 0.5));
  let face = clamp(eyeL + eyeR + mouth, 0.0, 1.0) * body;
  return vec2f(body, face);
}

fn cam_ray(c: vec2f, pitch: f32, yaw: f32) -> vec3f {
  var r = normalize(vec3f(c.x, c.y, 1.3));
  let cp = cos(pitch); let sp = sin(pitch);
  r = vec3f(r.x, r.y * cp + r.z * sp, r.z * cp - r.y * sp);
  let cy = cos(yaw); let sy = sin(yaw);
  return vec3f(r.x * cy + r.z * sy, r.y, r.z * cy - r.x * sy);
}

// Rayons de lune : lumière directionnelle (axe MOON_DIR) à travers la brume. Les plans de lumière sont des bandes
// de bruit dans le plan perpendiculaire à MOON_DIR (inclinées comme la lune), intégrées en 3 échantillons le long du rayon
// (pas de boucle de marche en plus). Retourne la brillance (à teinter), densité de brume × bande × phase vers la lune.
fn band_at(P: vec3f, drift: f32) -> f32 {
  let e1 = normalize(cross(MOON_DIR, vec3f(0, 1, 0)));
  let e2 = cross(e1, MOON_DIR);
  let n = vnoise(vec3f(dot(P, e1) * 0.55 + drift * 0.01, dot(P, e2) * 1.1, 3.3));
  return smoothstep(0.5, 0.7, n);
}
fn moon_shafts(ro: vec3f, rd: vec3f, tmax: f32, drift: f32, jit: f32, dens: f32) -> f32 {
  var acc = 0.0;
  for (var i = 0; i < 3; i++) {
    let lo = 0.0 + 4.5 * f32(i) * f32(i) + 2.0 * f32(i); // 0, 6.5, 22
    let w = 6.5 + 12.0 * f32(i); // 6.5, 18.5, 30.5
    let dtt = clamp(tmax - lo, 0.0, w);
    if (dtt <= 0.0) { continue; }
    let t = lo + dtt * (0.25 + 0.5 * fract(jit + 0.37 * f32(i)));
    let P = ro + rd * t;
    let hgt = max(P.y + 0.9, 0.0);
    acc += dtt * exp(-hgt * 0.45) * band_at(P, drift);
  }
  let cm = max(dot(rd, MOON_DIR), 0.0);
  return acc * dens * (0.35 + 1.5 * pow(cm, 3.0));
}

// Poussière dans la lumière : 4 tranches de profondeur, un grain par cellule ; éclairée par la lune (dans les rayons) et,
// à la variante lanterne, par la citrouille (source ponctuelle Lw). Retourne une couleur.
fn dust_hash(p: vec3f) -> vec3f {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}
fn porch_motes(ro: vec3f, rd: vec3f, tmax: f32, Lw: vec3f, moonCol: vec3f, drift: f32, dens: f32, pix: f32) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0; i < 4; i++) {
    let s = 0.30 + 0.09 * f32(i);
    let tk = 2.4 + 2.3 * f32(i);
    if (tk >= tmax) { continue; }
    let P = ro + rd * tk;
    let off = vec3f(0.0, drift * 0.03 + f32(i) * 3.7, f32(i) * 11.0);
    let cell = floor((P + off) / s);
    let hh = dust_hash(cell + f32(i) * 17.0);
    if (hh.x > dens) { continue; }
    let ph = hh * 6.2832;
    let sway = vec3f(sin(drift * 0.23 + ph.x), sin(drift * 0.19 + ph.y) * 0.6, cos(drift * 0.21 + ph.z)) * 0.16;
    let m = (cell + 0.15 + 0.7 * dust_hash(cell + 5.1) + sway) * s - off;
    let tm = dot(m - ro, rd);
    if (tm < 0.5 || tm > tmax) { continue; }
    let dist = length(m - ro - rd * tm);
    let rad = max(tm * pix * 1.1, 0.010);
    let shape = 1.0 - smoothstep(rad * 0.4, rad, dist);
    if (shape <= 0.0) { continue; }
    let tw = 0.7 + 0.3 * sin(drift * 0.8 + ph.x * 3.0);
    var light = moonCol * (band_at(m, drift) * 1.0 + 0.02) * params.moon;
    let d = m - Lw;
    light += vec3f(1.0, 0.62, 0.26) * params.lamp * 3.0 / (0.25 + dot(d, d));
    acc += shape * light * tw * (0.5 + hh.y);
  }
  return acc;
}

// Volume chaud autour de la citrouille : diffusion analytique d’une source ponctuelle dans une brume homogène.
fn lamp_glow(ro: vec3f, rd: vec3f, tmax: f32, L: vec3f) -> f32 {
  let w = L - ro;
  let a = dot(w, rd);
  let h = sqrt(max(dot(w, w) - a * a, 0.09));
  return (atan((tmax - a) / h) - atan(-a / h)) / h;
}

fn sky_col(rd: vec3f, p: f32, moonCol: vec3f, r: f32) -> vec3f {
  let up = clamp(rd.y, 0.0, 1.0);
  var c = mix(vec3f(0.21, 0.27, 0.39), vec3f(0.024, 0.036, 0.085), pow(up, 0.42));
  c = mix(c, vec3f(0.07, 0.015, 0.025), p * 0.55 * (1.0 - up));
  let cm = dot(rd, MOON_DIR);
  // Halo (angular distance), then disc with soft limb and faint maria.
  let ang = acos(clamp(cm, -1.0, 1.0));
  c += moonCol * (0.30 * exp(-ang * 6.0) + 0.65 * exp(-ang * 18.0)) * params.moon;
  let disc = 1.0 - smoothstep(r - 0.0025, r + 0.0015, ang);
  // Moon surface coordinates
  let ex = normalize(cross(MOON_DIR, vec3f(0, 1, 0)));
  let ey = cross(ex, MOON_DIR);
  let mp = vec2f(dot(rd, ex), dot(rd, ey)) / r;
  let maria = 0.78 + 0.22 * vnoise(vec3f(mp * 2.3, 1.7)) + 0.1 * vnoise(vec3f(mp * 6.0, 4.1));
  c = mix(c, moonCol * maria * 1.35, disc);
  // Stars: sparse, static, fade near the moon.
  let a = atan2(rd.x, rd.z);
  let sp = vec2f(a, asin(clamp(rd.y, -1.0, 1.0))) * 70.0;
  let cell = floor(sp);
  let fp = fract(sp) - 0.5;
  let rnd = h21(cell);
  let star = step(0.965, rnd) * smoothstep(0.17, 0.0, length(fp + (vec2f(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.5));
  c += vec3f(0.8, 0.85, 1.0) * star * (0.35 + 0.65 * h21(cell + 1.3)) * smoothstep(0.03, 0.3, up) * (1.0 - disc) * exp(-ang * 4.0 * 0.5);
  return c;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = params.paranoia;
  let res = vec2f(params.width, params.height);
  // uv origin is flipped here so y is up.
  let fc = vec2f(uv.x, 1.0 - uv.y) * res;
  let c2 = (fc * 2.0 - res) / min(res.x, res.y);

  // Camera with slow sway (yaw/pitch).
  // Portrait lifts the moon above the central door and tilts the camera up; landscape keeps it lower so the wolf can stand in front of it.
  let land = smoothstep(0.7, 1.3, res.x / res.y);
  // Portrait: the door covers the centre, so the moon sits in the top-left corner and the wolf stands on the horizon glow in the right gutter.
  let moonElev = mix(0.74, 0.56, land);
  let moonAz = mix(-0.34, 0.5, land);
  MOON_DIR = vec3f(sin(moonAz) * cos(moonElev), sin(moonElev), cos(moonAz) * cos(moonElev));
  let wolfAz = mix(0.50, moonAz, land);
  let feetE = mix(0.04, moonElev - 0.31, land);
  let moonR = mix(0.098, 0.072, land) * params.moon;
  // Parallax: yaw/pitch (~3.4 deg / 2.3 deg max) for every layer + a small lateral eye shift that moves the near railing more.
  let yaw = params.sway + params.px * 0.06;
  let pitch = mix(-0.10, 0.12, land) + params.swayY - params.py * 0.04;
  let rd = cam_ray(c2, pitch, yaw);
  let ro = vec3f(params.px * 0.15, EYE_Y + params.py * 0.05, 0.0);

  let red = smoothstep(0.1, 0.9, p);
  let moonCol = mix(vec3f(0.90, 0.94, 1.0), vec3f(0.95, 0.10, 0.05), red);
  let fogLit = mix(vec3f(0.22, 0.28, 0.40), vec3f(0.42, 0.11, 0.12), red) * mix(1.0, params.moon, 0.7) + vec3f(0.30, 0.13, 0.03) * params.lamp * 0.30;
  let density = mix(0.8, 1.7, p) * params.mist;

  var col = vec3f(0.0);
  var tEnd = 70.0;
  let a = atan2(rd.x, rd.z);
  let e = asin(clamp(rd.y, -1.0, 1.0));

  // --- Background by direction
  if (rd.y >= 0.0) {
    col = sky_col(rd, p, moonCol, moonR);
    let h = treeline(a);
    if (e < h) {
      col = mix(vec3f(0.004, 0.007, 0.012), fogLit * 0.25, smoothstep(0.0, h, e) * 0.3);
      tEnd = 45.0;
    }
    // Hill + werewolf, angular coords around the moon.
    let ma = mix(atan2(MOON_DIR.x, MOON_DIR.z) , wolfAz, 1.0 - land);
    let hill = max(feetE - 0.10, 0.02) * exp(-pow((a - ma + 0.03) / mix(0.34, 0.16, land), 2.0));
    if (e < 0.11 + hill && e > 0.0) {
      col = mix(vec3f(0.004, 0.007, 0.011), fogLit * 0.25, 0.15);
      tEnd = 40.0;
    }
    let sc = 0.36;
    let wp = (vec2f((a - ma + 0.015) * cos(feetE), e - feetE) / sc);
    let wd = wolf_sd(wp) * sc + (vnoise(vec3f(wp * 40.0, 1.0)) - 0.5) * 0.004;
    let wa = (1.0 - smoothstep(-0.002, 0.003, wd)) * params.wolf;
    // Backlight behind the wolf so the silhouette reads against the dark sky.
    let gx = (a - ma) * cos(feetE) / 0.26;
    let gy = (e - feetE - 0.14) / 0.30;
    col += moonCol * 0.22 * exp(-(gx * gx + gy * gy)) * params.wolf;
    col = mix(col, vec3f(0.002, 0.003, 0.006), wa);
    if (wa > 0.01) { tEnd = 38.0; }
  } else {
    // Ground: porch boards then yard.
    let tf = EYE_Y / -rd.y;
    if (tf * rd.z < RAIL_Z + 0.15) {
      let g = ro + rd * tf;
      let board = smoothstep(0.0, 0.03, abs(fract(g.x * 2.2 + 0.5) - 0.5) * 0.45);
      col = vec3f(0.045, 0.037, 0.033) * (0.5 + 0.5 * board) * (0.6 + 0.8 * vnoise(vec3f(g.x * 4.0, g.z * 40.0, 0.0)));
      col += moonCol * 0.012 * pow(max(dot(normalize(vec3f(rd.x, -rd.y, rd.z)), MOON_DIR), 0.0), 40.0);
      col += fogLit * 0.07;
      tEnd = tf;
    } else {
      let ty = (EYE_Y + 0.8) / -rd.y;
      tEnd = min(ty, 60.0);
      let g = ro + rd * ty;
      col = vec3f(0.012, 0.018, 0.022) * (0.5 + vnoise(vec3f(g.xz * 0.8, 3.0)));
    }
  }

  // --- Railing (bounded march)
  if (rd.z > 0.05) {
    let t0 = (RAIL_Z - 0.2) / rd.z;
    let t1 = (RAIL_Z + 0.2) / rd.z;
    var t = t0;
    var hit = false;
    for (var i = 0; i < 40; i++) {
      let d = railing(ro + rd * t);
      if (d < 0.004) { hit = true; break; }
      t += d * 0.95;
      if (t > t1 || t > tEnd) { break; }
    }
    if (hit && t < tEnd) {
      let q = ro + rd * t;
      let n = normalize(vec3f(
        railing(q + vec3f(0.01, 0, 0)) - railing(q - vec3f(0.01, 0, 0)),
        railing(q + vec3f(0, 0.01, 0)) - railing(q - vec3f(0, 0.01, 0)),
        railing(q + vec3f(0, 0, 0.01)) - railing(q - vec3f(0, 0, 0.01))));
      // Back-lit: dark body, thin moon rim on edges facing the moon.
      let rim = pow(max(dot(n, MOON_DIR), 0.0), 2.0);
      let grain = 0.7 + 0.5 * vnoise(vec3f(q.x * 3.0, q.y * 30.0, q.z * 3.0));
      col = vec3f(0.012, 0.009, 0.008) * grain + moonCol * rim * 0.30 + fogLit * 0.05;
      tEnd = t;
    }
  }

  // --- Fog: few samples, noise drifting slowly.
  let N = 6;
  let jit = fract(52.9829189 * fract(dot(fc, vec2f(0.06711056, 0.00583715))));
  var T = 1.0;
  var scat = vec3f(0.0);
  let wind = vec3f(params.drift * 0.35, 0.0, params.drift * 0.15);
  let cm = max(dot(rd, MOON_DIR), 0.0);
  let lit = fogLit + moonCol * (0.30 * pow(cm, 8.0) + 0.08 * pow(cm, 2.0)) * params.moon;
  var tPrev = 0.0;
  for (var i = 0; i < N; i++) {
    let f = (f32(i) + jit) / f32(N);
    let t = tEnd * f * f;
    let dt = max(t - tPrev, 0.0);
    tPrev = t;
    let q = ro + rd * t;
    let hgt = max(q.y + 0.9, 0.0);
    let nz = vnoise(q * vec3f(0.22, 0.5, 0.22) + wind) * 0.65 + vnoise(q * vec3f(0.6, 1.2, 0.6) - wind * 1.7) * 0.35;
    let dens = density * exp(-hgt * 0.75) * (0.15 + 1.3 * nz);
    let sig = dens * dt * 0.12;
    let k = 1.0 - exp(-sig);
    scat += T * k * lit;
    T *= 1.0 - k;
  }
  col = col * T + scat;

  // --- Lumière volumétrique : rayons de lune obliques dans la brume, poussière révélée par la lumière, volume chaud de la citrouille.
  // Variation spatiale seulement ; respiration < 0,1 Hz et ±5 % (jamais ≥ 3 Hz). La paranoïa n’augmente que la densité.
  {
    let tv = min(tEnd, 60.0);
    let breath = 1.0 + 0.05 * sin(params.drift * 0.5);
    let lc = vec2f(mix(-0.30, -1.05, land) - params.px * 0.05, mix(-0.95, -0.78, land));
    let Lw = ro + cam_ray(lc, pitch, yaw) * 1.8;
    col += moonCol * moon_shafts(ro, rd, tv, params.drift, jit, params.mist * (0.55 + 0.45 * p)) * 0.075 * params.moon * breath;
    col += porch_motes(ro, rd, tv, Lw, moonCol, params.drift, 0.22 + 0.2 * p, 2.0 / (min(res.x, res.y) * 1.3)) * 0.9 * breath;
    if (params.lamp > 0.0) {
      col += vec3f(1.0, 0.55, 0.18) * lamp_glow(ro, rd, tv, Lw) * 0.05 * (0.8 + 0.4 * p) * params.mist * params.lamp * breath;
    }
  }

  // --- Lantern: steady warm glow + lit pumpkin on the porch (no flicker: luminance stays constant).
  let cc = length(c2 * vec2f(0.8, 0.6));
  if (params.lamp > 0.0) {
    let lc = vec2f(mix(-0.30, -1.05, land) - params.px * 0.05, mix(-0.95, -0.78, land));
    let lp = c2 - lc;
    let warm = vec3f(1.0, 0.52, 0.14);
    col += warm * 0.34 * exp(-length(lp * vec2f(0.9, 1.3)) * 3.2) * params.lamp;
    let pk = pumpkin(lp / 0.13);
    col = mix(col, vec3f(0.20, 0.07, 0.012), pk.x * params.lamp);
    col = mix(col, warm * 1.5, pk.y * params.lamp);
  }

  // --- Drizzle and leaves (screen space, dim, the centre stays clear).
  let edge = smoothstep(0.05, 0.4, cc);
  if (params.rain > 0.0) {
    col += vec3f(0.45, 0.52, 0.66) * streaks(c2) * 0.24 * params.rain * edge;
  }
  if (params.leaves > 0.0) {
    let lf = max(leaf_layer(c2, 7.0, 0.35, 0.0), 0.7 * leaf_layer(c2 + vec2f(0.4, 0.2), 12.0, 0.6, 9.0));
    // Éclairées comme la scène : albedo d’automne × lumière nocturne (brume + lune), un peu plus claires vers la lune (haut), lampe en appoint.
    let moonSide = mix(0.8, 1.3, smoothstep(-0.8, 0.9, c2.y));
    let leafLight = fogLit * 4.4 * moonSide + moonCol * params.moon * 0.06 + vec3f(0.55, 0.26, 0.07) * params.lamp * 0.3;
    col = mix(col, vec3f(0.48, 0.19, 0.06) * mix(vec3f(dot(leafLight, vec3f(0.34))), leafLight, 0.35), lf * 0.85 * params.leaves * edge);
  }

  // --- Grade: dim the centre so white UI text stays readable, soft vignette, dither.
  col *= mix(0.78, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.6);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
