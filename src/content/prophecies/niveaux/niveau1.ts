// Niveau 1 · Curiosité : poli, presque raisonnable.
// Chaque gabarit = une prédiction sur l’avenir de la personne + un élément de voyance ou d’Halloween.
import type { ContenuNiveau } from './index'

export const niveau1: ContenuNiveau = {
  questions: [
    'Puis-je consulter votre avenir, entre deux portes ?',
    'Avez-vous une minute pour votre horoscope ?',
    'Savez-vous ce que la pleine lune vous réserve ?',
    'Voulez-vous que je tire une carte pour vous ?',
    'Vous demandez-vous parfois ce que dit votre boule de cristal ?',
    'Avez-vous prévu un costume pour le 31 octobre ?',
  ],
  // Première lecture de la session (visites = 0) : pure voyance/Halloween, jamais de clin d’œil complotiste.
  // Tirée par `nextProphecy` quand `premiere` est vrai (sac persisté `premiere1`).
  premiere: [
    'Dans la boule de cristal, je vois une porte, une main et un petit sac de {bonbon}. La porte, c’est la vôtre. La main, c’est la mienne.',
    'D’après la pleine lune, vous passerez une très belle semaine. Une personne en drap blanc vous demandera du sel. Donnez-lui-en.',
    'Le 31 octobre, de petites créatures sonneront chez vous. Vous aurez peur du ninja de six ans. Les cartes savent pourquoi.',
    'À minuit, ce soir, vous entendrez peut-être un léger craquement. Ce sera un fantôme poli qui cherche l’interrupteur.',
    'Cette semaine, une personne vous offrira une citrouille. Acceptez-la : ce sera la première d’une longue série.',
    'J’ai tiré une carte : une belle journée vous attend {moment}. Le chat noir, lui, aura une journée terrible. Je ne dis pas pourquoi.',
  ],
  propheties: [
    '{objet.nom_maj} me le murmure depuis ce matin : {futur} {moment}. Rien de grave, rassurez-vous.',
    'D’après la pleine lune, vous passerez une très belle semaine. Une personne en drap blanc vous demandera du sel. Donnez-lui-en.',
    'Le 31 octobre, de petites créatures sonneront chez vous. Vous aurez peur du ninja de six ans. Les cartes savent pourquoi.',
    'J’ai tiré une carte : une belle journée vous attend {moment}. Le chat noir, lui, aura une journée terrible. Je ne dis pas pourquoi.',
    'Dans la boule de cristal, je vois une porte, une main et un petit sac de {bonbon}. La porte, c’est la vôtre. La main, c’est la mienne.',
    '{industrie.inventeur_maj} {industrie.produit} pour nous vendre plus de {industrie.cible}, dit-on. Moi, je consulte seulement {objet.nom}, et j’y vois que {futur} {moment}.',
    'À minuit, ce soir, vous entendrez peut-être un léger craquement. Ce sera un fantôme poli qui cherche l’interrupteur.',
    '{fete.nom_maj} approche. Ma boule de cristal prévoit que vous y achèterez des {fete.cible}. Presque sûrement.',
    'Avant la fin de la semaine, une personne vous dira que les gens qui parlent en français ont tellement de charisme. Vous ne la contredirez pas.',
    'Cette semaine, une personne vous offrira une citrouille. Acceptez-la : ce sera la première d’une longue série.',
    'Vous entrerez chez Renaud-Bray pour acheter un livre. Vous ressortirez avec une planche à découper en bambou et des chandelles. Les cartes l’avaient prévu.',
    'Les cartes sont formelles : le fromage en grains ne doit pas fondre. Quelque part, une personne met sa poutine au micro-ondes en ce moment. Les cartes pleurent.',
    'Votre téléphone contient 4 000 photos du même chat. Ce soir, vous en prendrez une 4 001ᵉ. Les cartes la trouvent très réussie.',
    'Cette fin de semaine, au hockey bottine, on vous collera encore dans les buts. Les cartes l’ont vu venir. Elles ont aussi vu la rondelle.',
    'Les cartes voient votre fin de session : 76 tasses de café. Elles voient aussi la 77ᵉ. Elles vous déconseillent la 78ᵉ.',
    'Les astres vous voient entrer au Café Campus pour prendre un café. Vous en ressortirez à 3 h du matin, sans avoir vu une seule tasse.',
    'Dans la boule de cristal, une tasse fumante apparaît dans votre avenir. Ce ne sera pas au Café Campus. Il y a des limites à la voyance.',
    'Les cartes voient du bleu dans votre avenir. Pas le ciel : des bleuets du Lac-Saint-Jean, sur vos doigts, jusqu’à la fin d’août.',
    'Une toune sur Thetford Mines jouera dans votre auto. Vous monterez le volume en pensant qu’elle aurait sa place dans GTA 6. Les cartes sont d’accord : votre route vers l’amiante et la gloire est tracée.',
    'Au Biodôme, un capybara vous fixera longuement, d’un calme absolu. Il sait quelque chose sur votre semaine. Il a décidé que ce n’était pas grave.',
    'Les cartes voient une trottinette électrique dans votre avenir. Le Ministère l’a réservée aux maths fortes ; vous la recevrez quand même, par erreur, un mardi pluvieux.',
    'Un Roméo vous attend dans le stationnement du Pacini, comme dans une soirée d’élimination d’Occupation Double. Les cartes ne disent pas s’il vous remettra une rose ou un pain à l’ail.',
    'Votre semaine ressemblera à une partie du Canadien : deux périodes pleines d’espoir, puis une troisième dont les cartes préfèrent ne rien dire. Ça se décidera en tirs de barrage.',
    'Vous accompagnerez votre petite sœur de 7 ans à son premier spectacle de K-pop. Vous direz que c’est pour elle. Pourtant, au premier rang, bâton lumineux en main, vous saurez chaque chorégraphie par cœur.',
    'Ce soir, vous danserez pieds nus dans la cuisine sur de l’Angine de Poitrine. Les voisins parleront d’une transe ; les cartes, d’un rendez-vous avec le destin en sept temps.',
    'Les astres sont formels : quelque part, un bébé de six mois lit « HTML pour les bébés ». Dans vingt ans, cet enfant examinera votre candidature et la refusera : « expérience insuffisante ».',
    'Les cartes ont reconnu les trois esprits qui vous suivent depuis votre premier cours de programmation : NullPointer, IndexOutOfBounds et FileNotFound. Chaque fois qu’un malheur arrive, ce sont toujours les trois mêmes.',
    'Cette nuit, l’enfant que vous étiez reviendra vous hanter. Pas pour se venger : seulement pour demander, une dernière fois, la permission de jouer à Minecraft. Les esprits observent une minute de silence.',
    'Ce soir, un message vous dira « Je t’aime ». Votre cœur bondira. Trente secondes plus tard : « Pardon, c’était pour un défi. » Les esprits, qui ont tout vu, en rient encore.',
    'Ce soir, au moment de vous endormir, votre cerveau prendra la parole. Pas pour vous rappeler une gêne de 2014 : pour vous dire que vous avez bien travaillé aujourd’hui. Vous ne saurez pas quoi faire de ça.',
    'Au cégep, on vous fera lire « Poussière sur la ville ». Vous jurerez de l’oublier. Vingt ans plus tard, un soir de brume, une phrase vous reviendra : « Mais, oui, la vie reprend. Et il faut la vivre. » Même les cartes l’ont lu en diagonale.',
    'On vous dira : « Ton ex a vraiment du charme. » Vous demanderez de qui on parle. On pointera son propre visage, puis on partira en faisant le signe de la paix. Les cartes n’ont rien vu venir non plus.',
    'En entrevue, on vous demandera de parler anglais. Par écrit, vous êtes un tyrannosaure. À l’oral, vous serez le petit dinosaure du navigateur hors ligne : vous sauterez par-dessus des cactus en espérant que ça finisse.',
    'Une application de rencontre vous annoncera qu’une personne vous aime. Ce sera un œuf dessiné sur un papillon adhésif, 18 ans, aux études à Harvard. Les cartes s’abstiennent de tout commentaire.',
    'En fin de session, à trois heures du matin, vous ferez cuire des nouilles ramen dans du lait au chocolat. Un fantôme passera par la cuisine, regardera le bol, puis repartira hanter une maison plus saine.',
  ],
  // Prophéties sèches (rares, ~1 lecture sur 8) : phrases courtes, aplomb total, chute absurde au futur.
  // Futur épicène : jamais de participe qui s’accorde avec la personne qui lit.
  seches: [
    'Vous irez à un rendez-vous galant. Ça se passera mal. Votre chat mourra. Il ira beaucoup mieux après.',
    'Vous irez au dépanneur chercher du lait. Vous reviendrez avec des {bonbon}. Le lait restera au dépanneur. Un fantôme le boira, très poliment.',
  ],
}
