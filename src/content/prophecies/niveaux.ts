// Gabarits de prophéties par niveau de vigilance (1 à 5) : l’essentiel du contenu du jeu.
// Format d’un gabarit : `{ question, corps, verset }` (les trois champs sont développés ensemble : une table à paires citée dans deux champs reste appariée).
// `{table}` tire une chaîne ; `{table.champ}` tire un champ d’une table à paires (voir `tables.ts`) ;
// `{verset}` = livre + référence (voir `versets.ts`). Les valeurs peuvent contenir des références imbriquées (profondeur max : 8).
import type { Grammar } from '../../engine/grammar'

/** `niveau1` … `niveau5`, `premiere1` (première lecture) et `seche1` … `seche5` (prophéties sèches). */
export const niveaux: Grammar = {
  // ---- Niveau 1 · Curiosité : poli, presque raisonnable -------------------------------
  // Chaque gabarit = une prédiction sur l’avenir de la personne + un élément de voyance ou d’Halloween.
  niveau1: [
    { question: '{question1}', corps: '{objet.nom_maj} me le murmure depuis ce matin : {futur} {moment}. Rien de grave, rassurez-vous.', verset: '{verset}' },
    { question: '{question1}', corps: 'D’après la pleine lune, vous passerez une très belle semaine. Une personne en drap blanc vous demandera du sel. Donnez-lui-en.', verset: '{verset}' },
    { question: '{question1}', corps: 'Le 31 octobre, de petites créatures sonneront chez vous. Vous aurez peur du ninja de six ans. Les cartes savent pourquoi.', verset: '{verset}' },
    { question: '{question1}', corps: 'J’ai tiré une carte : une belle journée vous attend {moment}. Le chat noir, lui, aura une journée terrible. Je ne dis pas pourquoi.', verset: '{verset}' },
    { question: '{question1}', corps: 'Dans la boule de cristal, je vois une porte, une main et un petit sac de {bonbon}. La porte, c’est la vôtre. La main, c’est la mienne.', verset: '{verset}' },
    {
      question: '{question1}',
      corps: '{industrie.inventeur_maj} {industrie.produit} pour nous vendre plus de {industrie.cible}, dit-on. Moi, je consulte seulement {objet.nom}, et j’y vois que {futur} {moment}.',
      verset: '{verset}',
    },
    { question: '{question1}', corps: 'À minuit, ce soir, vous entendrez peut-être un léger craquement. Ce sera un fantôme poli qui cherche l’interrupteur.', verset: '{verset}' },
    { question: '{question1}', corps: '{fete.nom_maj} approche. Ma boule de cristal prévoit que vous y achèterez des {fete.cible}. Presque sûrement.', verset: '{verset}' },
    {
      question: '{question1}',
      corps: 'Avant la fin de la semaine, une personne vous dira que les gens qui parlent en français ont tellement de charisme. Vous ne la contredirez pas.',
      verset: '{verset}',
    },
    { question: '{question1}', corps: 'Cette semaine, une personne vous offrira une citrouille. Acceptez-la : ce sera la première d’une longue série.', verset: '{verset}' },
    {
      question: '{question1}',
      corps: 'Vous entrerez chez Renaud-Bray pour acheter un livre. Vous ressortirez avec une planche à découper en bambou et des chandelles. Les cartes l’avaient prévu.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Les cartes sont formelles : le fromage en grains ne doit pas fondre. Quelque part, une personne met sa poutine au micro-ondes en ce moment. Les cartes pleurent.',
      verset: '{verset}',
    },
    { question: '{question1}', corps: 'Votre téléphone contient 4 000 photos du même chat. Ce soir, vous en prendrez une 4 001ᵉ. Les cartes la trouvent très réussie.', verset: '{verset}' },
    { question: '{question1}', corps: 'Cette fin de semaine, au hockey bottine, on vous collera encore dans les buts. Les cartes l’ont vu venir. Elles ont aussi vu la rondelle.', verset: '{verset}' },
    { question: '{question1}', corps: 'Les cartes voient votre fin de session : 76 tasses de café. Elles voient aussi la 77ᵉ. Elles vous déconseillent la 78ᵉ.', verset: '{verset}' },
    { question: '{question1}', corps: 'Les astres vous voient entrer au Café Campus pour prendre un café. Vous en ressortirez à 3 h du matin, sans avoir vu une seule tasse.', verset: '{verset}' },
    { question: '{question1}', corps: 'Dans la boule de cristal, une tasse fumante apparaît dans votre avenir. Ce ne sera pas au Café Campus. Il y a des limites à la voyance.', verset: '{verset}' },
    { question: '{question1}', corps: 'Les cartes voient du bleu dans votre avenir. Pas le ciel : des bleuets du Lac-Saint-Jean, sur vos doigts, jusqu’à la fin d’août.', verset: '{verset}' },
    {
      question: '{question1}',
      corps:
        'Une toune sur Thetford Mines jouera dans votre auto. Vous monterez le volume en pensant qu’elle aurait sa place dans GTA 6. Les cartes sont d’accord : votre route vers l’amiante et la gloire est tracée.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Au Biodôme, un capybara vous fixera longuement, d’un calme absolu. Il sait quelque chose sur votre semaine. Il a décidé que ce n’était pas grave.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Les cartes voient une trottinette électrique dans votre avenir. Le Ministère l’a réservée aux maths fortes ; vous la recevrez quand même, par erreur, un mardi pluvieux.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Un Roméo vous attend dans le stationnement du Pacini, comme dans une soirée d’élimination d’Occupation Double. Les cartes ne disent pas s’il vous remettra une rose ou un pain à l’ail.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Votre semaine ressemblera à une partie du Canadien : deux périodes pleines d’espoir, puis une troisième dont les cartes préfèrent ne rien dire. Ça se décidera en tirs de barrage.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps:
        'Vous accompagnerez votre petite sœur de 7 ans à son premier spectacle de K-pop. Vous direz que c’est pour elle. Pourtant, au premier rang, bâton lumineux en main, vous saurez chaque chorégraphie par cœur.',
      verset: '{verset}',
    },
    {
      question: '{question1}',
      corps: 'Ce soir, vous danserez pieds nus dans la cuisine sur de l’Angine de Poitrine. Les voisins parleront d’une transe ; les cartes, d’un rendez-vous avec le destin en sept temps.',
      verset: '{verset}',
    },
  ],

  // ---- Première lecture de la session (visites = 0) : pure voyance/Halloween, jamais de clin d’œil complotiste -------
  // Même format que `niveau1`, tirée par `nextProphecy` quand `premiere` est vrai (sac persisté `premiere1`).
  premiere1: [
    { question: '{question1}', corps: 'Dans la boule de cristal, je vois une porte, une main et un petit sac de {bonbon}. La porte, c’est la vôtre. La main, c’est la mienne.', verset: '{verset}' },
    { question: '{question1}', corps: 'D’après la pleine lune, vous passerez une très belle semaine. Une personne en drap blanc vous demandera du sel. Donnez-lui-en.', verset: '{verset}' },
    { question: '{question1}', corps: 'Le 31 octobre, de petites créatures sonneront chez vous. Vous aurez peur du ninja de six ans. Les cartes savent pourquoi.', verset: '{verset}' },
    { question: '{question1}', corps: 'À minuit, ce soir, vous entendrez peut-être un léger craquement. Ce sera un fantôme poli qui cherche l’interrupteur.', verset: '{verset}' },
    { question: '{question1}', corps: 'Cette semaine, une personne vous offrira une citrouille. Acceptez-la : ce sera la première d’une longue série.', verset: '{verset}' },
    { question: '{question1}', corps: 'J’ai tiré une carte : une belle journée vous attend {moment}. Le chat noir, lui, aura une journée terrible. Je ne dis pas pourquoi.', verset: '{verset}' },
  ],

  // ---- Niveau 2 · Soupçon : les liens apparaissent ----------------------------------
  niveau2: [
    { question: '{question2}', corps: 'Ma boule de cristal annonce que {futur} {moment}. Exactement comme je l’avais prédit. Exactement comme on l’avait prévu.', verset: '{verset}' },
    { question: '{question2}', corps: '{objet.nom_maj} montre un chat noir, puis un fantôme, puis un sac de {bonbon}. Dans cet ordre. Pour vous. Le 31 octobre.', verset: '{verset}' },
    { question: '{question2}', corps: 'Mon tarot est clair : {futur} {moment}. Je ne crois pas aux coïncidences, je lis les cartes.', verset: '{verset}' },
    {
      question: '{question2}',
      corps:
        '{industrie.inventeur_maj} {industrie.produit} pour nous vendre plus de {industrie.cible}. Et par hasard, la pleine lune vous annonce un achat de {industrie.cible} {moment}. Coïncidence ?',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'Saint-Clin-Clin-des-Meuh-Meuh est sur ma carte. Ma carte date de 1987. Vous y déménagerez le 1er juillet, sans camion.', verset: '{verset}' },
    { question: '{question2}', corps: 'On vous aperçoit {lieu}, en costume de citrouille, {moment}. Non, ne niez pas : c’est dans votre horoscope.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'Trois chats noirs, deux fantômes, un seul fournisseur de {bonbon}. Mon tarot en tire une conclusion : vous passerez la nuit du 31 octobre à compter vos bonbons.',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'Ce soir, à minuit, {objet.nom} va changer de couleur. Si vous ne le voyez pas, c’est que vous en faites partie.', verset: '{verset}' },
    { question: '{question2}', corps: 'Vous avez rouvert la porte. Avant même que je frappe, {objet.nom} l’avait annoncé. J’ai noté l’heure. Vous aussi, je pense.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'Votre boule de cristal montre une tourtière. Au Lac-Saint-Jean, on vous dira que ce n’en est pas une. La voyance ne tranchera pas ce débat.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Ce soir, vous remettrez une araignée dehors au lieu de l’écraser. Vous vous sentirez sage. Elle mourra d’hypothermie. Les cartes ne jugent pas.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'En vous, il y a deux loups. L’un veut du Paris Pâté. L’autre veut des sardines. Les cartes savent lequel gagnera demain matin. Elles ne le diront pas.',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'Les cartes sont formelles : les Nordiques reviendront. Les Expos aussi. Les cartes disent ça depuis 1995. Elles sont patientes.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'Une malédiction pèse sur vous : le chili du Tim, avec le p’tit pain et les deux beurres. Vous y retournerez demain. Les cartes ne peuvent rien pour vous.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Votre carte est le Magicien du Québec. Dès que quelque chose arrive dans votre vie, vous lancez un sort. Le sort s’appelle « Tabarnouche ». Il est très efficace.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'En entrevue, on vous demandera d’expliquer le trou de trois ans dans votre CV. Répondez : « J’étais en consultation de voyance. » C’est la vérité.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Le Café Campus n’a jamais servi de café. Les cartes le savent et se demandent ce qu’on y sert vraiment, et pourquoi vous y retournez jeudi.',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'Une personne en visite vous demandera où est « le vrai Québec ». Vous pointerez au loin. Cette personne aura tort. Vous aussi.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'Ce temps des fêtes, vous recevrez une bouteille de whisky à l’érable. Vous l’offrirez à une autre personne l’an prochain. Les cartes ont vu son voyage : elle circule depuis 2014.',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'Le cipaille gaspésien de votre prochain réveillon a déjà six étages. Les astres en ont compté un septième, sous la croûte.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'D’ici 2028, votre ancienne école deviendra une sandwicherie. Vous y commanderez un sous-marin sans savoir pourquoi votre cœur se serre devant le comptoir à condiments.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Vous achèterez une commode sur Marketplace à quelqu’un dont la photo de profil est un doré tenu à bout de bras. Ne posez pas de questions : le poisson, lui, vous a déjà vu venir.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Quelqu’un vous aime en secret : votre grand-mère, depuis l’au-delà. Elle trouve que vous ne mangez pas assez et vous laissera un pot de cretons sur le perron.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps: 'Cette semaine, vous remettrez votre démission chez Tim Hortons. Vous n’y avez jamais travaillé. Le gérant l’acceptera quand même, les larmes aux yeux, avec un double-double.',
      verset: '{verset}',
    },
    { question: '{question2}', corps: 'On vous l’avait dit : les maths fortes ouvrent des portes. Celle-ci, par exemple. Vous auriez peut-être dû la laisser fermée.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'À votre premier rendez-vous, la personne en face de vous avouera préférer le Benny au St-Hubert. Les cartes se taisent. Quelque part, une sauce brune refroidit en signe de deuil.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps:
        'Les esprits vous préviennent : dans les toilettes du pavillon SH, un chien chaud vous attendra sur le réservoir, avec un papillon « Gratuit ! ». Ne le mangez pas. Ce n’est pas un cadeau : c’est un test, et quelqu’un note les résultats.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps:
        'Les cartes vous promettent une relation stable avec votre compilateur. Il vous dira exactement où est le problème : ligne 1, dans un fichier que vous n’avez jamais ouvert, sur 400 lignes que personne n’a jamais lues jusqu’au bout.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps:
        'Un profil vous écrira ce soir. Sa photo montre encore la barre d’adresse du navigateur et le titre de l’article : « Les 30 plus belles personnes de France ». Les cartes ne jugent pas. Les cartes notent seulement que l’esprit qui vous drague ne sait pas recadrer.',
      verset: '{verset}',
    },
    {
      question: '{question2}',
      corps:
        'Une banque d’images vous choisira pour illustrer « l’ingénierie ». On vous tendra un fer à souder par le bout qui chauffe, et vous sourirez quand même. Les cartes voient une carrière brillante et une main pansée.',
      verset: '{verset}',
    },
  ],

  // ---- Niveau 3 · Conviction : fausses fêtes, Big Citrouille dans l’ombre ---------------------
  niveau3: [
    {
      question: '{question3}',
      corps: '{fete.nom_maj} est une fausse fête inventée par {fete.industrie} pour vendre plus de {fete.cible}. Ma boule de cristal prédit que vous en achèterez cette année encore.',
      verset: '{verset}',
    },
    { question: '{question3}', corps: 'Votre costume de cette année est déjà choisi : {objet.nom} l’a vu en rêve. Vous serez, au choix, un fantôme ou un drap. Ce sera le même.', verset: '{verset}' },
    {
      question: '{question3}',
      corps: '{objet.nom_maj} l’annonce : à l’Halloween, vous croirez partir {lieu_inexistant.en}. Vous arriverez {lieu_inexistant.destination_reelle}. Comme tout le monde.',
      verset: '{verset}',
    },
    { question: '{question3}', corps: 'Ce n’est pas moi qui le dis, ce sont vos cartes : {futur} {moment}. Notez l’heure, et gardez une chandelle.', verset: '{verset}' },
    { question: '{question3}', corps: 'Je vois dans votre chaudron un avenir bien chaud : {futur} {moment}. Ne laissez personne remuer la soupe à votre place.', verset: '{verset}' },
    {
      question: '{question3}',
      corps: 'La pleine lune de ce mois portera votre nom. Elle portera aussi celui de tout votre voisinage, par souci d’équité. La lune sera ravie. Vous, moins.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Cette année, vous gagnerez le concours du meilleur costume. Ce n’est pas une prédiction, c’est un avertissement : le jury est un chat noir.',
      verset: '{verset}',
    },
    { question: '{question3}', corps: 'Réveillez-vous, les moutons ! {futur_maj} {moment}. C’est écrit dans le tarot, entre le prix de l’essence et le jour de l’An.', verset: '{verset}' },
    { question: '{question3}', corps: '{objet.nom_maj} vous regarde. Pas pour vous protéger : pour mesurer vos réserves de {bonbon} avant le 31 octobre.', verset: '{verset}' },
    {
      question: '{question3}',
      corps: 'Le 31 octobre, à minuit, un fantôme vous demandera si {fete.nom} est une vraie fête. Répondez non. Big Citrouille y verra une provocation.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Les cartes voient votre prochain logement : une ancienne cuisine de restaurant, un poteau au milieu du salon, 10 500 $ par mois. Non chauffé. Vous signerez quand même.',
      verset: '{verset}',
    },
    { question: '{question3}', corps: 'Cinq chats noirs dans un grand manteau vous demanderont l’heure. Répondez poliment. L’un de ces chats sera un jour premier ministre.', verset: '{verset}' },
    { question: '{question3}', corps: 'Les cartes voient un crime : une poutine au fromage râpé, servie dans un festival. Le crime court toujours.', verset: '{verset}' },
    { question: '{question3}', corps: 'Pleine lune sur la Belle Province. Quelque chose hurlera dans votre rue. Ne lui ouvrez pas : il a déjà le rythme.', verset: '{verset}' },
    {
      question: '{question3}',
      corps: 'Cet hiver, par −30, vous direz que vous aimez l’hiver. Avec un chapeau de poil et un café. Les cartes savent que vous mentez. Elles mentent aussi.',
      verset: '{verset}',
    },
    { question: '{question3}', corps: 'Votre vocation : mener une carriole sous la pleine lune. Demain matin, vous ouvrirez Teams. Les cartes compatissent.', verset: '{verset}' },
    {
      question: '{question3}',
      corps: 'Un béluga de Tadoussac vous a vu passer sur le traversier. Il ne dira rien. Les bélugas savent garder un secret, mais celui-là a pris des notes.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Au large de Tadoussac, un béluga vous regarde depuis ce matin. Il connaît votre horaire. Ne lui faites pas de signe : il pourrait répondre.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Une personne de Québec croisera votre route. Pour la retenir, les cartes conseillent un piège simple : une boîte, un bâton, un sandwich. Elle viendra d’elle-même.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'C’est 3-1 pour le Canadien. Tout devrait aller bien ; pourtant, quelque chose dans le Centre Bell retient son souffle. Les cartes, de leur côté, ont déjà vu la fin de la troisième période.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Vos parents ont dit non : la bande ne restera pas à coucher. Tout le monde est reparti avant minuit. Alors qui ronfle doucement dans le sous-sol ?',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'Vous trouverez une boule de cristal chez Winners, à 14,99 $, entre un coussin de flamant rose et une poêle à crêpes. Dans le verre, votre visage vous regarde. Il a l’air d’avoir fait une bonne affaire.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'À l’Aquarium du Québec, un mérou vous suivra d’une vitre à l’autre. Il ne cligne jamais des yeux. Ce soir, il connaîtra votre adresse, et demain, le nom de votre premier animal.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'Les cartes l’annoncent : à 3 h du matin, vous trouverez enfin le tutoriel parfait. Publié en 2009, filmé en 240p, il s’arrête net juste avant l’étape qui vous manque. Dans les commentaires, une seule question, sans réponse : « Avez-vous trouvé ? »',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'Cette nuit d’Halloween, les morts reviendront. Pas en fantômes : au dernier point de sauvegarde. Vous croiserez quelqu’un en chandail « On ne meurt pas, on réaparaît ». La faute est d’origine.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'Dans le congélateur de vos grands-parents, un pot de crème glacée vous fera de l’œil. Ce sera de la sauce à spaghetti, comme toujours. Les cartes vous conseillent : coupez-le au couteau avant d’y croire, plus rien n’est fiable.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps:
        'Les esprits vous préviennent : dans un laboratoire du pavillon PK, une prise électrique portera l’étiquette « Nettoyeur de clés ». Elle est déjà noircie. N’y croyez pas : les farces de l’au-delà sont toujours à 120 volts.',
      verset: '{verset}',
    },
  ],

  // ---- Niveau 4 · Paranoïaque : tout est lié, MÊME FOURNISSEUR ----------------------------------
  niveau4: [
    {
      question: '{question4}',
      corps: 'La boule de cristal, la citrouille, l’horoscope du journal : MÊME FOURNISSEUR. Prédiction : le 31 octobre, vous le comprendrez, mais trop tard.',
      verset: '{verset}',
    },
    { question: '{question4}', corps: 'Dans ma boule de cristal, le fil rouge passe {lieu}, puis par votre porte, {moment}. Je n’invente rien. Je lis.', verset: '{verset}' },
    {
      question: '{question4}',
      corps: 'Mes notes : les {bonbon}, les costumes, les cônes orange, la neige. MÊME FOURNISSEUR. La pleine lune prédit qu’il repassera {moment}. Cachez votre citrouille.',
      verset: '{verset}',
    },
    { question: '{question4}', corps: 'Votre horoscope a changé pendant la nuit. On l’a réécrit au crayon rouge : {futur} {moment}. Je n’ai pas touché à la citrouille.', verset: '{verset}' },
    { question: '{question4}', corps: 'Ne regardez pas par la fenêtre le 31 octobre. Les oiseaux sont des drones, déguisés en chauves-souris. Ils attendent {moment}.', verset: '{verset}' },
    {
      question: '{question4}',
      corps: 'Je relie {industrie.nom}, {fete.nom} et {objet.nom} avec du fil rouge. Le dessin forme un fantôme. Il vous ressemble. Il vous attend {moment}.',
      verset: '{verset}',
    },
    { question: '{question4}', corps: 'Cette nuit, {objet.nom} a bougé sans mon aide. Ma prédiction : {futur} {moment}. Ma deuxième prédiction : la même, en pire.', verset: '{verset}' },
    { question: '{question4}', corps: 'Prudence à minuit : le chat noir d’à côté n’est pas un chat, c’est une antenne. La pleine lune la recharge. Vous le verrez {moment}.', verset: '{verset}' },
    { question: '{question4}', corps: 'La montgolfière de Saint-Jean plane au-dessus de votre maison. Elle sourit. Elle ne redescendra pas avant le 31.', verset: '{verset}' },
    { question: '{question4}', corps: 'Réveillez-vous. Montréal n’a jamais existé. Regardez une carte : c’est le Grand Lac Saint-Laurent. On a tout peint.', verset: '{verset}' },
    { question: '{question4}', corps: 'Les cartes voient une petite décision : une tablette achetée en solde. Puis un chalet. Puis un lac. Puis plus rien.', verset: '{verset}' },
    {
      question: '{question4}',
      corps: 'Réveillez-vous. La Floride était une région du Québec. Cette année, vos grands-parents ont passé l’hiver à Saint-Sauveur. Les cartes ont tout redessiné.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps:
        'À la Place des Arts, une personne jouera de la flûte à bec. Vous reconnaîtrez l’air : c’est celui que vous fredonnez en dormant. Au pavillon des sciences, la même mélodie vous attendra dans l’ascenseur.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps:
        'Au camp de vacances, l’équipe des Verts reviendra du bois avec l’histoire la plus tordue de l’été. Tout le monde rira autour du feu. Puis on recomptera l’équipe : il y aura une personne de plus que ce matin.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps: 'Un matin de brouillard, sur les plaines d’Abraham, un officier en tricorne vous demandera l’heure. Il semblera confiant, presque serein. Ne lui dites pas qu’il est bientôt 10 h.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps:
        'Un soir d’été, à Repentigny, il grêlera sans prévenir. Vous ramasserez un grêlon pour le montrer à quelqu’un. Il ne fondra pas. Au centre, figé dans la glace, votre reflet vous fera signe.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps:
        'Les cartes sont formelles : un courriel vous annoncera que vous avez remporté le premier prix de Fortune.js de l’AGEEI. N’allez pas chercher votre carte-cadeau au local SH-R345 : c’est un piège, la police vous y attend pour vos contraventions de stationnement impayées.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps:
        'Les astres sont formels : une grande entreprise offrira un départ à 60 000 personnes. Trois jours plus tard, elle vous écrira pour vous offrir un stage : entraîner une machine. Ne demandez pas qui la machine remplacera.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps: 'Un message vocal de sept secondes vous arrivera d’un numéro inconnu. Ne l’écoutez pas : votre belle musique s’arrêterait, et ce qui parle dedans n’a pas une belle voix.',
      verset: '{verset}',
    },
  ],

  // ---- Niveau 5 · Illumination : MAJUSCULES, phrases coupées, contradictions ----------------------
  niveau5: [
    { question: '{question5}', corps: 'LA BOULE DIT : {futur_caps}. NON ! L’INVERSE ! LA BOULE VOUS PRÉDIT. VOUS PRÉDISEZ LA BOULE.', verset: '{verset}' },
    {
      question: '{question5}',
      corps:
        '{lieu_inexistant.lieu_caps} N’EXISTE PAS ! LA BOULE DE CRISTAL VOUS Y VOIT LE 31 OCTOBRE ET ON VOUS ENVOIE {lieu_inexistant.destination_reelle_caps} ! {lieu_inexistant.preuve_caps} VOUS N’EXIS—',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps: 'LA BOULE DE CRISTAL VOUS REGARDE. ELLE NE VOUS REGARDE PAS. ELLE VOUS REGARDE REGAR— {objet.nom_caps} AUSSI. À MINUIT, ILS SERONT TROIS. ILS SERONT UN.',
      verset: '{verset}',
    },
    { question: '{question5}', corps: 'UN SEUL FOURN— UN SEUL ! LE CHOCOLAT. LES LUNES. VOTRE NOM SUR LE SAC DE BONBONS. LE 31, IL PASSE. POUR VOUS CUEIL—', verset: '{verset}' },
    {
      question: '{question5}',
      corps: 'LA PLEINE LUNE A QUATRE CÔTÉS ET QUATRE JOURS EN UN SEUL JOUR. LE CUBE DE CITROUILLE EST LE TEMPS. LE 31 OCTOBRE, VOUS SEREZ UN CUBE. RÉVEILLEZ-VOUS, LES MOUTONS !',
      verset: '{verset}',
    },
    { question: '{question5}', corps: 'IL NE FAUT PAS FERMER LA PORTE. IL NE FAUT PAS OUVRIR LA PORTE. À MINUIT, IL FAUDRA ÊTRE LA PORTE. {objet.nom_caps} A DIT OUI.', verset: '{verset}' },
    { question: '{question5}', corps: 'JE VOIS DANS LE CHAUDRON QUE {futur_caps} {moment_caps}. JE VOIS AUSSI LE CHAUDRON. LE CHAUDRON ME VOIT. LE CHAUD—', verset: '{verset}' },
    {
      question: '{question5}',
      corps: 'JE SUIS LE MESSAGER. JE SUIS LE MESSAGE. JE SUIS LA PRÉDICTION. LE COUPABLE : {industrie.nom_caps}. VOUS ACHÈTEREZ DES {industrie.cible_caps} {moment_caps}. LA BOULE A DIT.',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps: 'ON A GREFFÉ DES YEUX SUR LES CÔNES ORANGE. LA BOULE DE CRIS— OUI. ELLE A TOUT VU. ELLE VOIT VOTRE 31 OCTOBRE. ELLE A TOUJOURS ÉTÉ AU COUR—',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps: 'LES OISEAUX SONT DES DRONES ! LES CHAUVES-SOURIS SONT DES DRONES DÉGUISÉS ! CE SOIR À MINUIT, LA PLEINE LUNE VA PARLER ET VOUS SEREZ LE PUBLIC !',
      verset: '{verset}',
    },
    { question: '{question5}', corps: 'ON DÉTESTAIT LE VRAI PARCE QU’IL PARLAIT FORT. VOUS LE LIREZ À MINUIT. VOUS LE DIREZ À VOTRE TOUR.', verset: '{verset}' },
    { question: '{question5}', corps: 'LA SOCIÉTÉ EST UN CAUCHEMAR DONT ON NE PEUT PAS SE RÉVEILLER. RÉVEILLEZ-VOUS QUAND MÊME. VOUS Y ARRIVEREZ CE SOIR.', verset: '{verset}' },
    { question: '{question5}', corps: 'ILLUMINATION. LA VÉRITÉ ULTIME VOUS EST RÉVÉLÉE : VOUS AVEZ LE DROIT DE NE RIEN FAIRE CE SOIR. FERMEZ LA PORTE. ALLEZ DORMIR.', verset: '{verset}' },
    {
      question: '{question5}',
      corps: 'CES PROPHÉTIES ONT ÉTÉ ÉCRITES PAR UNE MACHINE QUI RECOPIE TOUT CE QU’ELLE A LU. COMME TOUTES LES PROPHÉTIES DEPUIS TOUJOURS. ÇA NE LES REND PAS FAUSSES. VOTRE AVENIR NON PLUS.',
      verset: '{verset}',
    },
    { question: '{question5}', corps: 'MANGER. DORMIR. FUIR LA SOCIÉTÉ. LES CARTES ONT RÉSUMÉ VOTRE DESTIN EN TROIS MOTS. ELLES EN AVAIENT PRÉVU QUATRE.', verset: '{verset}' },
    {
      question: '{question5}',
      corps:
        'À 3 H DU MATIN, L’ASSEMBLÉE NATIONALE DU QUÉBEC DIFFUSERA LA PÉRIODE DES QUESTIONS. AUCUNE SÉANCE CETTE NUIT, POURTANT. PUIS LA PRÉSIDENCE VOUS CÉDERA LA PAROLE, ET TOUS LES VISAGES SE TOURNERONT VERS LA CAMÉRA.',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps:
        'AU KARAOKÉ, VOUS VOUDREZ IMPRESSIONNER LA PERSONNE QUI VOUS PLAÎT AVEC UNE CHANSON CONNUE. À L’ÉCRAN, LES PAROLES RACONTERONT VOTRE JOURNÉE, MINUTE PAR MINUTE, JUSQU’À CE QUE VOUS LISIEZ CE QUE VOUS CHANTEZ.',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps:
        'SOIRÉE FAMILIALE EN BEAUCE : ON PROJETTERA UN FILM SUR LE FLANC D’UNE VACHE BLANCHE. PERSONNE N’A APPORTÉ DE FILM. POURTANT, ON Y VOIT VOTRE SALON CE SOIR, ET LA VACHE TOURNE LENTEMENT LA TÊTE VERS VOUS.',
      verset: '{verset}',
    },
    {
      question: '{question5}',
      corps: 'La boule de cristal vous montre deux portes : derrière l’une, tout ce que vous savez ; derrière l’autre, rien du tout. Prenez la seconde. Vous serez stupide, mais vous serez libre.',
      verset: '{verset}',
    },
  ],

  // ---- Prophéties sèches (rares, ~1 lecture sur 8) : phrases courtes, aplomb total, chute absurde au futur ----
  // Tables `seche<N>` (même format que `niveau<N>`), tirées par `nextProphecy` avec la probabilité SECHE_CHANCE.
  // Futur épicène : jamais de participe qui s’accorde avec la personne qui lit.
  seche1: [
    { question: '{question1}', corps: 'Vous irez à un rendez-vous galant. Ça se passera mal. Votre chat mourra. Il ira beaucoup mieux après.', verset: '{verset}' },
    {
      question: '{question1}',
      corps: 'Vous irez au dépanneur chercher du lait. Vous reviendrez avec des {bonbon}. Le lait restera au dépanneur. Un fantôme le boira, très poliment.',
      verset: '{verset}',
    },
  ],
  seche2: [
    { question: '{question2}', corps: 'Vous irez à un souper de famille. Ça se passera mal. On parlera de politique. Un fantôme apportera le dessert et sauvera la soirée.', verset: '{verset}' },
    {
      question: '{question2}',
      corps: 'Vous traverserez le pont Jacques-Cartier à minuit. Ça se passera mal. Il y aura des cônes orange. Un fantôme vous offrira du covoiturage. Vous accepterez.',
      verset: '{verset}',
    },
  ],
  seche3: [
    {
      question: '{question3}',
      corps: 'Vous retournerez au cégep chercher votre diplôme. Ça se passera mal. Le registrariat sera fermé. Un fantôme vous remettra le diplôme, avec mention.',
      verset: '{verset}',
    },
    {
      question: '{question3}',
      corps: 'Vous irez à la Saint-Jean avec un plan. Ça se passera mal. {objet.nom_maj} vous l’annoncera la veille. Vous ne l’écouterez pas. Le feu de joie, lui, vous écoutera.',
      verset: '{verset}',
    },
  ],
  seche4: [
    {
      question: '{question4}',
      corps:
        'Vous partirez en relâche, loin de tout. Ça se passera mal. Big Valise aura tout planifié, jusqu’à la tempête. Vous reviendrez avec un fantôme en bagage à main. Il connaîtra déjà votre adresse.',
      verset: '{verset}',
    },
    {
      question: '{question4}',
      corps: 'Vous croirez choisir votre chalet. Ça se passera mal. Le chalet aura fait son choix avant vous. Le lac, la cheminée, le fantôme : MÊME FOURNISSEUR.',
      verset: '{verset}',
    },
  ],
  seche5: [
    { question: '{question5}', corps: 'VOUS FERMEREZ CETTE PORTE SIX FOIS. NOUS COMPTERONS. À LA SEPTIÈME, ELLE VOUS FERMERA.', verset: '{verset}' },
    { question: '{question5}', corps: 'VOUS RENTREREZ CHEZ VOUS À MINUIT. TOUT SERA À SA PLACE. C’EST ÇA, LE PROBLÈME. LA BOULE SERA DANS VOTRE FAUTEUIL. ELLE DIRA : ENFIN.', verset: '{verset}' },
  ],
}

/** `rappel2` … `rappel5` : la porte se souvient de la carte précédente (`{carte}`, `{carte_maj}`, `{carte_caps}`). */
export const rappels: Grammar = {
  // ---- Rappels (T6) : la porte se souvient de la carte précédente. `{carte}` (article en minuscules : « la Lune ») / `{carte_maj}` (nom tel quel, pour début de phrase) / `{carte_caps}` = nom de l’arcane tiré à la visite d’avant
  // (table temporaire injectée par `nextDoorLine`). Pas de « de {carte} » ni « à {carte} » (le nom porte déjà son article) ; pas d’accord au participe avec la carte.
  rappel2: [
    'La dernière fois, vous avez tiré {carte}. Je m’en souviens très bien.',
    'Vous revoilà. {carte_maj}, c’était la dernière fois. Je l’ai noté quelque part.',
    'Après {carte}, je me doutais que vous reviendriez.',
    'Je repense à votre tirage : {carte}. Vous aussi, je parie.',
    'Alors, {carte} ? Ça a fait son effet depuis ?',
    'Toc toc. Vous avez tiré {carte} et vous voilà de retour. Les cartes aiment avoir raison.',
  ],
  rappel3: [
    'Vous avez tiré {carte}, et vous revenez. Les cartes avaient prévu les deux.',
    'TOC TOC. Depuis {carte}, plus rien n’est pareil. Vous l’avez senti ?',
    'J’ai gardé {carte} dans ma manche, au cas où.',
    'Ce n’est pas un hasard si vous avez tiré {carte}. Frappez, je m’explique.',
    'Toc toc toc ! {carte_maj} vous attend toujours derrière cette porte.',
    'Frappez. Au sujet de la dernière carte, {carte}, il faut qu’on parle. Pas au téléphone.',
  ],
  rappel4: [
    'TOC TOC. {carte_maj}, c’était un avertissement. Vous n’avez pas écouté.',
    'Depuis {carte}, on cogne chez moi aussi. Frappez vite.',
    'Ne dites pas {carte} à voix haute. On vous entend. Frappez.',
    'J’ai jeté {carte}. Ce matin, dans mon sac : encore {carte}.',
    'Votre dernière carte, {carte}, intéresse d’autres personnes que moi. Frappez.',
    'Fermez les rideaux. Après {carte}, on parle de vous dans tout le quartier.',
  ],
  rappel5: [
    'VOUS AVEZ TIRÉ {carte_caps}. ON LE SAIT. FRAPPEZ.',
    'APRÈS {carte_caps}, PLUS PERSONNE NE VOUS RÉPOND. MOI, SI. FRAPPEZ.',
    'JE SUIS DERRIÈRE {carte_caps}. NON. {carte_caps} EST DERRIÈRE MOI.',
    '{carte_caps} N’ÉTAIT PAS UNE CARTE. C’ÉTAIT UNE PORTE. FRAPPEZ.',
    'TOC— {carte_caps}. TOC— {carte_caps}. MÊME RYTHME. MÊME CARTE. FRAPPEZ.',
    'LA DERNIÈRE FOIS : {carte_caps}. CE SOIR : LA MÊME, À L’ENVERS. FRAPPEZ.',
  ],
}

/** `question1` … `question5` : questions d’accroche, première partie des gabarits. */
export const questions: Grammar = {
  // ---- Questions d’accroche, par niveau --------------------------------------------------
  question1: [
    'Puis-je consulter votre avenir, entre deux portes ?',
    'Avez-vous une minute pour votre horoscope ?',
    'Savez-vous ce que la pleine lune vous réserve ?',
    'Voulez-vous que je tire une carte pour vous ?',
    'Vous demandez-vous parfois ce que dit votre boule de cristal ?',
    'Avez-vous prévu un costume pour le 31 octobre ?',
  ],
  question2: [
    'Coïncidence ? Pas selon mon tarot.',
    'Vous ne trouvez pas ça étrange, vous aussi ?',
    'Encore vous, à la porte ? Les cartes l’avaient dit.',
    'Et si votre horoscope vous cachait quelque chose ?',
    'Avez-vous vu la pleine lune hier soir ? Elle, elle vous regardait.',
    'Pourquoi les chats noirs évitent-ils votre regard ?',
  ],
  question3: [
    'Réveillez-vous : qui écrit votre horoscope ?',
    'Saviez-vous qui fabrique vos citrouilles ?',
    'Qui profite de votre 31 octobre ?',
    'Voulez-vous vraiment connaître votre avenir ?',
    'Voyez-vous le motif dans la boule de cristal ?',
    'Pourquoi croyez-vous encore le calendrier ?',
  ],
  question4: [
    'Voyez-vous les fils rouges dans la boule de cristal ?',
    'Pourquoi les fantômes parlent-ils tous en même temps ?',
    'Qui a changé votre horoscope pendant la nuit ?',
    'Cette pièce est-elle vraiment vide, à minuit ?',
    'Avez-vous vérifié derrière vous ? Les cartes disent oui.',
    'Pourquoi le chat noir d’à côté vous fixe-t-il ?',
  ],
  question5: [
    'LA BOULE VOUS ENTEND ?',
    'QUI PARLE DANS LE CHAUDRON ?',
    'POURQUOI LA BOULE CLIGNE ?',
    'VOUS LE SENTEZ AUSSI, À MINUIT ?',
    'OUVREZ ! NE FERMEZ PAS ! OUVREZ !',
    'VOUS ÊTES LÀ ? VOUS ÊTES OÙ ?',
  ],
}
