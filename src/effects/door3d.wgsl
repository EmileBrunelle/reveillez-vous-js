struct Params {
  width: f32,
  height: f32,
  angle: f32, // ouverture du battant en radians (positif = vers l’intérieur), ressort du cognement inclus
  shadows: f32, // 1 = ombre douce du battant (0 : tactile, écran étroit)
  lx: f32, // direction vers la lumière du lieu (normalisée côté CPU)
  ly: f32,
  lz: f32,
  lr: f32, // couleur de la lumière du lieu
  lg: f32,
  lb: f32,
  ar: f32, // ambiance (ciel de nuit)
  ag: f32,
  ab: f32,
  wr: f32, // bois ou métal du battant
  wg: f32,
  wb: f32,
  pr: f32, // panneaux
  pg: f32,
  pb: f32,
  fr: f32, // chambranle et linteau
  fg: f32,
  fb: f32,
  mr: f32, // quincaillerie (poignée, heurtoir, charnières)
  mg: f32,
  mb: f32,
  style: f32, // 0 = panneaux, 1 = planches (cabane), 2 = fer riveté (mausolée)
  cols: f32, // grille des panneaux
  rows: f32,
  shine: f32, // 0..1 : battant métallique (reflet plus serré)
  interior: f32, // 0..1 : opacité de l’intérieur chaud (0 : les calques de DoorScene derrière restent visibles)
  mist: f32, // 0..1 : brume au pied
  emblem: f32, // 1 = étoile dorée incrustée à la place du heurtoir (nuages)
  kind: f32, // encadrement : 0 = chambranle, 1 = imposte en éventail (rue), 2 = mausolée, 3 = contre-porte vitrée (perron), 4 = flottant (nuages)
  oh: f32, // hauteur de l’ouverture (m) ; sous l’arche pour le mausolée, sous l’imposte pour la rue
}
@group(0) @binding(0) var<uniform> params: Params;

// Une porte à panneaux dans son cadre, raymarchée. Unités : mètres. Le mur est un plan z = 0 invisible (transparent) : seuls le chambranle,
// le seuil, le linteau, l’embrasure et le battant sont dessinés. Le battant pivote autour de l’axe de ses charnières (x = -OW, z = HINGE_Z),
// vers l’intérieur (+z, loin de la caméra), comme le `rotateY` positif de DoorScene. Aucun terme ne dépend du temps : l’image ne change
// que si l’angle, la lumière ou la taille changent (rendu à la demande).

const OW: f32 = 0.45; // demi-largeur de l’ouverture
const OT: f32 = 1.70; // haut de l’encadrement (chambranle, ou imposte de la rue) : le linteau est posé dessus
const WALL: f32 = 0.16; // épaisseur du mur (profondeur de l’embrasure)
const LEAF_T: f32 = 0.05; // épaisseur du battant
const LEAF_Z: f32 = 0.03; // face avant du battant fermé (en retrait du nu du mur)
const HINGE_Z: f32 = 0.08; // axe des charnières (face arrière du battant)
const CAM_D: f32 = 6.0; // distance de la caméra (perspective douce, proche du SVG de face)
const CAM_Y: f32 = 0.93;
const HALF_W: f32 = 0.6; // demi-largeur visible au plan z = 0 (viewBox 120 × 190 → 1,2 m × 1,9 m)
const HALF_H: f32 = 0.95;

var<private> LDIR: vec3f;
var<private> OH: f32; // hauteur de l’ouverture (`params.oh`)
var<private> KIND: i32; // `params.kind`
var<private> ARCH_Y: f32; // mausolée : naissance de l’arche en plein cintre (rayon OW)

// Contre-porte vitrée du perron (repère du battant) : cadre fin à 9–11,5 cm devant la face, traverse au milieu.
const STORM_Z0: f32 = -0.115;
const STORM_Z1: f32 = -0.09;
const STORM_BAR: f32 = 0.035;
const STORM_RAIL: f32 = 0.62;

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

fn sd_box(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}
fn sd_rect(p: vec2f, b: vec2f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec2f(0))) + min(max(q.x, q.y), 0.0);
}
// Étoile à cinq branches (Inigo Quilez, sdStar5), pointe en haut.
fn sd_star5(pIn: vec2f, r: f32, rf: f32) -> f32 {
  let k1 = vec2f(0.809016994375, -0.587785252292);
  let k2 = vec2f(-k1.x, k1.y);
  var p = vec2f(abs(pIn.x), pIn.y);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  let ba = rf * vec2f(-k1.y, k1.x) - vec2f(0.0, 1.0);
  let h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

fn sd_torus_xy(p: vec3f, r: f32, t: f32) -> f32 {
  let q = vec2f(length(p.xy) - r, p.z);
  return length(q) - t;
}
fn sd_cyl_y(p: vec3f, r: f32, h: f32) -> f32 {
  let d = vec2f(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0)));
}
fn sd_cyl_z(p: vec3f, r: f32, h: f32) -> f32 {
  return sd_cyl_y(p.xzy, r, h);
}

// Coordonnées locales du battant : origine au coin bas de l’axe des charnières, x vers le bord libre, z = 0 sur la face avant.
fn leaf_local(p: vec3f) -> vec3f {
  let a = params.angle;
  let q = vec3f(p.x + OW, p.y, p.z - HINGE_Z);
  let c = cos(a);
  let s = sin(a);
  return vec3f(q.x * c + q.z * s, q.y, -q.x * s + q.z * c + LEAF_T);
}

// Creux de la face avant (m) : moulures des panneaux, rainures des planches, cadre du fer. Positif = en retrait.
fn relief(x: f32, y: f32) -> f32 {
  let w = 2.0 * OW - 0.006;
  if (params.style > 0.5 && params.style < 1.5) {
    // Planches verticales : rainures en V tous les 15 cm.
    let k = w / 6.0;
    let g = abs(fract(x / k) - 0.5) * k;
    return 0.007 * (1.0 - smoothstep(0.0, 0.008, k * 0.5 - g));
  }
  // Grille de panneaux entre montants (11 cm) et traverses (13 cm).
  let st = select(0.11, 0.08, params.style > 1.5);
  let cw = (w - 2.0 * st - (params.cols - 1.0) * 0.08) / params.cols;
  let ch = (OH - 0.02 - 2.0 * 0.13 - (params.rows - 1.0) * 0.09) / params.rows;
  let ci = clamp(floor((x - st + 0.04) / (cw + 0.08)), 0.0, params.cols - 1.0);
  let ri = clamp(floor((y - 0.13 + 0.045) / (ch + 0.09)), 0.0, params.rows - 1.0);
  let cx = st + ci * (cw + 0.08) + cw * 0.5;
  let cy = 0.13 + ri * (ch + 0.09) + ch * 0.5;
  var e = sd_rect(vec2f(x - cx, y - cy), vec2f(cw * 0.5, ch * 0.5));
  if (KIND == 2) {
    e = max(e, min(y - ARCH_Y, length(vec2f(x - w * 0.5, y - ARCH_Y)) - (OW - 0.1))); // panneaux hauts suivant l’arche
  }
  if (params.style > 1.5) {
    // Fer : panneaux plats légèrement en creux, bord net.
    return 0.006 * smoothstep(0.004, -0.004, e);
  }
  // Panneau à plate-bande : chanfrein descendant puis champ en légère saillie.
  let bevel = smoothstep(0.0, -0.014, e);
  let field = smoothstep(-0.03, -0.045, e);
  return mix(0.014 * bevel, 0.005, field);
}

// Battant seul (distance, matériau 2 = bois/fer, 3 = métal).
fn leaf(p: vec3f) -> vec2f {
  let l = leaf_local(p);
  let w = 2.0 * OW - 0.006;
  var body = sd_box(l - vec3f(w * 0.5, OH * 0.5 + 0.004, LEAF_T * 0.5), vec3f(w * 0.5, OH * 0.5 - 0.006, LEAF_T * 0.5));
  // Mausolée : le haut du battant suit l’arche en plein cintre.
  var arch = -1.0;
  if (KIND == 2) {
    // Garde ce qui est sous la naissance de l’arche, ou dans son demi-cercle.
    arch = min(l.y - ARCH_Y, length(l.xy - vec2f(w * 0.5, ARCH_Y)) - (OW - 0.004));
    body = max(body, arch);
  }
  var storm = 1e5;
  if (KIND == 3) {
    // Contre-porte : cadre et traverse en aluminium devant le battant, autour de deux vitres (analytiques, voir `storm_glass`).
    let sc = l.xy - vec2f(w * 0.5, OH * 0.5);
    let outer = sd_rect(sc, vec2f(w * 0.5 - 0.004, OH * 0.5 - 0.008));
    let gTop = sd_rect(l.xy - vec2f(w * 0.5, (STORM_RAIL + OH - STORM_BAR) * 0.5 + 0.01), vec2f(w * 0.5 - STORM_BAR, (OH - STORM_BAR - STORM_RAIL) * 0.5 - 0.01));
    let gLow = sd_rect(l.xy - vec2f(w * 0.5, (STORM_RAIL + STORM_BAR) * 0.5 - 0.01), vec2f(w * 0.5 - STORM_BAR, (STORM_RAIL - STORM_BAR) * 0.5 - 0.01));
    let fr2 = max(outer, -min(gTop, gLow));
    storm = max(fr2, abs(l.z - (STORM_Z0 + STORM_Z1) * 0.5) - (STORM_Z1 - STORM_Z0) * 0.5);
    // Poignée en barre, à l’extérieur de la contre-porte.
    storm = min(storm, sd_box(l - vec3f(w - 0.085, 0.53, STORM_Z0 - 0.02), vec3f(0.011, 0.075, 0.009)));
  }
  // Le relief n’est évalué que près de la face avant (coût) ; facteur 0,8 pour la pente des chanfreins.
  if (body > 0.1) {
    // Loin du battant : la quincaillerie (≤ 9 cm de la face) n’est pas évaluée.
    return select(vec2f(body, 2.0), vec2f(storm, 5.0), storm < body);
  }
  var d = body;
  if (body < 0.03) {
    d = max(body, (relief(l.x, l.y) - l.z) * 0.8);
  }
  if (params.style > 0.5 && params.style < 1.5) {
    // Cabane : deux traverses clouées et une écharpe en diagonale, en saillie sur les planches.
    let by = select(abs(l.y - 0.32), abs(l.y - (OH - 0.32)), l.y > OH * 0.5);
    var bt = sd_box(vec3f(l.x - w * 0.5, by, l.z + 0.009), vec3f(w * 0.5 - 0.03, 0.06, 0.009));
    let a0 = vec2f(0.1, 1.3);
    let a1 = vec2f(w - 0.1, 0.4);
    let dir = normalize(a1 - a0);
    let rel = l.xy - (a0 + a1) * 0.5;
    bt = min(bt, sd_box(vec3f(dot(rel, dir), dot(rel, vec2f(-dir.y, dir.x)), l.z + 0.008), vec3f(length(a1 - a0) * 0.5, 0.05, 0.008)));
    d = min(d, bt);
  }
  var res = vec2f(d, 2.0);
  // Poignée (bouton sur tige) et rosace ; plus basse sur la porte courte de la rue, comme le SVG.
  // Chaque pièce n’est détaillée que près de sa sphère englobante (coût) ; plus loin, la sphère sert de borne.
  let kp = l - vec3f(w - 0.08, select(select(0.98, 0.78, KIND == 2), 0.36, KIND == 1), 0.0);
  var m = length(kp - vec3f(0.0, 0.0, -0.04)) - 0.075;
  if (m < 0.02) {
    m = sd_cyl_z(kp - vec3f(0.0, 0.0, -0.025), 0.009, 0.025);
    m = min(m, length(kp - vec3f(0.0, 0.0, -0.055)) - 0.028);
    m = min(m, sd_cyl_z(kp - vec3f(0.0, 0.0, -0.003), 0.03, 0.004));
  }
  // Heurtoir : anneau pendu à une platine, au centre, à hauteur d’yeux.
  let hp = l - vec3f(w * 0.5, OH - 0.40, 0.0);
  let hb = length(hp - vec3f(0.0, 0.0, -0.015)) - 0.1;
  if (KIND == 1) {
    // Rue : fente à lettres en laiton en haut du battant, serrure (platine) au-dessus du bouton.
    let lp = l - vec3f(w * 0.5, OH - 0.16, 0.0);
    let plate = sd_box(lp - vec3f(0.0, 0.0, -0.005), vec3f(0.11, 0.026, 0.005));
    m = min(m, max(plate, -sd_box(lp - vec3f(0.0, 0.0, -0.01), vec3f(0.085, 0.006, 0.02))));
    m = min(m, sd_box(l - vec3f(w - 0.1, 0.56, -0.004), vec3f(0.05, 0.03, 0.004)));
  } else if (params.emblem > 0.5 || KIND == 2) {
    // Pas de heurtoir : l’étoile (nuages) ou le cercle rouge (mausolée) est peint au rendu (voir fs_main).
  } else if (hb < 0.02) {
    m = min(m, sd_box(hp - vec3f(0.0, 0.05, -0.006), vec3f(0.035, 0.03, 0.006)));
    m = min(m, sd_torus_xy(hp - vec3f(0.0, -0.005, -0.018), 0.05, 0.008));
  } else {
    m = min(m, hb);
  }
  if (params.style > 0.5) {
    // Pentures (planches, fer) : bandes de fer clouées depuis les charnières.
    let sy = select(abs(l.y - 0.32), abs(l.y - (OH - 0.32)), l.y > OH * 0.5);
    let sz = select(0.004, 0.022, params.style < 1.5); // sur les traverses de la cabane
    m = min(m, sd_box(vec3f(l.x - 0.26, sy, l.z + sz), vec3f(0.26, 0.022, 0.004)));
  }
  if (params.style > 1.5 && l.z < 0.02) {
    // Fer : rivets tous les 10 cm sur les traverses basse, médiane et haute.
    let rx = (fract(l.x / 0.1) - 0.5) * 0.1;
    let ry = min(abs(l.y - 0.065), min(abs(l.y - OH * 0.494), abs(l.y - select(OH - 0.085, ARCH_Y - 0.02, KIND == 2))));
    let edge = max(0.05 - l.x, l.x - (w - 0.05));
    m = min(m, max(length(vec3f(rx, ry, l.z)) - 0.012, edge));
  }
  if (KIND == 2) {
    m = max(m, arch + 0.03); // rien ne dépasse de l’arche
  }
  if (m < res.x) {
    res = vec2f(m, 3.0);
  }
  if (storm < res.x) {
    res = vec2f(storm, 5.0);
  }
  return res;
}

// Triangle isocèle (Inigo Quilez, sdTriangleIsosceles) : sommet à l’origine, base à y = q.y (q.y < 0 : pointe en haut).
fn sd_tri_iso(pIn: vec2f, q: vec2f) -> f32 {
  let p = vec2f(abs(pIn.x), pIn.y);
  let a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  let b = p - q * vec2f(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  let s = -sign(q.y);
  let d = min(vec2f(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2f(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

// Imposte de la rue : centre et rayon de la demi-lune vitrée, posée sur une traverse de 7 cm au-dessus du battant.
fn fan_center() -> vec2f {
  return vec2f(0.0, OH + 0.07);
}
const FAN_R: f32 = OW - 0.03;

// Mausolée : massif de pierre percé de l’arche, archivolte en saillie, fronton triangulaire et son losange.
fn mausoleum(p: vec3f) -> f32 {
  let r = length(p.xy - vec2f(0.0, ARCH_Y));
  let up = p.y > ARCH_Y;
  let hole = select(abs(p.x) - OW, r - OW, up);
  var d = max(max(sd_rect(p.xy - vec2f(0.0, 0.76), vec2f(OW + 0.16, 0.76)), -hole), abs(p.z + 0.02) - 0.02);
  let band = abs(select(abs(p.x) - (OW + 0.075), r - (OW + 0.075), up)) - 0.04;
  d = min(d, max(max(band, -p.y), abs(p.z + 0.032) - 0.032));
  // Fronton : tympan plat, rampants en saillie, losange en relief ; détaillé seulement près de sa boîte (coût).
  let pb = sd_box(p - vec3f(0.0, 1.695, -0.038), vec3f(0.6, 0.175, 0.038));
  if (pb > 0.02) {
    return min(d, pb);
  }
  let tri = sd_tri_iso(p.xy - vec2f(0.0, 1.87), vec2f(0.6, -0.35));
  d = min(d, max(tri, abs(p.z + 0.02) - 0.02));
  d = min(d, max(max(tri, -(tri + 0.045)), abs(p.z + 0.038) - 0.038));
  let lq = abs(p.xy - vec2f(0.0, 1.66));
  let dia = (lq.x * 0.075 + lq.y * 0.045 - 0.075 * 0.045) / length(vec2f(0.075, 0.045));
  d = min(d, max(abs(dia) - 0.006, abs(p.z + 0.03) - 0.03));
  return d;
}

// Cadre fixe : chambranle ou pierre (1), seuil (4), charnières (3). L’embrasure est analytique (voir `jamb_hit`) : des faces parallèles aux rayons coûteraient tous les pas.
fn frame(p: vec3f) -> vec2f {
  var d = 1e5;
  if (KIND == 2) {
    d = mausoleum(p);
  } else {
    // Chambranle : trois planches en saillie autour de l’ouverture.
    d = sd_box(p - vec3f(-OW - 0.05, OT * 0.5 + 0.03, -0.015), vec3f(0.05, OT * 0.5 + 0.03, 0.015));
    d = min(d, sd_box(p - vec3f(OW + 0.05, OT * 0.5 + 0.03, -0.015), vec3f(0.05, OT * 0.5 + 0.03, 0.015)));
    // Linteau : planche haute, puis corniche plus saillante.
    d = min(d, sd_box(p - vec3f(0.0, OT + 0.065, -0.02), vec3f(OW + 0.12, 0.065, 0.02)));
    d = min(d, sd_box(p - vec3f(0.0, OT + 0.145, -0.035), vec3f(OW + 0.145, 0.018, 0.035)));
    if (KIND == 1) {
      // Imposte : panneau crème percé de la demi-lune, cerné d’une moulure en arc.
      // Détaillée seulement près de sa boîte (coût) ; plus loin, la boîte sert de borne.
      let fb = sd_box(p - vec3f(0.0, (OH + OT) * 0.5, -0.024), vec3f(OW + 0.01, (OT - OH) * 0.5, 0.024));
      if (fb > 0.02) {
        d = min(d, fb);
      } else {
        let fc = fan_center();
        let fr = length(p.xy - fc);
        let disc = max(fr - FAN_R, fc.y - p.y);
        d = min(d, max(max(sd_rect(p.xy - vec2f(0.0, (OH + OT) * 0.5), vec2f(OW + 0.01, (OT - OH) * 0.5)), -disc), abs(p.z + 0.015) - 0.015));
        d = min(d, max(max(abs(fr - FAN_R - 0.012) - 0.014, fc.y - p.y), abs(p.z + 0.024) - 0.024));
      }
    }
  }
  var res = vec2f(d, 1.0);
  // Seuil : dalle débordante sous l’ouverture (aucun pour la porte qui flotte dans les nuages).
  if (KIND != 4) {
    let s = sd_box(p - vec3f(0.0, -0.02, 0.03), vec3f(OW + select(0.13, 0.2, KIND == 2), 0.02, 0.13));
    if (s < res.x) {
      res = vec2f(s, 4.0);
    }
  }
  // Charnières : nœuds visibles dans le jeu, côté gonds.
  let hy = select(abs(p.y - 0.28), abs(p.y - select(OH - 0.28, ARCH_Y - 0.12, KIND == 2)), p.y > OH * 0.5);
  let hg = sd_cyl_y(vec3f(p.x + OW - 0.004, hy, p.z - LEAF_Z + 0.004), 0.011, 0.06);
  if (hg < res.x) {
    res = vec2f(hg, 3.0);
  }
  return res;
}

fn map(p: vec3f) -> vec2f {
  let a = frame(p);
  let b = leaf(p);
  return select(a, b, b.x < a.x);
}

fn calc_normal(p: vec3f) -> vec3f {
  let e = vec2f(0.0007, -0.0007);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

// Ombre douce du battant et du cadre vers la lumière (12 pas au plus, sortie anticipée au-delà de 1,2 m : rien ne dépasse).
fn soft_shadow(p: vec3f, n: vec3f) -> f32 {
  // Départ décalé le long de la normale (acné d’ombre sur les petites pièces : anneau, rivets).
  let o = p + n * 0.008;
  var res = 1.0;
  var t = 0.015;
  for (var i = 0; i < 12; i++) {
    let h = map(o + LDIR * t).x;
    res = min(res, 6.0 * h / t); // 6 : pénombre large (l’ombre du cadre sur le battant ouvert ne doit pas paraître un défaut)
    t += clamp(h, 0.015, 0.25);
    if (res < 0.02 || t > 1.2) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

// Occlusion ambiante : 3 prélèvements fixes et pondérés le long de la normale (patron de l’exemple vgpu « raymarched-fractal »).
fn ambient_occ(p: vec3f, n: vec3f) -> f32 {
  let d0 = map(p + n * 0.01).x;
  let d1 = map(p + n * 0.03).x;
  let d2 = map(p + n * 0.07).x;
  let occ = max(0.0, 0.01 - d0) * 22.0 + max(0.0, 0.03 - d1) * 8.0 + max(0.0, 0.07 - d2) * 3.0;
  return clamp(1.0 - occ, 0.3, 1.0);
}

// Intérieur : pièce sombre et chaude, lueur basse au centre (fixe).
fn interior_col(rd: vec3f, ro: vec3f) -> vec3f {
  let t = (WALL + 1.2 - ro.z) / rd.z;
  let q = ro + rd * t;
  let glow = exp(-length(vec2f(q.x * 1.4, (q.y - 0.8) * 0.9)) * 1.6);
  return vec3f(0.012, 0.006, 0.003) + vec3f(0.30, 0.15, 0.045) * glow * glow;
}

// Le canevas est en `bgra8unorm` (pas sRGB) : on encode nous-mêmes, avec une compression douce des hautes lumières.
fn to_srgb(c: vec3f) -> vec3f {
  let m = c / (1.0 + c * 0.25);
  return pow(clamp(m, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2));
}

// Embrasure : faces intérieures de l’ouverture (x = ±OW, y = OH) sur l’épaisseur du mur, intersectées analytiquement.
// Renvoie (t, normale.x, normale.y) ; t < 0 si le rayon ne la touche pas.
fn jamb_hit(ro: vec3f, rd: vec3f) -> vec3f {
  var best = vec3f(-1.0, 0.0, 0.0);
  let sx = sign(rd.x);
  let sideTop = select(OH, ARCH_Y, KIND == 2);
  if (abs(rd.x) > 1e-5) {
    let t = (sx * OW - ro.x) / rd.x;
    let q = ro + rd * t;
    if (q.z > 0.0 && q.z < WALL && q.y > 0.0 && q.y < sideTop) {
      best = vec3f(t, -sx, 0.0);
    }
  }
  if (KIND == 2) {
    // Intrados de l’arche : sortie du rayon du cylindre d’axe z (centre (0, ARCH_Y), rayon OW).
    let o = ro.xy - vec2f(0.0, ARCH_Y);
    let a = dot(rd.xy, rd.xy);
    let b = dot(o, rd.xy);
    let disc = b * b - a * (dot(o, o) - OW * OW);
    if (disc > 0.0) {
      let t = (-b + sqrt(disc)) / a;
      let q = ro + rd * t;
      if (q.z > 0.0 && q.z < WALL && q.y > ARCH_Y && (best.x < 0.0 || t < best.x)) {
        let nn = -(q.xy - vec2f(0.0, ARCH_Y)) / OW;
        best = vec3f(t, nn.x, nn.y);
      }
    }
    return best;
  }
  if (rd.y > 1e-5) {
    let t = (OH - ro.y) / rd.y;
    let q = ro + rd * t;
    if (q.z > 0.0 && q.z < WALL && abs(q.x) < OW && (best.x < 0.0 || t < best.x)) {
      best = vec3f(t, 0.0, -1.0);
    }
  }
  return best;
}

fn ray_box(ro: vec3f, rd: vec3f, lo: vec3f, hi: vec3f) -> vec2f {
  let inv = 1.0 / rd;
  let a = (lo - ro) * inv;
  let b = (hi - ro) * inv;
  let tmin = min(a, b);
  let tmax = max(a, b);
  return vec2f(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

// Vitre de la contre-porte (perron) : intersection du rayon avec son plan, qui pivote avec le battant.
// Renvoie (t, x, y, vitre) dans le repère du battant ; t < 0 si le rayon ne passe par aucune des deux vitres.
fn storm_glass(ro: vec3f, rd: vec3f) -> vec4f {
  let a = params.angle;
  let n = vec3f(-sin(a), 0.0, cos(a));
  let h = vec3f(-OW, 0.0, HINGE_Z);
  let dn = dot(n, rd);
  if (abs(dn) < 1e-4) {
    return vec4f(-1.0);
  }
  let t = ((STORM_Z0 + STORM_Z1) * 0.5 - LEAF_T - dot(n, ro - h)) / dn;
  let l = leaf_local(ro + rd * t);
  let w = 2.0 * OW - 0.006;
  let top = l.y > STORM_RAIL + STORM_BAR * 0.5;
  let inX = l.x > STORM_BAR && l.x < w - STORM_BAR;
  let inY = select(l.y > STORM_BAR && l.y < STORM_RAIL - STORM_BAR * 0.5, l.y < OH - STORM_BAR - 0.008, top);
  if (t > 0.0 && inX && inY) {
    return vec4f(t, l.x, l.y, select(0.0, 1.0, top));
  }
  return vec4f(-1.0);
}

// Reflet de la vitre de la contre-porte (linéaire, s’ajoute à ce qu’on voit au travers) : ciel, trait de lumière en biais
// comme dans le SVG, et une fissure fine sur la vitre haute. Tout est spatial : aucun terme ne dépend du temps.
fn storm_reflect(g: vec4f, rd: vec3f) -> vec3f {
  let lcol = vec3f(params.lr, params.lg, params.lb);
  let amb = vec3f(params.ar, params.ag, params.ab);
  let rr = vec3f(rd.x, rd.y, -rd.z);
  var c = amb * 0.3 + lcol * 0.04 * pow(max(dot(rr, LDIR), 0.0), 3.0);
  let streak = abs(g.y - 1.35 - (g.x - 0.45) * 2.2);
  c += lcol * 0.12 * smoothstep(0.012, 0.0, streak) * step(0.25, g.x) * step(g.x, 0.62);
  if (g.w > 0.5) {
    let cx = 0.22 + (g.y - 1.0) * 0.18 + 0.03 * (vnoise(vec3f(g.y * 14.0, 2.0, 5.0)) - 0.5);
    let crack = smoothstep(0.004, 0.0, abs(g.x - cx)) * smoothstep(1.55, 1.45, g.y) * smoothstep(0.9, 1.0, g.y);
    c += lcol * 0.35 * crack;
  }
  return c;
}

// Imposte en éventail (rue) : verre sombre au nu du mur, petits bois rayonnants depuis un moyeu en demi-cercle,
// reflet faible du lampadaire (lumière du lieu réfléchie par le plan de la vitre).
fn fan_glass(pw: vec3f, rd: vec3f) -> vec3f {
  let lcol = vec3f(params.lr, params.lg, params.lb);
  let amb = vec3f(params.ar, params.ag, params.ab);
  let q = pw.xy - fan_center();
  let r = length(q);
  let ang = atan2(q.y, q.x);
  let seg = 3.14159265 / 6.0;
  let spoke = select(1.0, abs(fract(ang / seg) - 0.5) * seg * r, r > FAN_R * 0.3 && ang > 0.2 && ang < 2.94);
  let mun = min(spoke, abs(r - FAN_R * 0.3));
  let k = smoothstep(0.0085, 0.0045, mun);
  let rr = vec3f(rd.x, rd.y, -rd.z);
  let gl = max(dot(rr, LDIR), 0.0);
  var glass = vec3f(0.006, 0.009, 0.02) + amb * 0.25 + lcol * (0.035 * pow(gl, 4.0) + 0.06 * pow(gl, 24.0));
  glass += lcol * 0.02 * smoothstep(0.02, 0.0, abs(q.x * 0.55 - q.y * 0.8 + 0.06));
  let bar = vec3f(0.09, 0.07, 0.045) * (amb * 3.0 + lcol * 0.35);
  // Pénombre au bord du panneau crème, plus épais que le verre.
  return mix(glass, bar, k) * (0.55 + 0.45 * smoothstep(0.0, 0.04, FAN_R - r));
}

// Nappe de nuage (nuages) : crête bosselée par un bruit spatial fixe, estompée sur les côtés ; renvoie sa densité 0..1.
fn cloud_amt(x: f32, y: f32) -> f32 {
  let n = vnoise(vec3f(x * 3.2, y * 3.0, 4.1)) * 0.65 + vnoise(vec3f(x * 8.0, y * 7.0, 9.3)) * 0.35;
  let top = 0.1 + 0.24 * n;
  return smoothstep(top, top - 0.13, y) * smoothstep(0.72, 0.5, abs(x));
}
fn cloud_col(x: f32, y: f32) -> vec3f {
  let lcol = vec3f(params.lr, params.lg, params.lb);
  let amb = vec3f(params.ar, params.ag, params.ab);
  let n = vnoise(vec3f(x * 6.0, y * 9.0, 2.3));
  return (amb * 4.0 + lcol * 0.32) * (0.75 + 0.3 * n) * (0.7 + 0.3 * smoothstep(-0.1, 0.25, y));
}

@fragment fn fs_main(@location(0) uvIn: vec2f) -> @location(0) vec4f {
  LDIR = vec3f(params.lx, params.ly, params.lz);
  OH = params.oh;
  KIND = i32(params.kind + 0.5);
  ARCH_Y = OH - OW;
  let uv = vec2f(uvIn.x * 2.0 - 1.0, 1.0 - uvIn.y * 2.0);
  // Garde le rapport 120/190 du SVG : le cadre remplit la boîte quelle qu’en soit la taille.
  let aspect = (params.width / max(params.height, 1.0)) / (HALF_W / HALF_H);
  let ro = vec3f(0.0, CAM_Y, -CAM_D);
  let rd = normalize(vec3f(uv.x * HALF_W * aspect, uv.y * HALF_H, CAM_D));
  let lcol = vec3f(params.lr, params.lg, params.lb);
  let amb = vec3f(params.ar, params.ag, params.ab);

  // Le rayon traverse-t-il l’ouverture au nu du mur ? Sinon le mur (invisible) l’arrête à z = 0.
  let tw = -ro.z / rd.z;
  let pw = ro + rd * tw;
  var inOpening = abs(pw.x) < OW && pw.y > 0.0 && pw.y < OH;
  if (KIND == 2) {
    inOpening = inOpening && (pw.y < ARCH_Y || length(pw.xy - vec2f(0.0, ARCH_Y)) < OW);
  }
  // Boîte englobante : le haut du linteau ou du fronton (1,88 m) ; la contre-porte dépasse de 12 cm devant le battant.
  let zMin = select(-0.08, -0.16, KIND == 3);
  let box = ray_box(ro, rd, vec3f(-OW - 0.2, select(-0.05, 0.0, KIND == 4), zMin), vec3f(OW + 0.2, OT + 0.19, WALL + 1.0));
  var t = max(box.x, 0.0);
  let jh = jamb_hit(ro, rd);
  let jambT = select(1e5, jh.x, inOpening && jh.x > 0.0);
  let tEnd = select(min(box.y, tw + 0.0005), min(box.y, jambT), inOpening);
  var hit = false;
  var mat = 0.0;
  if (box.x < box.y) {
    // 56 pas au plus ; seuil de contact croissant avec la distance et pas minimal (patron de l’exemple vgpu « raymarched-fractal »).
    for (var i = 0; i < 56; i++) {
      let h = map(ro + rd * t);
      let eps = max(0.0008, 0.0003 * t);
      if (h.x < eps) {
        hit = true;
        mat = h.y;
        break;
      }
      t += max(h.x * 0.9, eps * 0.5);
      if (t > tEnd) { break; }
    }
  }
  var jambN = vec3f(0.0);
  if (!hit && jambT < 1e4) {
    // Le rayon atteint l’embrasure sans rien croiser avant.
    hit = true;
    mat = 4.0;
    t = jambT;
    jambN = vec3f(jh.y, jh.z, 0.0);
  }

  // Brume au pied : voile statique (bruit spatial seulement), plus dense près du sol.
  let floorY = pw.y;
  let mistAmt = params.mist * 0.32 * exp(-max(floorY + 0.02, 0.0) / 0.16) * (0.65 + 0.7 * vnoise(vec3f(pw.x * 5.0, floorY * 9.0, 1.7))) * smoothstep(OW + 0.35, OW, abs(pw.x));
  let mistCol = amb * 2.2 + lcol * 0.12;
  // Nuages : la base du cadre se perd dans une nappe de nuage (pas de seuil ni de sol).
  let cloud = select(0.0, cloud_amt(pw.x, pw.y), KIND == 4);
  let cloudC = cloud_col(pw.x, pw.y);
  var glass = vec4f(-1.0);
  if (KIND == 3) {
    glass = storm_glass(ro, rd);
  }

  if (!hit) {
    if (inOpening) {
      // Ouverture sans battant devant : l’intérieur chaud (opacité `interior`).
      let ic = interior_col(rd, ro);
      let a = params.interior;
      var c = mix(ic, mistCol, mistAmt);
      var aa = max(a, mistAmt);
      if (glass.x > 0.0) {
        // Vitre de la contre-porte devant l’ouverture : on garde l’intérieur atténué, le reflet s’ajoute (prémultiplié).
        let refl = storm_reflect(glass, rd);
        let a2 = max(aa, 0.22);
        c = (c * aa * select(0.85, 0.5, glass.w > 0.5) + refl) / a2;
        aa = a2;
      }
      c = mix(c, cloudC, cloud);
      aa = max(aa, cloud);
      return vec4f(to_srgb(c) * aa, aa);
    }
    if (KIND == 1 && pw.y > fan_center().y && length(pw.xy - fan_center()) < FAN_R) {
      return vec4f(to_srgb(fan_glass(pw, rd)), 1.0);
    }
    let ma = max(mistAmt, cloud);
    return vec4f(to_srgb(mix(mistCol, cloudC, select(0.0, cloud / ma, ma > 0.0))) * ma, ma);
  }

  let p = ro + rd * t;
  // Une surface visible fait face à la caméra : sur les pièces fines (anneau du heurtoir), le gradient peut s’inverser ; on le retourne.
  let n0 = select(calc_normal(p), jambN, jambN.x != 0.0 || jambN.y != 0.0);
  let n = faceForward(n0, rd, n0);
  let l = leaf_local(p);

  // Matériaux : bois du battant (grain vertical statique), panneaux plus clairs, chambranle, pierre/bois du seuil, métal.
  var base = vec3f(params.fr, params.fg, params.fb);
  var spec = 0.08;
  var gloss = 18.0;
  if (mat < 1.5 && KIND == 2) {
    // Pierre grise et grenue (grain fixe à deux échelles), joints d’assise sur les piédroits.
    let g = vnoise(p * 55.0) * 0.6 + vnoise(p * 150.0) * 0.4;
    base *= 0.68 + 0.5 * g;
    let joint = smoothstep(0.006, 0.002, abs(fract(p.y / 0.3) - 0.5) * 0.3 - 0.144) * step(OW + 0.12, abs(p.x)) * step(p.y, 1.5);
    base *= 1.0 - 0.45 * joint;
  } else if (mat < 1.5) {
    let g = vnoise(vec3f(p.x * 30.0, p.y * 2.5, p.z * 30.0));
    base *= 0.88 + 0.22 * g;
  } else if (mat < 2.5) {
    let wood = vec3f(params.wr, params.wg, params.wb);
    let panel = vec3f(params.pr, params.pg, params.pb);
    let rel = relief(l.x, l.y);
    base = mix(wood, panel, smoothstep(0.004, 0.006, rel) * step(params.style, 0.5));
    // Grain : fibres étirées le long du battant ; le fer reçoit une piqûre fine à la place.
    let g = vnoise(vec3f(l.x * 38.0, l.y * 2.2, l.z * 38.0)) * 0.6 + vnoise(vec3f(l.x * 90.0, l.y * 6.0, 3.0)) * 0.4;
    let grain = select(0.80 + 0.36 * g, 0.9 + 0.2 * vnoise(vec3f(l.x * 160.0, l.y * 160.0, 1.0)), params.style > 1.5);
    base *= grain;
    spec = mix(0.06, 0.35, params.shine);
    gloss = mix(14.0, 48.0, params.shine);
    if (params.emblem > 0.5) {
      // Étoile dorée incrustée (nuages), au centre du panneau haut.
      let st = sd_star5(vec2f(l.x - (2.0 * OW - 0.006) * 0.5, l.y - (OH - 0.38)), 0.075, 0.45);
      let k = smoothstep(0.002, -0.002, st);
      base = mix(base, vec3f(params.mr, params.mg, params.mb), k);
      spec = mix(spec, 0.6, k);
    }
    if (KIND == 2) {
      // Mausolée : cercle rouge barré d’une croix et deux points, peints sur le fer comme dans le SVG.
      let cq = vec2f(l.x - (2.0 * OW - 0.006) * 0.5, l.y - 0.66);
      let cr = length(cq);
      var red = abs(cr - 0.07) - 0.009;
      red = min(red, max(min(abs(cq.x), abs(cq.y)) - 0.007, cr - 0.07));
      red = min(red, length(vec2f(abs(cq.x) - 0.085, cq.y + 0.085)) - 0.022);
      let k = smoothstep(0.002, -0.002, red);
      base = mix(base, vec3f(0.3, 0.025, 0.02), k);
      spec = mix(spec, 0.15, k);
    }
  } else if (mat < 3.5) {
    base = vec3f(params.mr, params.mg, params.mb);
    spec = 0.6;
    gloss = 60.0;
  } else if (mat > 4.5) {
    // Contre-porte : aluminium laqué clair.
    base = vec3f(0.55, 0.6, 0.6);
    spec = 0.35;
    gloss = 40.0;
  } else {
    base = vec3f(params.fr, params.fg, params.fb) * 0.62;
    base *= 0.85 + 0.25 * vnoise(p * 22.0);
  }

  let ndl = max(dot(n, LDIR), 0.0);
  var sh = 1.0;
  if (params.shadows > 0.5 && ndl > 0.0) {
    sh = soft_shadow(p, n);
  }
  let ao = ambient_occ(p, n);
  let v = -rd;
  let hv = normalize(LDIR + v);
  let specTerm = pow(max(dot(n, hv), 0.0), gloss) * spec * (gloss + 8.0) / 32.0;
  var col = base * (amb * (0.6 + 0.4 * n.y * 0.5 + 0.2) * ao + lcol * ndl * sh) + lcol * specTerm * sh * ndl;
  // Liseré : contre-jour discret sur les arêtes tournées vers la lumière.
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * smoothstep(-0.2, 0.4, dot(n, LDIR));
  col += lcol * rim * 0.18 * ao;
  // Lumière chaude de l’intérieur quand le battant s’ouvre : éclaire l’embrasure, la tranche et le revers.
  let open = clamp(sin(max(params.angle, 0.0)), 0.0, 1.0);
  let warmP = vec3f(0.0, 0.9, WALL + 0.9);
  let wd = warmP - p;
  let wl = length(wd);
  let warm = vec3f(1.0, 0.62, 0.25) * max(dot(n, wd / wl), 0.0) * open * 0.9 / (1.0 + wl * wl * 1.5);
  col += base * warm * ao * (0.4 + 0.6 * params.interior);
  if (glass.x > 0.0 && glass.x < t) {
    col = col * select(vec3f(0.85), vec3f(0.3, 0.36, 0.45), glass.w > 0.5) + storm_reflect(glass, rd);
  }
  col = mix(col, mistCol, mistAmt);
  col = mix(col, cloudC, cloud);
  return vec4f(to_srgb(col), 1.0);
}
