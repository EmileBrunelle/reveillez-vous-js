// Niveau 3 · Conviction : fausses fêtes, Big Citrouille dans l’ombre.
import type { ContenuNiveau } from './index'

export const niveau3: ContenuNiveau = {
  questions: [
    'Réveillez-vous : qui écrit votre horoscope ?',
    'Saviez-vous qui fabrique vos citrouilles ?',
    'Qui profite de votre 31 octobre ?',
    'Voulez-vous vraiment connaître votre avenir ?',
    'Voyez-vous le motif dans la boule de cristal ?',
    'Pourquoi croyez-vous encore le calendrier ?',
  ],
  propheties: [
    '{fete.nom_maj} est une fausse fête inventée par {fete.industrie} pour vendre plus de {fete.cible}. Ma boule de cristal prédit que vous en achèterez cette année encore.',
    'Votre costume de cette année est déjà choisi : {objet.nom} l’a vu en rêve. Vous serez, au choix, un fantôme ou un drap. Ce sera le même.',
    '{objet.nom_maj} l’annonce : à l’Halloween, vous croirez partir {lieu_inexistant.en}. Vous arriverez {lieu_inexistant.destination_reelle}. Comme tout le monde.',
    'Ce n’est pas moi qui le dis, ce sont vos cartes : {futur} {moment}. Notez l’heure, et gardez une chandelle.',
    'Je vois dans votre chaudron un avenir bien chaud : {futur} {moment}. Ne laissez personne remuer la soupe à votre place.',
    'La pleine lune de ce mois portera votre nom. Elle portera aussi celui de tout votre voisinage, par souci d’équité. La lune sera ravie. Vous, moins.',
    'Cette année, vous gagnerez le concours du meilleur costume. Ce n’est pas une prédiction, c’est un avertissement : le jury est un chat noir.',
    'Réveillez-vous, les moutons ! {futur_maj} {moment}. C’est écrit dans le tarot, entre le prix de l’essence et le jour de l’An.',
    '{objet.nom_maj} vous regarde. Pas pour vous protéger : pour mesurer vos réserves de {bonbon} avant le 31 octobre.',
    'Le 31 octobre, à minuit, un fantôme vous demandera si {fete.nom} est une vraie fête. Répondez non. Big Citrouille y verra une provocation.',
    'Les cartes voient votre prochain logement : une ancienne cuisine de restaurant, un poteau au milieu du salon, 10 500 $ par mois. Non chauffé. Vous signerez quand même.',
    'Cinq chats noirs dans un grand manteau vous demanderont l’heure. Répondez poliment. L’un de ces chats sera un jour premier ministre.',
    'Les cartes voient un crime : une poutine au fromage râpé, servie dans un festival. Le crime court toujours.',
    'Pleine lune sur la Belle Province. Quelque chose hurlera dans votre rue. Ne lui ouvrez pas : il a déjà le rythme.',
    'Cet hiver, par −30, vous direz que vous aimez l’hiver. Avec un chapeau de poil et un café. Les cartes savent que vous mentez. Elles mentent aussi.',
    'Votre vocation : mener une carriole sous la pleine lune. Demain matin, vous ouvrirez Teams. Les cartes compatissent.',
    'Un béluga de Tadoussac vous a vu passer sur le traversier. Il ne dira rien. Les bélugas savent garder un secret, mais celui-là a pris des notes.',
    'Au large de Tadoussac, un béluga vous regarde depuis ce matin. Il connaît votre horaire. Ne lui faites pas de signe : il pourrait répondre.',
    'Une personne de Québec croisera votre route. Pour la retenir, les cartes conseillent un piège simple : une boîte, un bâton, un sandwich. Elle viendra d’elle-même.',
    'C’est 3-1 pour le Canadien. Tout devrait aller bien ; pourtant, quelque chose dans le Centre Bell retient son souffle. Les cartes, de leur côté, ont déjà vu la fin de la troisième période.',
    'Vos parents ont dit non : la bande ne restera pas à coucher. Tout le monde est reparti avant minuit. Alors qui ronfle doucement dans le sous-sol ?',
    'Vous trouverez une boule de cristal chez Winners, à 14,99 $, entre un coussin de flamant rose et une poêle à crêpes. Dans le verre, votre visage vous regarde. Il a l’air d’avoir fait une bonne affaire.',
    'À l’Aquarium du Québec, un mérou vous suivra d’une vitre à l’autre. Il ne cligne jamais des yeux. Ce soir, il connaîtra votre adresse, et demain, le nom de votre premier animal.',
    'Les cartes l’annoncent : à 3 h du matin, vous trouverez enfin le tutoriel parfait. Publié en 2009, filmé en 240p, il s’arrête net juste avant l’étape qui vous manque. Dans les commentaires, une seule question, sans réponse : « Avez-vous trouvé ? »',
    'Cette nuit d’Halloween, les morts reviendront. Pas en fantômes : au dernier point de sauvegarde. Vous croiserez quelqu’un en chandail « On ne meurt pas, on réaparaît ». La faute est d’origine.',
    'Dans le congélateur de vos grands-parents, un pot de crème glacée vous fera de l’œil. Ce sera de la sauce à spaghetti, comme toujours. Les cartes vous conseillent : coupez-le au couteau avant d’y croire, plus rien n’est fiable.',
    'Les esprits vous préviennent : dans un laboratoire du pavillon PK, une prise électrique portera l’étiquette « Nettoyeur de clés ». Elle est déjà noircie. N’y croyez pas : les farces de l’au-delà sont toujours à 120 volts.',
    'Cette nuit, les fantômes de 2009 reviendront hanter votre fenêtre : un visage de troll vous sourira dans le noir, et un autre murmurera « Me gusta » en vous regardant dormir. Un problème ?',
    'À la poissonnerie, vous demanderez un sac de plastique. On vous répondra avec un sourire : « Pas besoin, il est déjà dedans. » Les esprits de la mer ne pardonnent pas.',
    'Au dépanneur, la tablette du lait évaporé sera vide. Ne vous inquiétez pas : le produit fonctionne exactement comme annoncé. Les esprits, eux, savent où est passée la personne partie en chercher il y a vingt ans.',
    'Vous passerez l’hiver en Floride, comme tout le monde. En vacances, c’est un château. Pour y vivre, c’est un sous-sol humide où une souris géante vous attend dans le noir.',
    'Au port de Montréal, un conteneur éventré vous attendra. Vous passerez la tête par la fente, juste pour voir. Ce n’est pas un conteneur Docker, et ce qui vit dedans vous regarde aussi.',
  ],
  // Prophéties sèches (rares, ~1 lecture sur 8) : phrases courtes, aplomb total, chute absurde au futur.
  // Futur épicène : jamais de participe qui s’accorde avec la personne qui lit.
  seches: [
    'Vous retournerez au cégep chercher votre diplôme. Ça se passera mal. Le registrariat sera fermé. Un fantôme vous remettra le diplôme, avec mention.',
    'Vous irez à la Saint-Jean avec un plan. Ça se passera mal. {objet.nom_maj} vous l’annoncera la veille. Vous ne l’écouterez pas. Le feu de joie, lui, vous écoutera.',
  ],
  // Rappel de la carte précédente (`{carte}`, `{carte_maj}`, `{carte_caps}`).
  rappels: [
    'Vous avez tiré {carte}, et vous revenez. Les cartes avaient prévu les deux.',
    'TOC TOC. Depuis {carte}, plus rien n’est pareil. Vous l’avez senti ?',
    'J’ai gardé {carte} dans ma manche, au cas où.',
    'Ce n’est pas un hasard si vous avez tiré {carte}. Frappez, je m’explique.',
    'Toc toc toc ! {carte_maj} vous attend toujours derrière cette porte.',
    'Frappez. Au sujet de la dernière carte, {carte}, il faut qu’on parle. Pas au téléphone.',
  ],
}
