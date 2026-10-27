// Phrases de piano composées à la main (esprit C418 : « Sweden », « Wet Hands », « Mice on Venus »), en la majeur, ≈ 66 à la noire.
// Notes écrites en la majeur ; le planificateur (src/audio/musicPlan.ts) les relit par degré de gamme, ce qui donne sans réécriture
// fa♯ mineur (relatif, mêmes notes) et la mineur (niveaux 3–5 : I → i, IV → iv, vi7 → VImaj7, iii7 → IIImaj7, ii7 → iiø7).
// Main gauche : accords brisés larges (basse, quinte, neuvième ou septième, dixième). Main droite : une ligne chantable faite de notes
// de l’accord et d’une ou deux notes de passage. Pédale : une région par accord, changée à chaque accord (les notes sonnent jusque-là).
// Voix extrêmes vérifiées : pas de quintes ni d’octaves parallèles entre la basse et la mélodie d’un accord à l’autre, sauts ≤ quinte.
// Aucune note chromatique pour l’instant ; une note hors de la gamme devrait porter `chromatic: true` (les tests le vérifient).

/** Note main gauche : [temps depuis le début de l’accord, nom en la majeur]. */
export type LhNote = readonly [beat: number, note: string]
/** Note de mélodie : [temps depuis le début de la phrase, nom, durée tenue (temps)] ; `chromatic` documente une note hors gamme. */
export type RhNote = readonly [beat: number, note: string, beats: number, chromatic?: true]

export interface ComposedChord {
  /** Chiffrage (documentation, et lisibilité des tests). */
  name: string
  beats: number
  lh: readonly LhNote[]
}

export interface ComposedPhrase {
  name: string
  bpm: number
  /** Temps par mesure (3 ou 4). */
  meter: 3 | 4
  chords: readonly ComposedChord[]
  melody: readonly RhNote[]
  /** Courbe de nuance de l’accompagnement : départ, sommet (à `peakAt`, fraction de la phrase), fin. La mélodie est ≈ 20 % au-dessus. */
  dynamics: { from: number; peak: number; peakAt: number; to: number }
}

/** Arpège régulier : une note tous les `step` temps à partir de 0. */
const arp = (notes: string, step = 0.5): LhNote[] => notes.split(' ').map((n, i) => [i * step, n] as const)

export const PIANO_PHRASES: readonly ComposedPhrase[] = [
  {
    // I(add9) – IV(add9) – vi7 – IVmaj7 : suspendue sur le IV, comme une question laissée ouverte
    name: 'Aube',
    bpm: 66,
    meter: 3,
    chords: [
      { name: 'A(add9)', beats: 3, lh: arp('A2 E3 B3 C#4 B3 E3') },
      { name: 'D(add9)', beats: 3, lh: arp('D2 A2 E3 F#3 E3 A2') },
      { name: 'F#m7', beats: 3, lh: arp('F#2 C#3 E3 A3 E3 C#3') },
      { name: 'Dmaj7', beats: 3, lh: arp('D2 A2 F#3 C#4') },
    ],
    melody: [
      [0, 'E5', 2],
      [2, 'C#5', 1],
      [3, 'F#5', 1],
      [4, 'E5', 2],
      [6, 'C#5', 1.5],
      [7.5, 'B4', 0.5],
      [8, 'A4', 1],
      [9, 'C#5', 3],
    ],
    dynamics: { from: 0.38, peak: 0.6, peakAt: 0.55, to: 0.3 },
  },
  {
    // vi(9) – IVmaj7 – I/C♯ – Vsus4 → V : accords roulés et tenus, basse qui descend par degrés (fa♯ ré do♯) puis remonte au mi
    name: 'Marée',
    bpm: 64,
    meter: 4,
    chords: [
      {
        name: 'F#m9',
        beats: 4,
        lh: [
          [0, 'F#2'],
          [0, 'C#3'],
          [0, 'G#3'],
          [2, 'E3'],
        ],
      },
      {
        name: 'Dmaj7',
        beats: 4,
        lh: [
          [0, 'D2'],
          [0, 'A2'],
          [0, 'F#3'],
          [2, 'E3'],
        ],
      },
      {
        name: 'A/C#',
        beats: 4,
        lh: [
          [0, 'C#2'],
          [0, 'A2'],
          [0, 'E3'],
          [2, 'B3'],
        ],
      },
      {
        name: 'Esus4 → E',
        beats: 4,
        lh: [
          [0, 'E2'],
          [0, 'B2'],
          [0, 'A3'],
          [2, 'G#3'],
        ],
      },
    ],
    melody: [
      [0, 'A4', 1.5],
      [1.5, 'B4', 0.5],
      [2, 'C#5', 2],
      [4, 'E5', 1],
      [5, 'D5', 1],
      [6, 'C#5', 2],
      [8, 'E5', 2],
      [10, 'C#5', 1],
      [11, 'D5', 1],
      [12, 'B4', 4],
    ],
    dynamics: { from: 0.32, peak: 0.55, peakAt: 0.6, to: 0.28 },
  },
  {
    // Imaj9 – V6 (V7 par la mélodie) – vi7 – IV(add9) – I : basse la sol♯ fa♯ ré la, arpège continu en croches
    name: 'Mains mouillées',
    bpm: 66,
    meter: 3,
    chords: [
      { name: 'Amaj9', beats: 3, lh: arp('A2 E3 G#3 B3 C#4 B3') },
      { name: 'E7/G#', beats: 3, lh: arp('G#2 E3 B3 E4 B3 E3') },
      { name: 'F#m7', beats: 3, lh: arp('F#2 C#3 E3 A3 C#4 A3') },
      { name: 'D(add9)', beats: 3, lh: arp('D2 A2 E3 F#3 A3 F#3') },
      { name: 'A(add9)', beats: 3, lh: arp('A2 E3 B3 C#4') },
    ],
    melody: [
      [0, 'C#5', 1],
      [1, 'E5', 2],
      [3, 'D5', 1.5],
      [4.5, 'C#5', 0.5],
      [5, 'B4', 1],
      [6, 'A4', 1.5],
      [7.5, 'B4', 0.5],
      [8, 'C#5', 1],
      [9, 'F#5', 1],
      [10, 'E5', 2],
      [12, 'C#5', 3],
    ],
    dynamics: { from: 0.35, peak: 0.62, peakAt: 0.6, to: 0.25 },
  },
  {
    // IVmaj7 – I/C♯ – ii7 – Vsus4 – I : la mélodie sort de l’arpège (la do♯ mi), basse ré do♯ si puis mi la
    name: 'Vénus',
    bpm: 68,
    meter: 4,
    chords: [
      {
        name: 'Dmaj7',
        beats: 4,
        lh: [
          [0, 'D2'],
          [0.5, 'A2'],
          [1, 'E3'],
          [1.5, 'F#3'],
          [2, 'C#4'],
          [3, 'F#3'],
        ],
      },
      {
        name: 'A/C#',
        beats: 4,
        lh: [
          [0, 'C#2'],
          [0.5, 'A2'],
          [1, 'E3'],
          [1.5, 'B3'],
          [3, 'E3'],
        ],
      },
      {
        name: 'Bm7',
        beats: 4,
        lh: [
          [0, 'B1'],
          [0.5, 'F#2'],
          [1, 'D3'],
          [1.5, 'A3'],
          [2, 'C#4'],
          [3, 'F#3'],
        ],
      },
      {
        name: 'Esus4',
        beats: 2,
        lh: [
          [0, 'E2'],
          [0.5, 'B2'],
          [1, 'A3'],
        ],
      },
      { name: 'A(add9)', beats: 2, lh: arp('A2 E3 B3 C#4') },
    ],
    melody: [
      [0, 'A4', 1],
      [1, 'C#5', 1],
      [2, 'E5', 2],
      [4, 'E5', 1.5],
      [5.5, 'D5', 0.5],
      [6, 'C#5', 2],
      [8, 'D5', 2],
      [10, 'B4', 1],
      [11, 'C#5', 1],
      [12, 'B4', 2],
      [14, 'A4', 2],
    ],
    dynamics: { from: 0.3, peak: 0.55, peakAt: 0.45, to: 0.22 },
  },
  {
    // vi(9) – iii7 – IVmaj7 – I(add9) : berceuse, la mélodie descend et se pose sur la tonique
    name: 'Veilleuse',
    bpm: 63,
    meter: 3,
    chords: [
      { name: 'F#m9', beats: 3, lh: arp('F#2 C#3 E3 G#3 E3 C#3') },
      { name: 'C#m7', beats: 3, lh: arp('C#2 G#2 E3 B3 E3 G#2') },
      { name: 'Dmaj7', beats: 3, lh: arp('D2 A2 F#3 C#4 F#3 A2') },
      { name: 'A(add9)', beats: 3, lh: arp('A2 E3 B3 C#4 E4') },
    ],
    melody: [
      [0, 'C#5', 1.5],
      [1.5, 'B4', 0.5],
      [2, 'A4', 1],
      [3, 'B4', 2],
      [5, 'G#4', 1],
      [6, 'A4', 1.5],
      [7.5, 'B4', 0.5],
      [8, 'C#5', 1],
      [9, 'B4', 1],
      [10, 'A4', 2],
    ],
    dynamics: { from: 0.33, peak: 0.5, peakAt: 0.4, to: 0.24 },
  },
]
