struct Params {
  time: f32,
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, adouci côté CPU
  sway: f32, // flottement lent (0 si mouvement réduit)
  swayY: f32,
  drift: f32, // horloge du vent dans les nuages (0 si mouvement réduit)
  px: f32,
  py: f32,
  blood: f32, // variante : 1 = lune de sang
  dawn: f32, // variante : 1 = lueur de l’aube à l’horizon (finale)
}
@group(0) @binding(0) var<uniform> params: Params;

// Scène : au-dessus d’une mer de nuages (deux couches fbm 2D sur des plans horizontaux, avec parallaxe entre elles), une lune immense,
// des étoiles, de la brume à l’horizon. À forte paranoïa, une minuscule silhouette se tient au loin sur les nuages, à observer.
// Tout dérive lentement ; aucun terme global de luminance piloté par le temps.

var<private> MOON_DIR: vec3f;

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn h31(p: vec3f) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
fn vnoise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(h31(i), h31(i + vec3f(1, 0, 0)), u.x), mix(h31(i + vec3f(0, 1, 0)), h31(i + vec3f(1, 1, 0)), u.x), u.y);
  let b = mix(mix(h31(i + vec3f(0, 0, 1)), h31(i + vec3f(1, 0, 1)), u.x), mix(h31(i + vec3f(0, 1, 1)), h31(i + vec3f(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
fn n2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1, 0)), u.x), mix(h21(i + vec2f(0, 1)), h21(i + vec2f(1, 1)), u.x), u.y);
}
fn fbm(p: vec2f, oct: i32) -> f32 {
  var a = 0.5;
  var s = 0.0;
  var q = p;
  for (var i = 0; i < oct; i++) {
    s += a * n2(q);
    q = vec2f(q.x * 1.6 - q.y * 1.2, q.x * 1.2 + q.y * 1.6) + vec2f(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}
fn tcap(p: vec2f, a: vec2f, b: vec2f, r1: f32, r2: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}
// Silhouette debout, pieds à y=0, ~1 unité de haut.
fn figure_sd(p: vec2f) -> f32 {
  var d = tcap(p, vec2f(-0.04, 0.0), vec2f(-0.04, 0.45), 0.035, 0.05);
  d = min(d, tcap(p, vec2f(0.04, 0.0), vec2f(0.04, 0.45), 0.035, 0.05));
  d = min(d, tcap(p, vec2f(0.0, 0.42), vec2f(0.0, 0.76), 0.09, 0.11));
  d = min(d, tcap(p, vec2f(-0.11, 0.72), vec2f(-0.13, 0.36), 0.03, 0.025));
  d = min(d, tcap(p, vec2f(0.11, 0.72), vec2f(0.13, 0.36), 0.03, 0.025));
  d = min(d, length(p - vec2f(0.0, 0.88)) - 0.075);
  return d;
}

fn sky_col(rd: vec3f, c2: vec2f, mc: vec2f, r: f32, moonCol: vec3f, hazeCol: vec3f, topCol: vec3f, dawnAz: f32) -> vec3f {
  let up = clamp(rd.y, 0.0, 1.0);
  var c = mix(hazeCol, topCol, pow(up, 0.45));
  let a = atan2(rd.x, rd.z);
  // Aube : bande de lueur chaude collée à l’horizon autour de dawnAz.
  let da = a - dawnAz;
  let glow = exp(-up * 7.0) * exp(-da * da * 1.4);
  c += vec3f(1.0, 0.46, 0.30) * 0.55 * glow * params.dawn;
  // Lune dans l’espace écran (reste ronde quel que soit le rapport), avec un halo autour.
  let dm = length(c2 - mc);
  c += moonCol * (0.22 * exp(-dm * 1.6 / r) + 0.5 * exp(-dm * 4.5 / r));
  let disc = 1.0 - smoothstep(r - 0.008, r + 0.004, dm);
  let mp = (c2 - mc) / r;
  let maria = 0.72 + 0.20 * vnoise3(vec3f(mp * 1.8, 1.7)) + 0.12 * vnoise3(vec3f(mp * 5.0, 4.1)) + 0.06 * vnoise3(vec3f(mp * 14.0, 8.3));
  let limb = 1.0 - 0.28 * pow(clamp(length(mp), 0.0, 1.0), 3.0);
  c = mix(c, moonCol * maria * limb * mix(1.35, 0.7, params.dawn), disc);
  // Étoiles (moins nombreuses à l’aube), s’estompent près de la lune.
  let sp = vec2f(a, asin(clamp(rd.y, -1.0, 1.0))) * 80.0;
  let cell = floor(sp);
  let fp = fract(sp) - 0.5;
  let star = step(0.962, h21(cell)) * smoothstep(0.17, 0.0, length(fp + (vec2f(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.5));
  c += vec3f(0.8, 0.85, 1.0) * star * (0.3 + 0.7 * h21(cell + 1.3)) * smoothstep(0.02, 0.3, up) * (1.0 - disc) * (1.0 - 0.8 * params.dawn) * (1.0 - exp(-dm * 3.0 / r) * 0.8);
  return c;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = params.paranoia;
  let res = vec2f(params.width, params.height);
  let fc = vec2f(uv.x, 1.0 - uv.y) * res;
  let c2 = (fc * 2.0 - res) / min(res.x, res.y);

  let land = smoothstep(0.7, 1.3, res.x / res.y);
  let moonElev = mix(0.80, 0.50, land) - 0.14 * params.dawn;
  let moonAz = mix(-0.12, -0.40, land);
  MOON_DIR = vec3f(sin(moonAz) * cos(moonElev), sin(moonElev), cos(moonAz) * cos(moonElev));
  let moonR = mix(0.55, 0.52, land) * (1.0 + 0.10 * p) * (1.0 - 0.12 * params.dawn);
  let dawnAz = mix(0.35, 0.55, land);

  let yaw = params.sway + params.px * 0.06;
  let pitch = mix(0.12, 0.14, land) + params.swayY - params.py * 0.04;
  var rd = normalize(vec3f(c2.x, c2.y, 1.3));
  let cp = cos(pitch); let sp = sin(pitch);
  rd = vec3f(rd.x, rd.y * cp + rd.z * sp, rd.z * cp - rd.y * sp);
  let cy = cos(yaw); let sy = sin(yaw);
  rd = vec3f(rd.x * cy + rd.z * sy, rd.y, rd.z * cy - rd.x * sy);
  let mcBase = mix(vec2f(-0.15, 1.15), vec2f(-0.62, 0.62), land) - vec2f(0.0, 0.3 * params.dawn);
  let mc = mcBase - vec2f(yaw, pitch - mix(0.12, 0.14, land)) * 1.3;
  let ro = vec3f(params.px * 0.5, params.py * 0.2, 0.0);

  // Palette selon la variante : lune pâle, lune de sang, aube.
  let blood = params.blood;
  let dawn = params.dawn;
  let moonCol = mix(mix(vec3f(0.88, 0.93, 1.0), vec3f(0.98, 0.88, 0.84), dawn), vec3f(0.95, 0.12, 0.06), blood) * mix(1.0, 0.95, dawn);
  let hazeCol = mix(mix(vec3f(0.16, 0.20, 0.34), vec3f(0.30, 0.07, 0.10), blood), vec3f(0.62, 0.40, 0.46), dawn);
  let topCol = mix(mix(vec3f(0.012, 0.018, 0.06), vec3f(0.05, 0.008, 0.02), blood), vec3f(0.08, 0.16, 0.28), dawn);
  let shadowCol = mix(mix(vec3f(0.07, 0.09, 0.18), vec3f(0.12, 0.03, 0.05), blood), vec3f(0.22, 0.20, 0.30), dawn);
  let litCol = mix(mix(vec3f(0.55, 0.64, 0.86), vec3f(0.75, 0.15, 0.14), blood), vec3f(0.95, 0.66, 0.60), dawn);

  var col = vec3f(0.0);
  let a = atan2(rd.x, rd.z);
  let e = asin(clamp(rd.y, -1.0, 1.0));

  if (rd.y >= 0.0) {
    col = sky_col(rd, c2, mc, moonR, moonCol, hazeCol, topCol, dawnAz);
    // Silhouette lointaine qui observe depuis les nuages (apparaît avec la paranoïa).
    let fa = mix(0.30, 0.52, land);
    let feetE = -0.012;
    let sc = 0.075;
    let wp = vec2f((a - fa) * cos(e), e - feetE) / sc;
    let wd = figure_sd(wp) * sc;
    let wa = (1.0 - smoothstep(-0.0008, 0.0012, wd)) * smoothstep(0.5, 0.85, p);
    col = mix(col, vec3f(0.004, 0.005, 0.012), wa);
  } else {
    // Mer de nuages : deux couches horizontales, la plus proche d’abord ; la plus basse se voit par les trouées, plus sombre.
    let wind = vec2f(params.drift * 0.06, params.drift * 0.025);
    var acc = vec3f(0.0);
    var T = 1.0;
    let mxz = normalize(MOON_DIR.xz);
    for (var i = 0; i < 2; i++) {
      let h = select(1.5, 3.2, i == 1);
      let t = h / -rd.y;
      let g = (ro + rd * t).xz;
      let q = g * 0.3 + wind * (1.0 + 0.6 * f32(i)) + vec2f(f32(i) * 11.0, 0.0);
      let oct = select(5, 3, i == 1);
      let d = mix(fbm(q, oct), 0.55, 1.0 - exp(-t * 0.03));
      let cov = select(smoothstep(0.34, 0.66, d), smoothstep(0.28, 0.58, d), i == 1);
      // Lumière du côté de la lune : gradient de densité vers la lune.
      let dl = select(mix(fbm(q + mxz * 0.1, oct), 0.55, 1.0 - exp(-t * 0.03)), d, i == 1);
      var shade = clamp(0.62 + (d - dl) * 8.0, 0.0, 1.0);
      shade = mix(shade, 0.5, f32(i) * 0.5);
      var c = mix(shadowCol, litCol, shade * shade * mix(1.0, 0.45, f32(i)));
      // Scintillement lunaire sur les nuages sous la lune.
      let rm = normalize(vec3f(rd.x, -rd.y, rd.z));
      c += moonCol * 0.25 * pow(max(dot(rm, MOON_DIR), 0.0), 18.0) * mix(1.0, 0.4, f32(i));
      // Perspective atmosphérique.
      let hz = 1.0 - exp(-t * 0.03);
      c = mix(c, hazeCol, hz);
      acc += T * cov * c;
      T *= 1.0 - cov;
    }
    // Sous les nuages : un abîme profond et sombre.
    acc += T * mix(vec3f(0.006, 0.01, 0.03), shadowCol * 0.6, 0.5);
    col = acc;
  }

  // Étalonnage : apaise le centre pour la porte/le texte, vignette, tramage.
  let cc = length(c2 * vec2f(0.8, 0.6));
  col *= mix(0.72, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.33 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.55);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
