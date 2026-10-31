// Assemble le contenu des prophéties en une seule grammaire (l’ordre des clés est celui de l’ancien fichier unique).
//
// Structure par niveaux (le moteur choisit la clé de départ selon le nombre d’ouvertures de porte) :
//  - `niveau1` Curiosité · `niveau2` Soupçon · `niveau3` Conviction · `niveau4` Paranoïa · `niveau5` Illumination.
//  - Chaque niveau = 17 à 26 gabarits « question|corps|verset » (séparés par « | »). Questions par niveau : `question1` … `question5`.
//  - Tables partagées : `industrie`, `fete`, `lieu_inexistant`, `objet` (paires), `futur`, `moment`, `bonbon`, `lieu`, `verset_livre` + `verset_ref` (chaînes ; « Livre ch:v », ex. « Pleine lune 3:13 »).
//  - `porte1` … `porte5` : phrases de porte (voix derrière la porte qui frappe un rythme).
//  - `rate1` … `rate5` : phrases quand le rythme est raté ; `entrez` : phrases après 3 ratés.
//  - `erreur3` … `erreur5` : fausses erreurs par niveau (sac persisté, jamais deux fois la même par visite) + `erreur_icone`, `erreur_boutons`.
//  - `rappel2` … `rappel5` (rappel de la carte précédente, `{carte}`), `onglet1` … `onglet5` (titre d’onglet caché), `bulle1` … `bulle5` (« Titre|Texte »).
//  - `gabarit` = ancien point d’entrée (un niveau au hasard), gardé pour compatibilité.
// Conventions :
//  - Écriture inclusive (règles UQAM) : épicène d’abord (« une personne », « on », « quiconque », « vous ») ; ni point médian
//    ni néologisme (iel…) dans ces tables (textes courants) ; pas de « ils/elles » pour des personnes indéterminées
//    (« on » ou reformuler). Objets accordés normalement ou tournure sans accord.
//  - Pas d’article contracté ni d’accord de verbe dans les gabarits : mets-les dans les champs
//    (`inventeur` = « Big Bougie a inventé », `de` = « du jour de Pi », `a` = « au tarot »).
//  - Chaque champ `x` d’une paire a aussi `x_maj` (majuscule initiale, pour début de phrase) et `x_caps` (niveau 5).
//    Les chaînes `futur`, `moment`, `bonbon` ont une variante `_caps`.
//  - Garde chaque paire cohérente : l’entrée est tirée une seule fois par prophétie, tous ses champs vont ensemble.
//  - Les valeurs peuvent contenir des {références} imbriquées (profondeur max : 8). Jamais de « | » dans une valeur.
import type { Grammar } from '../../engine/grammar'
import { interfaceTextes } from './interface'
import { niveaux, questions, rappels } from './niveaux'
import { portes } from './porte'
import { tables } from './tables'
import { versets } from './versets'

export type { Level, LevelPrefix, PlainKey, TableKey } from './keys'
export { tableKey } from './keys'

export const prophecies: Grammar = { ...niveaux, ...portes, ...rappels, ...interfaceTextes, ...questions, ...tables, ...versets }
