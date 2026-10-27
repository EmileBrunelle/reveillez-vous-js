import { ld_scatter, ld_motes, ld_haze } from "./lightDust.wgsl";

struct Params {
  time: f32, // window clock (fixed when reduced motion)
  width: f32,
  height: f32,
  paranoia: f32, // 0..1, eased on the CPU
  sway: f32,
  swayY: f32,
  drift: f32, // precipitation clock (0 when reduced motion)
  px: f32,
  py: f32,
  weather: f32, // variant: 0 clear, 1 light rain (wet street), 2 snow
  cold: f32, // variant: share of cold-lit windows 0..1
}
@group(0) @binding(0) var<uniform> params: Params;

// Scene: a narrow village street at night, camera in the middle of the road looking down it.
// Two facades (planes x = +-W) with pitched roofs and dormers, outdoor staircases, a lamppost and a parked car.
// Windows wake up one by one (2 s apart, 1.5 s fade): the neighbours watch. No global luminance term.

const W: f32 = 3.4;
const EYE: f32 = 1.6;
const CELL: f32 = 6.0;
const ROOFK: f32 = 0.85;
const ROOFW: f32 = 3.2;
const FAR: f32 = 130.0;
const LAMP: vec3f = vec3f(-2.4, 4.3, 9.0);
const MOON: vec3f = vec3f(0.0875, 0.479, 0.873);
var<private> PIX: f32;

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
fn band(d: f32, w: f32, pw: f32) -> f32 { return 1.0 - smoothstep(w - pw, w + pw, abs(d)); }

fn house_h(side: f32, cell: f32) -> f32 { return 6.1 + 1.5 * h21(vec2f(cell * 1.7 + side, side * 5.3 + 2.0)); }

// Window state: rgb = emitted colour (already scaled), a = lit 0..1.
// 5 slots per house (2 floors x 2 columns + dormer), 12 houses per side: 120 windows, ranks permuted mod 127,
// each woken 2 s after the previous one, lit for 100 s, 1.5 s fade in, 3 s fade out.
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

// Silhouette presence grows smoothly with paranoia (no pop while it eases).
fn sil_gate(h: f32) -> f32 {
  let thr = smoothstep(0.35, 0.9, params.paranoia) * 0.6;
  return smoothstep(h - 0.06, h + 0.06, thr) * smoothstep(0.0, 0.05, thr);
}

fn person(lp: vec2f) -> f32 {
  let head = 1.0 - smoothstep(0.15, 0.18, length((lp - vec2f(0.0, 0.14)) * vec2f(1.0, 0.9)));
  let sh = 1.0 - smoothstep(0.88, 1.0, length((lp - vec2f(0.0, -0.52)) / vec2f(0.40, 0.42)));
  return max(head, sh);
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
  // Light: ambient + lamppost.
  let wcl = clamp(params.weather - 1.0, 0.0, 1.0);
  let amb = mix(vec3f(0.06, 0.075, 0.135), vec3f(0.045, 0.05, 0.075), step(0.5, params.weather)) + vec3f(0.04, 0.045, 0.06) * wcl;
  let n = vec3f(-s, 0.0, 0.0);
  let L = LAMP - P;
  let d2 = dot(L, L);
  let lamp = vec3f(1.0, 0.68, 0.32) * 15.0 / (4.0 + d2) * max(dot(n, L) * inverseSqrt(d2), 0.0);
  var col = alb * (amb + lamp);

  // Windows / door
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
    var glass = vec3f(0.012, 0.020, 0.040) + amb * 0.5;
    let sil = person(lp) * sil_gate(h21(vec2f(cell * 3.1, f * 2.0 + c + s)));
    glass += ws.rgb * ws.a * (1.0 - 0.93 * sil) * (0.9 - 0.2 * length(lp));
    let mull = max(band(wu, 0.03, pw), band(wv, 0.03, pw));
    let frame = max(step(0.44, abs(wu)), step(0.64, abs(wv)));
    let fcol = alb * 0.7 + amb * 0.5 + ws.rgb * ws.a * 0.05;
    glass = mix(glass, fcol, max(mull, frame) * 0.85);
    col += ws.rgb * ws.a * 0.11 * exp(-length(vec2f(wu, wv * 0.7)) * 1.6) * (1.0 - ins);
    col = mix(col, glass, ins);
  }

  // Outdoor staircase (dark ironwork) + landing in front of the door
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
  let isClear = 1.0 - step(0.5, params.weather);
  let isSnow = step(1.5, params.weather);
  let hor = mix(mix(vec3f(0.14, 0.17, 0.30), vec3f(0.17, 0.13, 0.15), step(0.5, params.weather)), vec3f(0.30, 0.31, 0.38), isSnow);
  let top = mix(mix(vec3f(0.010, 0.018, 0.055), vec3f(0.05, 0.055, 0.08), step(0.5, params.weather)), vec3f(0.12, 0.13, 0.17), isSnow);
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
  return vec3f(1.0, 0.68, 0.32) * (1.1 * exp(-a * 300.0) + 0.22 * exp(-a * 30.0) + 0.04 * exp(-a * 6.0));
}

// Facades, roofs and sky. Returns (colour, distance); no ground, no props.
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
  // Pitched roof: y = H + (s*x - W) * K for s*x - W in [0, ROOFW]; H taken from the cell where the ray lands.
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
      let wcl = clamp(params.weather - 1.0, 0.0, 1.0);
      var col = mix(vec3f(0.020, 0.026, 0.040), vec3f(0.30, 0.33, 0.40), wcl) * (0.7 + 0.6 * vnoise(vec3f(P.z * 2.0, u * 8.0, 2.0)));
      let L = LAMP - P;
      let d2 = dot(L, L);
      col *= 1.0 + 12.0 * (1.0 - wcl * 0.7) / (4.0 + d2) * max(dot(nrm, L) * inverseSqrt(d2), 0.0);
      col += vec3f(0.05, 0.07, 0.11) * (1.0 - step(0.5, params.weather)) * max(dot(nrm, MOON), 0.0);
      col += vec3f(0.01, 0.012, 0.02);
      // Dormer decal.
      let hasD = step(h21(vec2f(cell + 5.0, s + 41.0)), 0.55);
      let dx = zl - 3.0;
      let dv = u - 1.05;
      let inD = (1.0 - smoothstep(0.7 - pw, 0.7, abs(dx))) * (1.0 - smoothstep(0.55 - pw, 0.55, abs(dv))) * hasD;
      if (inD > 0.0) {
        let ws = win_state(s, cell, 4.0);
        let lp = vec2f(dx, dv * 1.4);
        var g = vec3f(0.010, 0.016, 0.03) + ws.rgb * ws.a * (0.8 - 0.3 * length(lp));
        let sil = person(lp * 1.1) * sil_gate(h21(vec2f(cell * 3.1, 9.0 + s)));
        g = mix(g, vec3f(0.01), 0.9 * sil * ws.a);
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
  let isSnow = step(1.5, params.weather);
  return mix(mix(vec3f(0.07, 0.09, 0.17), vec3f(0.08, 0.075, 0.095), step(0.5, params.weather)), vec3f(0.22, 0.23, 0.29), isSnow);
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
  let isRain = select(0.0, 1.0, abs(params.weather - 1.0) < 0.5);
  let isSnow = step(1.5, params.weather);

  let e = env(ro, rd);
  var col = e.xyz;
  var t = e.w;
  let fogc = fog_col();

  // Ground
  var tg = 1e9;
  if (rd.y < -0.0001) { tg = -ro.y / rd.y; }
  if (tg < t) {
    let g = ro + rd * tg;
    t = tg;
    let side = smoothstep(2.3, 2.5, abs(g.x));
    let nz = vnoise(vec3f(g.xz * 0.9, 1.0)) * 0.6 + vnoise(vec3f(g.xz * 4.0, 5.0)) * 0.4;
    var alb = mix(vec3f(0.16, 0.17, 0.20), vec3f(0.24, 0.23, 0.24), side) * (0.6 + 0.8 * nz);
    alb = mix(alb, vec3f(0.42, 0.45, 0.52) * (0.8 + 0.3 * nz), isSnow);
    let L = LAMP - g;
    let d2 = dot(L, L);
    let lampL = vec3f(1.0, 0.68, 0.32) * 15.0 / (4.0 + d2) * max(L.y * inverseSqrt(d2), 0.0);
    let amb = mix(vec3f(0.06, 0.075, 0.135), vec3f(0.07, 0.08, 0.11), isSnow);
    col = alb * (amb * 1.6 + lampL * 1.6);
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

  // Props: lamp mast + head, parked car.
  if (abs(rd.z) > 0.001) {
    let tm = (LAMP.z - ro.z) / rd.z;
    if (tm > 0.0 && tm < t) {
      let q = ro + rd * tm;
      let dx = q.x - LAMP.x;
      let mast = band(dx, 0.06, tm * PIX) * step(0.0, q.y) * step(q.y, 4.3);
      let head = band(dx, 0.20, tm * PIX) * step(4.28, q.y) * step(q.y, 4.52);
      if (head > 0.0) {
        col = mix(col, vec3f(1.0, 0.82, 0.5) * 1.5, head);
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
    col = vec3f(0.014, 0.016, 0.022) + vec3f(1.0, 0.68, 0.32) * lit * 0.09 + vec3f(0.01, 0.015, 0.03) * max(n.y, 0.0);
    t = car.x;
  }

  // Fog by distance, lamp halo on top.
  if (t < 900.0) { col = mix(col, fogc, 1.0 - exp(-min(t, 100.0) * 0.034)); }
  col += glow_lamp(ro, rd);

  // Lumière volumétrique : cône du lampadaire, poussière révélée par la lumière, brume lunaire (lightDust.wgsl).
  // Variation spatiale seulement avec la paranoïa ; respiration < 0,1 Hz et ±5 %.
  {
    let tv = min(t, 60.0);
    let pa = params.paranoia;
    let breath = 1.0 + 0.05 * sin(params.drift * 0.5);
    let warm = vec3f(1.0, 0.68, 0.32);
    let fogK = (0.18 + 0.07 * pa) * breath * (1.0 - 0.5 * isSnow);
    col += warm * ld_scatter(ro, rd, tv, LAMP, fogK);
    col += warm * ld_motes(ro, rd, tv, LAMP, params.drift, 0.95 + 0.05 * pa, PIX) * (3.2 + 1.2 * pa) * breath * (1.0 - 0.4 * isSnow);
    let hz = ld_haze(ro, rd, tv, params.drift);
    col += vec3f(0.12, 0.17, 0.30) * hz * (0.10 + 0.07 * pa) * (1.0 - 0.6 * isSnow) * (0.6 + 0.4 * smoothstep(-0.3, 0.9, dot(rd, MOON)));
  }

  // Precipitation (screen space, low contrast; frozen when reduced motion)
  if (isRain > 0.5) {
    let cx = floor(fc.x / 2.0);
    let r = h11(cx);
    let yy = fract(fc.y * 0.012 / (0.6 + r) + params.drift * (0.5 + 0.6 * r) + r * 7.0);
    let streak = smoothstep(0.0, 0.5, yy) * (1.0 - smoothstep(0.5, 0.56, yy)) * step(0.82, h11(cx * 1.3 + 4.0));
    col += vec3f(0.30, 0.36, 0.5) * streak * 0.07;
  }
  if (isSnow > 0.5) {
    for (var l = 0; l < 2; l++) {
      let size = select(14.0, 26.0, l == 1);
      var q = fc / size;
      q.y += params.drift * select(0.45, 0.8, l == 1);
      q.x += sin(params.drift * 0.6 + floor(q.y) * 1.7) * 0.25 + f32(l) * 7.3;
      let cell = floor(q);
      let fp = fract(q) - vec2f(0.3 + 0.4 * h21(cell), 0.3 + 0.4 * h21(cell + 4.1));
      let fl = smoothstep(select(0.16, 0.22, l == 1), 0.02, length(fp)) * step(0.55, h21(cell + 8.7));
      col += vec3f(0.55, 0.6, 0.7) * fl * 0.2;
    }
  }

  // Grade: calm the centre for the door/text, vignette, dither.
  let cc = length(c2 * vec2f(0.8, 0.6));
  col *= mix(0.72, 1.0, smoothstep(0.0, 1.1, cc));
  col *= 1.0 - 0.35 * smoothstep(0.6, 1.5, length(c2));
  col = col / (1.0 + col * 0.6);
  col += (h21(fc) - 0.5) / 255.0;
  return vec4f(max(col, vec3f(0.0)), 1.0);
}
