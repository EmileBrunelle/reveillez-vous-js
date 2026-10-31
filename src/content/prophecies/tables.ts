// Tables partagées par les gabarits.
// Tables à paires (`paired`) : une entrée est tirée une seule fois par prophétie, tous ses champs vont ensemble ;
// `{table.champ}` lit un champ, avec les variantes `champ_maj` (majuscule initiale) et `champ_caps` (tout en majuscules).
// Tables de chaînes (`withCaps`) : `{futur}`, `{moment}`, `{bonbon}` et leurs variantes `_maj` / `_caps` ; `{lieu}` sans variante.
// `arcane` : objets de la coupe de cartes (format `niveaux` : chiffres collés, ex. « 23 »), non passés par `paired`.
import type { Grammar } from '../../engine/grammar'
import { paired, withCaps } from './helpers'

/** `industrie`, `fete`, `lieu_inexistant`, `objet`, `arcane`, `futur`, `moment`, `bonbon`, `lieu`. */
export const tables: Grammar = {
  // ---- Tables à objets (paires) ----------------------------------------------------------
  // Chaque champ `x` génère aussi `x_maj` et `x_caps` (voir `paired`). Tout l’accord est dans les champs.
  // `inventeur` porte le verbe accordé (« Big Bougie a inventé » / « les compagnies de maths ont inventé »).
  industrie: paired([
    { nom: 'les compagnies de maths', inventeur: 'les compagnies de maths ont inventé', produit: 'les calculatrices', cible: 'maths' },
    { nom: 'Big Bougie', inventeur: 'Big Bougie a inventé', produit: 'les citrouilles', cible: 'bougies' },
    { nom: 'Big Tarot', inventeur: 'Big Tarot a inventé', produit: 'la tour foudroyée', cible: 'jeux de tarot' },
    { nom: 'Big Lampe de poche', inventeur: 'Big Lampe de poche a inventé', produit: 'la pleine lune', cible: 'lampes de poche' },
    { nom: 'Big Chaudron', inventeur: 'Big Chaudron a inventé', produit: 'la soupe de sorcière', cible: 'chaudrons' },
    { nom: 'Big Drap', inventeur: 'Big Drap a inventé', produit: 'les fantômes', cible: 'draps' },
    { nom: 'Big Litière', inventeur: 'Big Litière a inventé', produit: 'les chats noirs', cible: 'litières' },
    { nom: 'Big Tuque', inventeur: 'Big Tuque a inventé', produit: 'le mois de janvier', cible: 'tuques' },
    { nom: 'Big Poutine', inventeur: 'Big Poutine a inventé', produit: 'les frites', cible: 'sacs de fromage en grains' },
    { nom: 'Big Cône orange', inventeur: 'Big Cône orange a inventé', produit: 'les nids-de-poule', cible: 'cônes orange' },
    { nom: 'Big Pelle', inventeur: 'Big Pelle a inventé', produit: 'les bordées de neige', cible: 'pelles' },
  ]),

  // Modèle : « Le jour de Pi est une fausse fête inventée par les compagnies de maths pour vendre plus de maths. »
  // `nom` = avec article (« le jour de Pi »), `de` = avec « de » contracté, `cible` = pluriel sans article.
  fete: paired([
    { nom: 'l’Halloween', de: 'de l’Halloween', industrie: 'Big Citrouille', inventeur: 'Big Citrouille a inventé', cible: 'citrouilles' },
    { nom: 'le jour de Pi', de: 'du jour de Pi', industrie: 'les compagnies de maths', inventeur: 'les compagnies de maths ont inventé', cible: 'maths' },
    { nom: 'la Saint-Valentin', de: 'de la Saint-Valentin', industrie: 'Big Chocolat', inventeur: 'Big Chocolat a inventé', cible: 'chocolats' },
    { nom: 'le Vendredi noir', de: 'du Vendredi noir', industrie: 'Big Téléviseur', inventeur: 'Big Téléviseur a inventé', cible: 'téléviseurs' },
    { nom: 'le 1er juillet', de: 'du 1er juillet', industrie: 'l’industrie du déménagement', inventeur: 'l’industrie du déménagement a inventé', cible: 'boîtes' },
    { nom: 'le jour de la marmotte', de: 'du jour de la marmotte', industrie: 'Big Marmotte', inventeur: 'Big Marmotte a inventé', cible: 'marmottes en peluche' },
    { nom: 'le poisson d’avril', de: 'du poisson d’avril', industrie: 'Big Poisson', inventeur: 'Big Poisson a inventé', cible: 'poissons rouges' },
    { nom: 'la relâche', de: 'de la relâche', industrie: 'Big Valise', inventeur: 'Big Valise a inventé', cible: 'valises' },
  ]),

  // Lieux « qui n’existent pas » (blague : les personnes qui pensent y aller sont envoyées ailleurs).
  // `lieu` = nom avec article éventuel, `en` = « en/à » inclus, `destination_reelle` = préposition incluse.
  lieu_inexistant: paired([
    { lieu: 'l’Australie', en: 'en Australie', destination_reelle: 'en Argentine', preuve: 'Les kangourous sont des costumes loués à l’heure. Les koalas, des toutous.' },
    { lieu: 'la Finlande', en: 'en Finlande', destination_reelle: 'sur un grand lac brumeux', preuve: 'Personne n’a jamais vu de poisson finlandais. Les poissons non plus, d’ailleurs.' },
    {
      lieu: 'Saint-Clin-Clin-des-Meuh-Meuh',
      en: 'à Saint-Clin-Clin-des-Meuh-Meuh',
      destination_reelle: 'au bout d’un rang sans nom, derrière un silo',
      preuve: 'Tout le monde en parle, personne n’y est jamais allé. Même pas votre oncle.',
    },
    {
      lieu: 'Trois-Rivières',
      en: 'à Trois-Rivières',
      destination_reelle: 'sur un pont dont on ne voit jamais la fin',
      preuve: 'Personne n’a jamais vu les trois rivières en même temps. Faites le test.',
    },
    {
      lieu: 'Drummondville',
      en: 'à Drummondville',
      destination_reelle: 'dans un chantier de cônes orange à perte de vue',
      preuve: 'Tout le monde la traverse, personne ne s’y arrête. C’est exactement ce que ferait une ville inventée.',
    },
    { lieu: 'Rimouski', en: 'à Rimouski', destination_reelle: 'au bord du fleuve, dans le brouillard', preuve: 'C’est tellement loin que même la boule de cristal perd le signal.' },
    { lieu: 'Sherbrooke', en: 'à Sherbrooke', destination_reelle: 'au bas d’une côte interminable', preuve: 'Toutes les rues y montent. Dans toutes les directions. C’est mathématiquement louche.' },
    { lieu: 'Laval', en: 'à Laval', destination_reelle: 'dans un stationnement de centre commercial', preuve: 'Tous les ponts qui y mènent sont en travaux. Tous. En tout temps.' },
  ]),

  // Objets de voyance au singulier. `a` = avec « à » contracté (« à la boule de cristal », « au tarot »).
  objet: paired([
    { nom: 'la boule de cristal', de: 'de la boule de cristal', a: 'à la boule de cristal' },
    { nom: 'le tarot', de: 'du tarot', a: 'au tarot' },
    { nom: 'la pleine lune', de: 'de la pleine lune', a: 'à la pleine lune' },
    { nom: 'l’horoscope', de: 'de l’horoscope', a: 'à l’horoscope' },
    { nom: 'le chaudron', de: 'du chaudron', a: 'au chaudron' },
    { nom: 'le chat noir', de: 'du chat noir', a: 'au chat noir' },
    { nom: 'la citrouille', de: 'de la citrouille', a: 'à la citrouille' },
    { nom: 'le fantôme du troisième', de: 'du fantôme du troisième', a: 'au fantôme du troisième' },
    { nom: 'le sac de bonbons', de: 'du sac de bonbons', a: 'au sac de bonbons' },
  ]),

  // Arcanes (cartes de voyant). `symbole` = id d’un emblème de TarotCard (inconnu = œil) ; `niveaux` = niveaux où la carte est
  // privilégiée (chiffres collés) ; `paquet` = paquet de la coupe (nuit, feu, brume) dont la carte fait partie. Pas de figure religieuse : on garde les arcanes neutres et ceux de notre cru.
  arcane: [
    { numero: 'I', nom: 'Le Magicien du Québec', paquet: 'nuit', symbole: 'star', niveaux: '23' },
    { numero: '0', nom: 'Le Mat', paquet: 'brume', symbole: 'fool', niveaux: '12' },
    { numero: 'X', nom: 'La Roue de Fortune', paquet: 'feu', symbole: 'wheel', niveaux: '123' },
    { numero: 'XVII', nom: 'L’Étoile', paquet: 'nuit', symbole: 'star', niveaux: '12' },
    { numero: 'XVIII', nom: 'La Lune', paquet: 'nuit', symbole: 'moon', niveaux: '1234' },
    { numero: 'XIX', nom: 'Le Soleil', paquet: 'feu', symbole: 'sun', niveaux: '1' },
    { numero: 'IX', nom: 'L’Ermite à lanterne', paquet: 'feu', symbole: 'lantern', niveaux: '23' },
    { numero: 'XVI', nom: 'La Tour foudroyée', paquet: 'feu', symbole: 'tower', niveaux: '45' },
    { numero: 'XIII bis', nom: 'Big Citrouille', paquet: 'brume', symbole: 'pumpkin', niveaux: '345' },
    { numero: 'XX', nom: 'Le Cône orange', paquet: 'feu', symbole: 'cone', niveaux: '2345' },
    { numero: 'XXI', nom: 'Le Pont en travaux', paquet: 'brume', symbole: 'bridge', niveaux: '345' },
    { numero: 'VIII', nom: 'La Boule de cristal', paquet: 'nuit', symbole: 'crystal', niveaux: '123' },
    { numero: 'XIII ½', nom: 'Le Chat noir', paquet: 'nuit', symbole: 'cat', niveaux: '1234' },
    { numero: 'XXII', nom: 'Saint-Clin-Clin-des-Meuh-Meuh', paquet: 'brume', symbole: 'signpost', niveaux: '23' },
    { numero: 'XXIII', nom: 'Le Fantôme du troisième', paquet: 'brume', symbole: 'ghost', niveaux: '1245' },
    { numero: 'LXVI', nom: 'L’Œil derrière la porte', paquet: 'nuit', symbole: 'eye', niveaux: '45' },
    { numero: 'II ¼', nom: 'Le Castor ingénieur', paquet: 'brume', symbole: 'beaver', niveaux: '12' },
    { numero: 'XII', nom: 'Le Sablier de la relâche', paquet: 'nuit', symbole: 'hourglass', niveaux: '1234' },
    { numero: 'XIV', nom: 'La Toile du sous-sol', paquet: 'brume', symbole: 'web', niveaux: '45' },
    { numero: 'XXIV', nom: 'La Chauve-souris du Stade', paquet: 'nuit', symbole: 'bat', niveaux: '345' },
    { numero: 'XXV', nom: 'Le Bonhomme de neige déplacé', paquet: 'brume', symbole: 'snowman', niveaux: '345' },
    { numero: 'LXXV', nom: 'L’Antenne du toit d’en face', paquet: 'feu', symbole: 'antenna', niveaux: '45' },
  ],

  // ---- Tables de chaînes partagées ---------------------------------------------------------
  // `futur` : proposition complète (« vous … »), à placer après « : » ou « que ». Compléments de temps dans `moment`.
  ...withCaps('futur', [
    'vous croiserez un chat noir qui vous jugera',
    'vous trouverez une orange dans votre sac de bonbons',
    'vous recevrez un courriel parfaitement inutile',
    'une personne vous offrira une citrouille que vous n’avez pas demandée',
    'vous renverserez votre café sur un présage',
    'vous déciderez de ne pas manger de poutine, et vous aurez tort',
    'un fantôme vous demandera votre mot de passe',
    'vous croiserez trois cônes orange et un seul chemin',
    'vous perdrez une tuque, puis vous la retrouverez, mais ce ne sera plus la même',
    'vous répondrez à un numéro inconnu, et il connaîtra votre prénom',
  ]),
  ...withCaps('moment', [
    'mardi prochain',
    'à minuit pile',
    'pendant la prochaine tempête de neige',
    'au prochain feu rouge',
    'avant la fin du mois',
    'lors de votre prochain café',
    'juste après le souper',
    'durant la relâche',
    'à la prochaine pleine lune',
    'quand vous ouvrirez le frigo',
  ]),
  // Pluriels sans article, à utiliser après « de », « des », « les ».
  ...withCaps('bonbon', ['tablettes de chocolat', 'bonbons à la réglisse', 'pommes enrobées de caramel', 'jujubes', 'suçons', 'chips au ketchup', 'bonbons au maïs', 'minibarres sucrées']),
  // Compléments de lieu complets (préposition incluse).
  lieu: [
    'dans le métro',
    'derrière le dépanneur du coin',
    'sous un cône orange',
    'dans la file de la poutinerie',
    'au fond de votre sac de bonbons',
    'dans votre ruelle',
    'devant la patinoire municipale',
    'près du bac de recyclage',
  ],
}
