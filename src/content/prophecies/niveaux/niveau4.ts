// Niveau 4 · Paranoïaque : tout est lié, MÊME FOURNISSEUR.
import type { ContenuNiveau } from './index'

export const niveau4: ContenuNiveau = {
  questions: [
    'Voyez-vous les fils rouges dans la boule de cristal ?',
    'Pourquoi les fantômes parlent-ils tous en même temps ?',
    'Qui a changé votre horoscope pendant la nuit ?',
    'Cette pièce est-elle vraiment vide, à minuit ?',
    'Avez-vous vérifié derrière vous ? Les cartes disent oui.',
    'Pourquoi le chat noir d’à côté vous fixe-t-il ?',
  ],
  propheties: [
    'La boule de cristal, la citrouille, l’horoscope du journal : MÊME FOURNISSEUR. Prédiction : le 31 octobre, vous le comprendrez, mais trop tard.',
    'Dans ma boule de cristal, le fil rouge passe {lieu}, puis par votre porte, {moment}. Je n’invente rien. Je lis.',
    'Mes notes : les {bonbon}, les costumes, les cônes orange, la neige. MÊME FOURNISSEUR. La pleine lune prédit qu’il repassera {moment}. Cachez votre citrouille.',
    'Votre horoscope a changé pendant la nuit. On l’a réécrit au crayon rouge : {futur} {moment}. Je n’ai pas touché à la citrouille.',
    'Ne regardez pas par la fenêtre le 31 octobre. Les oiseaux sont des drones, déguisés en chauves-souris. Ils attendent {moment}.',
    'Je relie {industrie.nom}, {fete.nom} et {objet.nom} avec du fil rouge. Le dessin forme un fantôme. Il vous ressemble. Il vous attend {moment}.',
    'Cette nuit, {objet.nom} a bougé sans mon aide. Ma prédiction : {futur} {moment}. Ma deuxième prédiction : la même, en pire.',
    'Prudence à minuit : le chat noir d’à côté n’est pas un chat, c’est une antenne. La pleine lune la recharge. Vous le verrez {moment}.',
    'La montgolfière de Saint-Jean plane au-dessus de votre maison. Elle sourit. Elle ne redescendra pas avant le 31.',
    'Réveillez-vous. Montréal n’a jamais existé. Regardez une carte : c’est le Grand Lac Saint-Laurent. On a tout peint.',
    'Les cartes voient une petite décision : une tablette achetée en solde. Puis un chalet. Puis un lac. Puis plus rien.',
    'Réveillez-vous. La Floride était une région du Québec. Cette année, vos grands-parents ont passé l’hiver à Saint-Sauveur. Les cartes ont tout redessiné.',
    'À la Place des Arts, une personne jouera de la flûte à bec. Vous reconnaîtrez l’air : c’est celui que vous fredonnez en dormant. Au pavillon des sciences, la même mélodie vous attendra dans l’ascenseur.',
    'Au camp de vacances, l’équipe des Verts reviendra du bois avec l’histoire la plus tordue de l’été. Tout le monde rira autour du feu. Puis on recomptera l’équipe : il y aura une personne de plus que ce matin.',
    'Un matin de brouillard, sur les plaines d’Abraham, un officier en tricorne vous demandera l’heure. Il semblera confiant, presque serein. Ne lui dites pas qu’il est bientôt 10 h.',
    'Un soir d’été, à Repentigny, il grêlera sans prévenir. Vous ramasserez un grêlon pour le montrer à quelqu’un. Il ne fondra pas. Au centre, figé dans la glace, votre reflet vous fera signe.',
    'Les cartes sont formelles : un courriel vous annoncera que vous avez remporté le premier prix de Fortune.js de l’AGEEI. N’allez pas chercher votre carte-cadeau au local SH-R345 : c’est un piège, la police vous y attend pour vos contraventions de stationnement impayées.',
    'Les astres sont formels : une grande entreprise offrira un départ à 60 000 personnes. Trois jours plus tard, elle vous écrira pour vous offrir un stage : entraîner une machine. Ne demandez pas qui la machine remplacera.',
    'Les cartes vous préviennent : un message vocal de sept secondes vous arrivera d’un numéro inconnu. Ne l’écoutez pas : la musique s’arrêterait, et ce qui parle dedans n’a pas une belle voix.',
    'Les cartes vous donnent un nombre : 70323. Ne le jouez pas à la loterie. Ce n’est pas un numéro chanceux : c’est votre futur matricule.',
    'Vous corrigerez le même bogue chaque lundi, et il reviendra chaque mardi. Les cartes citent Camus : « Il faut imaginer Sisyphe heureux. » La roche, dans votre cas, c’est le fichier package-lock.json.',
    'Les astres l’annoncent : un nouveau cadriciel JavaScript sortira demain. Vous réécrirez tout votre projet, et il sera périmé avant la fin de la réécriture. Ce jeu-ci est en Vue. Pour l’instant.',
    'Ce soir, la flamme de votre chandelle descendra s’asseoir à votre table, entourée de chiens, et dira en sirotant votre café : « Tout va bien. » Les cartes notent que, pour une fois, ce n’est pas vous qui brûlez.',
    'Sur le miroir embué de la salle de bain, un doigt invisible écrira « JE SUIS MORT ». Vous reculerez, puis la buée s’étendra : « … DE RIRE EN VOYANT VOTRE COIFFURE ».',
    'Sur la planche Ouija, vous demanderez : « Êtes-vous un vrai esprit ? » La goutte glissera vers OUI. Vous insisterez. Elle glissera encore vers OUI. Les cartes, prudentes, vous déconseillent de lui donner votre NIP.',
  ],
  // Prophéties sèches (rares, ~1 lecture sur 8) : phrases courtes, aplomb total, chute absurde au futur.
  // Futur épicène : jamais de participe qui s’accorde avec la personne qui lit.
  seches: [
    'Vous partirez en relâche, loin de tout. Ça se passera mal. Big Valise aura tout planifié, jusqu’à la tempête. Vous reviendrez avec un fantôme en bagage à main. Il connaîtra déjà votre adresse.',
    'Vous croirez choisir votre chalet. Ça se passera mal. Le chalet aura fait son choix avant vous. Le lac, la cheminée, le fantôme : MÊME FOURNISSEUR.',
  ],
  // Rappel de la carte précédente (`{carte}`, `{carte_maj}`, `{carte_caps}`).
  rappels: [
    'TOC TOC. {carte_maj}, c’était un avertissement. Vous n’avez pas écouté.',
    'Depuis {carte}, on cogne chez moi aussi. Frappez vite.',
    'Ne dites pas {carte} à voix haute. On vous entend. Frappez.',
    'J’ai jeté {carte}. Ce matin, dans mon sac : encore {carte}.',
    'Votre dernière carte, {carte}, intéresse d’autres personnes que moi. Frappez.',
    'Fermez les rideaux. Après {carte}, on parle de vous dans tout le quartier.',
  ],
}
