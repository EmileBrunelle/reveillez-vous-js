struct Params {
  time: f32,
  height: f32, // canvas height in DEVICE pixels
  motion: f32,
  paranoia: f32, // 0..1
  width: f32, // canvas width in DEVICE pixels
}
@group(0) @binding(0) var<uniform> params: Params;

// Time arrives wrapped to [0, PERIOD). Every time-driven term is sin/fract of t * (n * 2*pi/PERIOD) with n an
// integer, so the wrap at PERIOD is seamless. Frequencies used (Hz = n/100):
//   flicker 37 (0.37 Hz) and 150 (1.5 Hz); band 7 (0.07 Hz); tracking line 9 (0.09 Hz), gate 11 (0.11 Hz),
//   line wobble 300 (3 Hz, position only); grain re-seeds at 30 Hz (30*100 integer steps).
const W: f32 = 6.28318531 / 100.0;
const TAU: f32 = 6.28318531;

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

// Signed distance to a rounded box (half-size b, radius r).
fn sd_round(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Premultiplied-alpha overlay. Brightness-safe (WCAG 2.3.1): all strength comes from STATIC/spatial features
// (scanlines, phosphor mask, bezel, vignette, glass, fringes); the only global time term is a <= ~3.5% flicker
// at <= 1.5 Hz, gated by params.motion (0 = reduced motion = fully static).
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = params.paranoia;
  let t = params.time * params.motion;
  let px = uv * vec2f(params.width, params.height); // device pixels
  let aspect = params.width / params.height;

  // Scanlines: exact 3-device-pixel period (integer => no moiré at 1x/1.5x/2x DPR), one dark row in three,
  // with a slow static thickness modulation down the screen.
  let row = floor(px.y);
  let prof = 0.5 - 0.5 * cos(TAU * (row + 0.5) / 3.0);
  let thick = 0.85 + 0.15 * sin(uv.y * 23.0);
  var dark = (0.26 + 0.14 * p) * prof * thick + 0.03;

  // Curved-glass vignette + rounded bezel (rounded-box SDF in aspect-correct units, y in [-0.5, 0.5]).
  // Phone/portrait fix: on a narrow screen the legacy bezel/fringe (tied to the HEIGHT: ~250 px of dimming across a
  // 390 px phone) swallowed text near the sides. `land` = 0 portrait .. 1 landscape: landscape keeps the legacy look,
  // portrait uses bands measured from the SHORTER side (m) so they stay a few px wide.
  let land = smoothstep(0.7, 1.4, aspect);
  let m = min(params.width, params.height);
  let half = vec2f(params.width, params.height) / (2.0 * m);
  let cn = (uv - vec2f(0.5)) * vec2f(params.width, params.height) / m;
  let rr = 0.05 + 0.02 * p;
  let sd_new = sd_round(cn, half, rr);
  let c = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);
  let sd = sd_round(c, vec2f(0.5 * aspect, 0.5), rr);
  let bezel = mix(smoothstep(-0.05, 0.0, sd_new), smoothstep(-0.30, 0.0, sd), land);
  dark = dark + bezel * (0.38 + 0.22 * p);
  let c2 = uv - vec2f(0.5);
  let vig = mix(smoothstep(0.16 - 0.04 * p, 0.55, dot(c2, c2)), smoothstep(0.10 - 0.05 * p, 0.55, dot(c2, c2)), land);
  dark = dark + vig * (0.30 + 0.20 * p);

  // Flicker: two slow sines, independent of paranoia, total swing <= ~3.5% of alpha.
  let flick = 0.012 * sin(t * 37.0 * W) + 0.008 * sin(t * 150.0 * W);
  dark = dark + flick * params.motion;

  // Grain: zero-mean, fine, re-seeded at 30 Hz.
  let n = hash(floor(px * 0.5) + vec2f(fract(floor(t * 30.0) * 0.6180339) * 91.0, floor(t * 30.0) % 7.0));
  dark = dark + (n - 0.5) * (0.04 + 0.06 * p);

  // Slow soft rolling band: 0.07 Hz, wide soft edges, low contrast.
  let band = fract(t * 0.07);
  dark = dark + smoothstep(0.18, 0.0, abs(uv.y - band)) * 0.12 * p * params.motion;

  // Thin tracking line: moves (and wobbles ~3 Hz in position), never changes global brightness. Appears
  // during ~1 gate window every ~9 s; tiny area, low contrast.
  let gate = smoothstep(0.55, 0.9, sin(t * 11.0 * W)) * params.motion;
  let ly = fract(t * 0.09 + 0.012 * sin(t * 300.0 * W));
  let line = smoothstep(0.004, 0.0, abs(uv.y - ly)) * gate * (0.2 + 0.3 * p);
  dark = dark + line * 0.35;
  let linelight = line * 0.12;

  // Phosphor / aperture-grille mask: vertical R,G,B stripes, 1 device pixel each (period 3 px, integer).
  let k = u32(floor(px.x)) % 3u;
  let stripe = vec3f(select(0.0, 1.0, k == 0u), select(0.0, 1.0, k == 1u), select(0.0, 1.0, k == 2u));
  var col = stripe * (0.035 + 0.035 * p);

  // Soft edge chromatic fringes (red left, cyan/blue right).
  // Portrait: confined to the last ~4-6% of the short side (text stays clean); landscape: legacy.
  let ex = abs(c2.x);
  let edge_new = smoothstep(0.04 + 0.02 * p, 0.0, half.x - abs(cn.x));
  let edge_old = smoothstep(0.20 - 0.08 * p, 0.5, ex);
  let edge = mix(edge_new, edge_old, land) * (0.14 + 0.26 * p);
  col = col + vec3f(select(0.0, 1.0, c2.x < 0.0) * edge * 0.6, 0.0, select(0.0, 1.0, c2.x >= 0.0) * edge * 0.6);

  // Bloom-like phosphor glow: faint green-cyan tint, strongest mid-screen.
  col = col + vec3f(0.0, 0.035, 0.03) * (1.0 - smoothstep(0.0, 0.4, dot(c2, c2)));

  // Glass reflection: soft white highlight near the top-left corner (static).
  let g = (uv - vec2f(0.16, 0.14)) * vec2f(1.0, aspect * 1.6);
  col = col + vec3f(0.07) * (1.0 - smoothstep(0.0, 0.22, length(g))) + vec3f(linelight);

  var a = clamp(dark, 0.0, 0.9);
  // Outside the rounded bezel: opaque black corners.
  let outside = smoothstep(-0.004, 0.004, sd);
  a = mix(a, 1.0, outside);
  col = col * (1.0 - outside);
  return vec4f(col, min(a + edge * 0.3, 1.0));
}
