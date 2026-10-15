struct Params {
  time: f32, // secondes (0 en mouvement réduit : pas de tourbillon)
  motion: f32, // 1 = animé, 0 = mouvement réduit
  done: f32, // 0..1 : dissipation finale de la brume
  seed: f32, // décale le motif de brume d’une visite à l’autre
  // 8 coups récents (trace humide) : xy = position (disque unité, y vers le bas), z = âge en secondes, w = poids (0 = inactif)
  p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
  // Grille de couverture 16 × 16 : 16 rangées de 16 bits, chaque rangée un entier stocké dans un f32 (exact < 2^24).
  // Rangée j = g[j / 4][j % 4] ; bit i (valeur 2^i) = colonne i. C’est la seule source de la brume dissipée en permanence.
  g0: vec4f, g1: vec4f, g2: vec4f, g3: vec4f,
}
@group(0) @binding(0) var<uniform> params: Params;

// Boule de cristal : brume en tourbillon (fbm tordu), éclaircie autour des coups de chiffon,
// et, derrière, un œil qui apparaît par endroits à mesure que la brume se dissipe. Aucun terme de luminance globale
// piloté par le temps : le tourbillon ne déplace que des motifs (WCAG 2.3.1).

const WIPE_R: f32 = 0.27;

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1, 0)), u.x), mix(h21(i + vec2f(0, 1)), h21(i + vec2f(1, 1)), u.x), u.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2f(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// Trace humide d’un coup récent : éclaircie douce qui s’efface en ~1,6 s (la couverture permanente vient de la grille).
fn wipe_of(p: vec4f, uv: vec2f) -> f32 {
  if (p.w <= 0.0) { return 0.0; }
  let d = length(uv - p.xy);
  let fade = 1.0 - smoothstep(0.3, 1.6, p.z);
  return (1.0 - smoothstep(WIPE_R * 0.35, WIPE_R, d)) * fade * p.w;
}

fn clear_at(uv: vec2f) -> f32 {
  var c = wipe_of(params.p0, uv);
  c = max(c, wipe_of(params.p1, uv));
  c = max(c, wipe_of(params.p2, uv));
  c = max(c, wipe_of(params.p3, uv));
  c = max(c, wipe_of(params.p4, uv));
  c = max(c, wipe_of(params.p5, uv));
  c = max(c, wipe_of(params.p6, uv));
  c = max(c, wipe_of(params.p7, uv));
  return c;
}

// Bit (i, j) de la grille : 1 si la cellule a été essuyée, 0 hors grille. Miroir de decodeCell (crystalMath.ts).
fn cell(i: i32, j: i32) -> f32 {
  if (i < 0 || j < 0 || i > 15 || j > 15) { return 0.0; }
  var g = array<vec4f, 4>(params.g0, params.g1, params.g2, params.g3);
  let row = g[j / 4][j % 4];
  let pw = exp2(f32(i));
  return floor(row / pw) - 2.0 * floor(row / (2.0 * pw));
}

// Couverture lissée (interpolation bilinéaire des 4 cellules voisines) en uv disque unité.
fn coverage_at(uv: vec2f) -> f32 {
  let g = (uv * 0.5 + 0.5) * 16.0 - 0.5;
  let i0 = vec2i(floor(g));
  let f = fract(g);
  let a = mix(cell(i0.x, i0.y), cell(i0.x + 1, i0.y), f.x);
  let b = mix(cell(i0.x, i0.y + 1), cell(i0.x + 1, i0.y + 1), f.x);
  return mix(a, b, f.y);
}

// Œil stylisé : amande, iris et pupille. Renvoie (lumière 0..1, pupille 0..1).
fn eye(p: vec2f) -> vec2f {
  let hw = clamp(1.0 - (p.x / 0.5) * (p.x / 0.5), 0.0, 1.0);
  let lidH = 0.2 * hw;
  let lid = (1.0 - smoothstep(lidH - 0.03, lidH + 0.01, abs(p.y))) * step(abs(p.x), 0.5);
  let iris = 1.0 - smoothstep(0.15, 0.18, length(p));
  let pupil = 1.0 - smoothstep(0.04, 0.065, length(p * vec2f(2.4, 1.0)));
  return vec2f(lid * (0.4 + 0.6 * iris), pupil * lid);
}

@fragment fn fs_main(@location(0) uvIn: vec2f) -> @location(0) vec4f {
  let uv = (uvIn * 2.0 - 1.0); // disque unité, y vers le bas
  let r = length(uv);
  let aa = 0.012;
  let disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (disc <= 0.0) { return vec4f(0.0); }

  let t = params.time * params.motion;
  // Brume : tourbillon lent (rotation dépendant du rayon) + deux couches de bruit.
  let ang = 0.18 * t * (1.2 - r) + 0.8 * r;
  let ca = cos(ang);
  let sa = sin(ang);
  let rp = vec2f(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca) * 2.1 + vec2f(params.seed * 7.3, params.seed * 3.1);
  let warp = vec2f(fbm(rp + vec2f(0.0, t * 0.11)), fbm(rp + vec2f(5.2, 1.3 - t * 0.09)));
  let f = fbm(rp + warp * 1.7);
  let density = clamp(0.55 + (f - 0.5) * 1.3, 0.0, 1.0);

  // Bord de la zone essuyée déformé par le bruit de brume : aucune trace de la grille.
  let cov = smoothstep(0.2, 0.75, coverage_at(uv) + (f - 0.5) * 1.2);
  let wiped = clamp(max(clear_at(uv), cov) + params.done, 0.0, 1.0);
  // Les trouées ouvrent d’abord là où la brume est mince : bord irrégulier plutôt qu’un disque net.
  let fog = clamp(density * (1.0 - smoothstep(0.15, 0.95, wiped + (0.5 - density) * 0.25 * wiped)), 0.0, 1.0);

  // Fond du cristal : dégradé sombre violacé, léger éclat intérieur.
  var col = mix(vec3f(0.05, 0.03, 0.10), vec3f(0.14, 0.09, 0.24), smoothstep(0.0, 1.0, 1.0 - r));
  // Œil au centre, visible à travers les trouées (fog bas).
  let e = eye(uv * 1.4);
  let seen = 1.0 - fog;
  col += vec3f(0.95, 0.72, 0.35) * e.x * 0.55 * seen;
  col = mix(col, vec3f(0.02, 0.0, 0.04), e.y * seen * 0.9);

  // Brume : gris lilas, plus claire au cœur des volutes.
  let fogCol = mix(vec3f(0.50, 0.50, 0.62), vec3f(0.82, 0.82, 0.90), f);
  col = mix(col, fogCol, fog * 0.92);

  // Verre : bord assombri, reflet en haut à gauche, liseré clair.
  col *= 1.0 - 0.45 * smoothstep(0.55, 1.0, r);
  let hl = 1.0 - smoothstep(0.0, 0.34, length(uv - vec2f(-0.42, -0.5)));
  col += vec3f(0.55, 0.6, 0.75) * hl * 0.28;
  col += vec3f(0.35, 0.3, 0.55) * smoothstep(0.93, 0.995, r) * 0.5;

  return vec4f(col * disc, disc);
}
