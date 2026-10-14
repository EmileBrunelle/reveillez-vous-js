import type { Grammar, ObjectTable, StringTable } from '../engine/grammar'

// --- helpers (le contenu est plus bas) --------------------------------------------------
const cap = (s: string) => s.charAt(0).toLocaleUpperCase('fr-CA') + s.slice(1)
const up = (s: string) => s.toLocaleUpperCase('fr-CA')

/** Chaque champ `x` d’une paire reçoit aussi `x_maj` (1re lettre en majuscule) et `x_caps` (TOUT EN MAJUSCULES). */
const paired = (entries: Record<string, string>[]): ObjectTable => {
  return entries.map((e) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(e)) {
      out[k] = v
      out[`${k}_maj`] = cap(v)
      out[`${k}_caps`] = up(v)
    }
    return out
  })
}

/** Table de chaînes `name` + sa variante `name_caps` (pour le niveau 5). */
const withCaps = (name: string, items: StringTable): Grammar => {
  return { [name]: items, [`${name}_maj`]: items.map(cap), [`${name}_caps`]: items.map(up) }
}

export const prophecies: Grammar = {
  // Entrée historique (compat) : un niveau au hasard. Les vrais points d’entrée sont niveau1 … niveau5.
  gabarit: ['{niveau1}', '{niveau2}', '{niveau3}', '{niveau4}', '{niveau5}'],

  // ---- Niveau 1 · Curieux·se : poli, presque raisonnable -------------------------------
  // Chaque gabarit = une prédiction sur l’avenir de la personne + un élément de voyance ou d’Halloween.
  niveau1: [
    '{question1}|{objet.nom_maj} me le murmure depuis ce matin : {futur} {moment}. Rien de grave, rassurez-vous.|{verset}',
    '{question1}|D’après la pleine lune, vous passerez une très belle semaine. Une personne en drap blanc vous demandera du sel. Donnez-lui-en.|{verset}',
    '{question1}|Le 31 octobre, de petites créatures sonneront chez vous. Vous aurez peur du ninja de six ans. Les cartes savent pourquoi.|{verset}',
    '{question1}|J’ai tiré une carte : une belle journée vous attend {moment}. Le chat noir, lui, aura une journée terrible. Je ne dis pas pourquoi.|{verset}',
    '{question1}|Dans la boule de cristal, je vois une porte, une main et un petit sac de {bonbon}. La porte, c’est la vôtre. La main, c’est la mienne.|{verset}',
    '{question1}|{industrie.inventeur_maj} {industrie.produit} pour nous vendre plus de {industrie.cible}, dit-on. Moi, je lis seulement {objet.nom}, et j’y vois que {futur} {moment}.|{verset}',
    '{question1}|À minuit, ce soir, vous entendrez peut-être un léger craquement. Ce sera un fantôme poli qui cherche l’interrupteur.|{verset}',
    '{question1}|{fete.nom_maj} approche. Ma boule de cristal prévoit que vous y achèterez des {fete.cible}. Presque sûrement.|{verset}',
    '{question1}|Avant la fin de la semaine, une personne vous dira que les gens qui parlent en français, iels ont tellement de charisme. Vous ne la contredirez pas.|{verset}',
    '{question1}|Cette semaine, quelqu’un vous offrira une citrouille. Acceptez-la : ce sera la première d’une longue série.|{verset}',
    '{question1}|Vous entrerez chez Renaud-Bray pour acheter un livre. Vous ressortirez avec une planche à découper en bambou et des chandelles. Les cartes l’avaient prévu.|{verset}',
    '{question1}|Les cartes sont formelles : le fromage en grains ne doit pas fondre. Quelqu’un, quelque part, met sa poutine au micro-ondes en ce moment. Les cartes pleurent.|{verset}',
    '{question1}|Votre téléphone contient 4 000 photos du même chat. Ce soir, vous en prendrez une 4 001ᵉ. Les cartes la trouvent très réussie.|{verset}',
    '{question1}|Ce week-end, au hockey bottine, vous serez encore pogné·e dans les buts. Les cartes l’ont vu venir. Elles ont aussi vu la rondelle.|{verset}',
    '{question1}|Les cartes voient votre fin de session : 76 tasses de café. Elles voient aussi la 77ᵉ. Elles vous déconseillent la 78ᵉ.|{verset}',
  ],

  // ---- Niveau 2 · Suspicieux·se : les liens apparaissent ----------------------------------
  niveau2: [
    '{question2}|Ma boule de cristal annonce que {futur} {moment}. Exactement comme je l’avais prédit. Exactement comme on l’avait prévu.|{verset}',
    '{question2}|{objet.nom_maj} montre un chat noir, puis un fantôme, puis un sac de {bonbon}. Dans cet ordre. Pour vous. Le 31 octobre.|{verset}',
    '{question2}|Mon tarot est clair : {futur} {moment}. Je ne crois pas aux coïncidences, je lis les cartes.|{verset}',
    '{question2}|{industrie.inventeur_maj} {industrie.produit} pour nous vendre plus de {industrie.cible}. Et par hasard, la pleine lune vous annonce un achat de {industrie.cible} {moment}. Coïncidence ?|{verset}',
    '{question2}|Saint-Clin-Clin-des-Meuh-Meuh est sur ma carte. Ma carte date de 1987. Vous y déménagerez le 1er juillet, sans camion.|{verset}',
    '{question2}|On vous aperçoit {lieu}, déguisé·e en citrouille, {moment}. Non, ne niez pas : c’est dans votre horoscope.|{verset}',
    '{question2}|Trois chats noirs, deux fantômes, un seul fournisseur de {bonbon}. Mon tarot en tire une conclusion : vous passerez la nuit du 31 octobre à compter vos bonbons.|{verset}',
    '{question2}|Ce soir, à minuit, {objet.nom} va changer de couleur. Si vous ne le voyez pas, c’est que vous en faites partie.|{verset}',
    '{question2}|Vous avez rouvert la porte. Avant même que je frappe, {objet.nom} l’avait annoncé. J’ai noté l’heure. Vous aussi, je pense.|{verset}',
    '{question2}|Ce soir, vous remettrez une araignée dehors au lieu de l’écraser. Vous vous sentirez sage. Elle mourra d’hypothermie. Les cartes ne jugent pas.|{verset}',
    '{question2}|En vous, il y a deux loups. L’un veut du Paris Pâté. L’autre veut des sardines. Les cartes savent lequel gagnera demain matin. Elles ne le diront pas.|{verset}',
    '{question2}|Les cartes sont formelles : les Nordiques reviendront. Les Expos aussi. Les cartes disent ça depuis 1995. Elles sont patientes.|{verset}',
    '{question2}|Une malédiction pèse sur vous : le chili du Tim, avec le p’tit pain et les deux beurres. Vous y retournerez demain. Les cartes ne peuvent rien pour vous.|{verset}',
    '{question2}|Votre carte est le Magicien du Québec. Dès que quelque chose arrive dans votre vie, vous lancez un sort. Le sort s’appelle “Tabarnouche”. Il est très efficace.|{verset}',
    '{question2}|En entrevue, on vous demandera d’expliquer le trou de trois ans dans votre CV. Répondez : “J’étais chez une voyante.” C’est la vérité.|{verset}',
    '{question2}|Un·e touriste vous demandera où est « le vrai Québec ». Vous pointerez au loin. Cette personne aura tort. Vous aussi.|{verset}',
    '{question2}|Ce temps des fêtes, vous recevrez une bouteille de whisky à l’érable. Vous l’offrirez à quelqu’un d’autre l’an prochain. Les cartes ont vu son voyage : elle circule depuis 2014.|{verset}',
  ],

  // ---- Niveau 3 · Convaincu·e : fausses fêtes, Big Citrouille dans l’ombre ---------------------
  niveau3: [
    '{question3}|{fete.nom_maj} est une fausse fête inventée par {fete.industrie} pour vendre plus de {fete.cible}. Ma boule de cristal prédit que vous en achèterez cette année encore.|{verset}',
    '{question3}|Votre costume de cette année est déjà choisi : {objet.nom} l’a vu en rêve. Vous serez, au choix, un fantôme ou un drap. Ce sera le même.|{verset}',
    '{question3}|{objet.nom_maj} l’annonce : à l’Halloween, vous croirez partir {lieu_inexistant.en}. Vous arriverez {lieu_inexistant.destination_reelle}. Comme tout le monde.|{verset}',
    '{question3}|Ce n’est pas moi qui le dis, ce sont vos cartes : {futur} {moment}. Notez l’heure, et gardez une chandelle.|{verset}',
    '{question3}|Je vois dans votre chaudron un avenir bien chaud : {futur} {moment}. Ne laissez personne remuer la soupe à votre place.|{verset}',
    '{question3}|La pleine lune de ce mois portera votre nom. Elle portera aussi celui de votre voisin, par souci d’équité. Elle en sera ravie. Vous, moins.|{verset}',
    '{question3}|Cette année, vous gagnerez le concours du meilleur costume. Ce n’est pas une prédiction, c’est un avertissement : le jury est un chat noir.|{verset}',
    '{question3}|Réveillez-vous, les moutons ! {futur_maj} {moment}. C’est écrit dans le tarot, entre le prix de l’essence et le jour de l’An.|{verset}',
    '{question3}|{objet.nom_maj} vous regarde. Pas pour vous protéger : pour mesurer vos réserves de {bonbon} avant le 31 octobre.|{verset}',
    '{question3}|Le 31 octobre, à minuit, un fantôme vous demandera si {fete.nom} est une vraie fête. Répondez non. Big Citrouille y verra une provocation.|{verset}',
    '{question3}|Les cartes voient votre prochain logement : une ancienne cuisine de restaurant, un poteau au milieu du salon, 10 500 $ par mois. Non chauffé. Vous signerez quand même.|{verset}',
    '{question3}|Cinq chats noirs dans un grand manteau vous demanderont l’heure. Répondez poliment. L’un d’eux sera un jour premier ministre.|{verset}',
    '{question3}|Les cartes voient un crime : une poutine au fromage râpé, servie dans un festival. Le coupable court toujours.|{verset}',
    '{question3}|Pleine lune sur la Belle Province. Quelque chose hurlera dans votre rue. Ne lui ouvrez pas : il a déjà le rythme.|{verset}',
    '{question3}|Cet hiver, par −30, vous direz que vous aimez l’hiver. Avec un chapeau de poil et un café. Les cartes savent que vous mentez. Elles mentent aussi.|{verset}',
    '{question3}|Vous êtes né·e pour mener une carriole sous la pleine lune. Demain matin, vous ouvrirez Teams. Les cartes compatissent.|{verset}',
  ],

  // ---- Niveau 4 · Paranoïaque : tout est lié, MÊME FOURNISSEUR ----------------------------------
  niveau4: [
    '{question4}|La boule de cristal, la citrouille, l’horoscope du journal : MÊME FOURNISSEUR. Prédiction : le 31 octobre, vous le comprendrez, mais trop tard.|{verset}',
    '{question4}|Dans ma boule de cristal, le fil rouge passe {lieu}, puis par votre porte, {moment}. Je n’invente rien. Je lis.|{verset}',
    '{question4}|Mes notes : les {bonbon}, les costumes, les cônes orange, la neige. MÊME FOURNISSEUR. La pleine lune prédit qu’il repassera {moment}. Cachez votre citrouille.|{verset}',
    '{question4}|Votre horoscope a changé pendant la nuit. Quelqu’un l’a réécrit au crayon rouge : {futur} {moment}. Je n’ai pas touché à la citrouille.|{verset}',
    '{question4}|Ne regardez pas par la fenêtre le 31 octobre. Les oiseaux sont des drones, déguisés en chauves-souris. Ils attendent {moment}.|{verset}',
    '{question4}|Je relie {industrie.nom}, {fete.nom} et {objet.nom} avec du fil rouge. Le dessin forme un fantôme. Il vous ressemble. Il vous attend {moment}.|{verset}',
    '{question4}|Cette nuit, {objet.nom} a bougé sans mon aide. Ma prédiction : {futur} {moment}. Ma deuxième prédiction : la même, en pire.|{verset}',
    '{question4}|Soyez prudent·e à minuit : le chat noir du voisin n’est pas un chat, c’est une antenne. La pleine lune la recharge. Vous le verrez {moment}.|{verset}',
    '{question4}|La montgolfière de Saint-Jean plane au-dessus de votre maison. Elle sourit. Elle ne redescendra pas avant le 31.|{verset}',
    '{question4}|Réveillez-vous. Montréal n’a jamais existé. Regardez une carte : c’est le Grand Lac Saint-Laurent. Ils ont tout peint.|{verset}',
    '{question4}|Les cartes voient une petite décision : une tablette achetée en solde. Puis un chalet. Puis un lac. Puis plus rien.|{verset}',
    '{question4}|Réveillez-vous. La Floride était une région du Québec. Cette année, vos grands-parents ont passé l’hiver à Saint-Sauveur. Les cartes ont tout redessiné.|{verset}',
  ],

  // ---- Niveau 5 · Illuminé·e : MAJUSCULES, phrases coupées, contradictions ----------------------
  niveau5: [
    '{question5}|LA BOULE DIT : {futur_caps}. NON ! L’INVERSE ! LA BOULE VOUS PRÉDIT. VOUS PRÉDISEZ LA BOULE.|{verset}',
    '{question5}|{lieu_inexistant.lieu_caps} N’EXISTE PAS ! LA BOULE DE CRISTAL VOUS Y VOIT LE 31 OCTOBRE ET ON VOUS ENVOIE {lieu_inexistant.destination_reelle_caps} ! {lieu_inexistant.preuve_caps} VOUS N’EXIS—|{verset}',
    '{question5}|LA BOULE DE CRISTAL VOUS REGARDE. ELLE NE VOUS REGARDE PAS. ELLE VOUS REGARDE REGAR— {objet.nom_caps} AUSSI. À MINUIT, ILS SERONT TROIS. ILS SERONT UN.|{verset}',
    '{question5}|UN SEUL FOURN— UN SEUL ! LE CHOCOLAT. LES LUNES. VOTRE NOM SUR LE SAC DE BONBONS. LE 31, IL PASSE. POUR VOUS CUEIL—|{verset}',
    '{question5}|LA PLEINE LUNE A QUATRE CÔTÉS ET QUATRE JOURS EN UN SEUL JOUR. LE CUBE DE CITROUILLE EST LE TEMPS. LE 31 OCTOBRE, VOUS SEREZ UN CUBE. RÉVEILLEZ-VOUS, LES MOUTONS !|{verset}',
    '{question5}|IL NE FAUT PAS FERMER LA PORTE. IL NE FAUT PAS OUVRIR LA PORTE. À MINUIT, IL FAUDRA ÊTRE LA PORTE. {objet.nom_caps} A DIT OUI.|{verset}',
    '{question5}|JE VOIS DANS LE CHAUDRON QUE {futur_caps} {moment_caps}. JE VOIS AUSSI LE CHAUDRON. LE CHAUDRON ME VOIT. LE CHAUD—|{verset}',
    '{question5}|JE SUIS LE MESSAGER. JE SUIS LE MESSAGE. JE SUIS LA PRÉDICTION. LE COUPABLE, C’EST {industrie.nom_caps}. VOUS ACHÈTEREZ DES {industrie.cible_caps} {moment_caps}. LA BOULE A DIT.|{verset}',
    '{question5}|ILS ONT GREFFÉ DES YEUX SUR LES CÔNES ORANGE. LA BOULE DE CRIS— OUI. ELLE A TOUT VU. ELLE VOIT VOTRE 31 OCTOBRE. ELLE A TOUJOURS ÉTÉ AU COUR—|{verset}',
    '{question5}|LES OISEAUX SONT DES DRONES ! LES CHAUVES-SOURIS SONT DES DRONES DÉGUISÉS ! CE SOIR À MINUIT, LA PLEINE LUNE VA PARLER ET VOUS SEREZ LE PUBLIC !|{verset}',
    '{question5}|ILS DÉTESTAIENT LE VRAI PARCE QU’IL PARLAIT FORT. VOUS LE LIREZ À MINUIT. VOUS LE DIREZ À VOTRE TOUR.|{verset}',
    '{question5}|LA SOCIÉTÉ EST UN CAUCHEMAR DONT ON NE PEUT PAS SE RÉVEILLER. RÉVEILLEZ-VOUS QUAND MÊME. VOUS Y ARRIVEREZ CE SOIR.|{verset}',
    '{question5}|ILLUMINATION. LA VÉRITÉ ULTIME VOUS EST RÉVÉLÉE : VOUS AVEZ LE DROIT DE NE RIEN FAIRE CE SOIR. FERMEZ LA PORTE. ALLEZ DORMIR.|{verset}',
    '{question5}|CES PROPHÉTIES ONT ÉTÉ ÉCRITES PAR UNE MACHINE QUI RECOPIE TOUT CE QU’ELLE A LU. COMME TOUTES LES PROPHÉTIES DEPUIS TOUJOURS. ÇA NE LES REND PAS FAUSSES. VOTRE AVENIR NON PLUS.|{verset}',
    '{question5}|MANGER. DORMIR. FUIR LA SOCIÉTÉ. LES CARTES ONT RÉSUMÉ VOTRE DESTIN EN TROIS MOTS. ELLES EN AVAIENT PRÉVU QUATRE.|{verset}',
  ],

  // ---- Phrases de porte : la porte reste fermée, la personne frappe ; la voix derrière frappe un rythme et invite à le répéter
  porte1: [
    'Toc toc toc… Voilà mon rythme. À votre tour : frappez la même chose.',
    'Bonsoir ! Écoutez bien, je ne le répéterai pas. Enfin si, mais pas gratuitement.',
    'Toc toc. Je suis voyant·e, je sais déjà que vous êtes là. Frappez comme moi, pour la forme.',
    'Écoutez ce rythme, puis frappez-le. Ensuite, nous parlerons {objet.de}.',
    'Je ne vends rien. Je teste seulement votre oreille, avec des bonbons à la clé.',
    'Il paraît que vous voulez connaître le futur. Rendez-moi le rythme, on commence.',
    'Bonjour ! Avez-vous l’oreille musicale ? La boule de cristal, elle, a le sens du rythme.',
    'Je vous donne un rythme, vous me le rendez. C’est la politique de la maison.',
    'Toc toc toc… Écoutez, puis frappez. Le futur n’aime pas qu’on l’interrompe.',
    'Vous cognez en français ? J’adore le français. J’adore le ç. “Ça”, avec sa cédille : quel beau mot. Répétez mon rythme.',
  ],
  porte2: [
    'Toc toc toc… Encore vous. La boule de cristal m’avait dit que vous frapperiez.',
    'Vous cognez en français ? Les gens qui parlent en français, iels ont tellement de charisme… Répétez mon rythme.',
    'Toc toc. J’ai changé le rythme depuis la dernière fois. Vous l’aviez remarqué ?',
    'Écoutez bien : les cartes ont insisté pour que je vous teste. Moi, je voulais dormir.',
    'Toc toc. Frappez-moi ça. Il y a eu des développements au sujet {objet.de}.',
    'Deuxième visite. Coïncidence ? Mon tarot ne croit pas aux coïncidences. Répétez le rythme.',
    'Toc toc toc… Je reconnais votre façon de frapper. Je ne devrais pas, vous n’avez pas encore frappé.',
    'On m’a dit de ne pas vous répondre. La pleine lune a dit le contraire. Frappez.',
    'J’ai une question sur {industrie.nom}. D’abord, le rythme. La boule le trouve important.',
    'Il y avait quelqu’un derrière vous la dernière fois. Frappez doucement, au cas où.',
    'Vous avez dit “knock knock” ? Ici, on dit toc toc. Recommencez, en français.',
    'Les fêtes ? Je m’en fous. Halloween ? Même pas, je m’en fous aussi. Je suis amoureuse de mes citrouilles, c’est tout. Répétez mon rythme.',
  ],
  porte3: [
    'TOC TOC TOC. Je sais que c’est vous. Frappez ce rythme et je vous dirai pourquoi.',
    'Toc toc toc ! Réveillez-vous, il est temps de parler de Big Citrouille. Après le rythme.',
    'TOC TOC. J’ai des preuves. Elles sont dans un sac à bonbons. Frappez, je les sors.',
    'Toc toc toc ! Vous voulez savoir qui a inventé {fete.nom} ? Mes cartes savent. Rythme d’abord.',
    'TOC TOC TOC. Je suis le message. La vérité ne sonne pas, elle cogne. Cognez à votre tour.',
    'Toc toc ! Frappez avant qu’on vous vende encore des {fete.cible}.',
    'Toc toc toc ! Votre façon de frapper est dans mon jeu de tarot. Il y a des flèches dessus.',
    'TOC TOC. Les citrouilles vous mentent. Pas mon rythme. Répétez-le.',
    'Toc toc toc ! La personne qui frappe juste change son destin. Frappez.',
  ],
  porte4: [
    'TOC TOC TOC. Ne dites rien. Les fantômes écoutent. Frappez doucement le même rythme.',
    'Toc toc. MÊME FOURNISSEUR. Frappez, je vous expliquerai avec du fil rouge et ma boule de cristal.',
    'TOC TOC TOC ! Éteignez la lumière, puis frappez. Non, frappez, puis éteignez.',
    'Toc. Toc. Toc. Quelqu’un me suit depuis {fete.nom}. Frappez vite, qu’il croie que c’est vous.',
    'TOC TOC. Je vois votre souper dans la boule. Je vois aussi que {futur}. Frappez.',
    'Toc toc toc… Vérifiez {lieu}. Maintenant frappez mon rythme.',
    'TOC TOC TOC ! Le fil rouge passe par votre poing ! Frappez comme moi !',
    'Toc toc. Parlez bas : {objet.nom} écoute tout le voisinage. Frappez plutôt.',
    'TOC TOC. Ce n’est pas le facteur, ce n’est pas le livreur, c’est pire : c’est mon rythme. Répétez-le.',
    'Ce soir, quelqu’un d’autre cognera à votre porte. C’est une dinde sauvage. Elle est plus grande que vous. Elle connaît le rythme.',
  ],
  porte5: [
    'FRAPPEZ. ILS ÉCOUTENT PAR LE TROU DE LA SERRURE.',
    'TOC TOC TOC TOC TOC TOC TOC— VOUS N’ÊTES PAS CHEZ VOUS. FRAPPEZ.',
    'LA BOULE DE CRISTAL M’A DIT VOTRE ADRESSE. ELLE A AUSSI DIT DE NE PAS RÉPON— FRAPPEZ.',
    'TOC— ATTENDEZ. NON. TOC. C’EST VOUS QUI FRAPPEZ, C’EST MOI QUI ÉCOUTE. NON. L’INVERSE.',
    'FRAPPEZ ! ARRÊTEZ ! LES DEUX ! EN MÊME TEMPS !',
    'JE SUIS DERRIÈRE LA PORTE. JE SUIS DEVANT LA PORTE. JE SUIS {objet.nom_caps}.',
    'TOC TOC. C’EST MOI QUI FRAPPE. C’EST VOUS QUI RÉPONDEZ. RE— REGARDEZ LA CITROUILLE.',
    'MÊME FOURNISSEUR ! MÊME PORTE ! MÊME RYTHME ! RÉPÉTEZ {moment_caps} !',
    'LE CHAT NOIR A DIT QUE VOUS ÉTIEZ LÀ. VOUS N’ÊTES PAS LÀ. FRAPPEZ QUAND MÊME.',
    'TOC TOC TOC. IL N’Y A PERSONNE. IL N’Y A JAMAIS PERSONNE. FRAPPEZ À PERSONNE.',
  ],

  // ---- Ratés : dits derrière la porte quand le rythme est mauvais (≤ ~110 caractères) ----------
  rate1: [
    'Vous avez mal écouté. Je recommence, doucement.',
    'Pas tout à fait. Les cartes disent : encore une fois.',
    'Presque ! Tendez l’oreille, c’est un art.',
    'Hmm, non. Mon rythme, pas le vôtre. Réessayez.',
  ],
  rate2: [
    'Ce n’était pas ça. Vous le saviez, n’est-ce pas ?',
    'Étrange. Hier, vous l’aviez réussi du premier coup.',
    'Non. Quelque chose dans le mur a frappé avec vous.',
    'Faux. La boule de cristal a fait la grimace.',
  ],
  rate3: [
    'FAUX. Vous le faites exprès, la boule l’a vu.',
    'Ce n’est pas mon rythme. C’est celui du voisinage. Pourquoi ?',
    'Non. Écoutez mieux : ils frappent aussi, derrière vous.',
    'Mal. Mes cartes avaient prévu cette erreur. Elles s’en lassent.',
    'Vous montez la côte, la côte vous remonte. Recommencez.',
  ],
  rate4: [
    'NON. Pas comme ça. Ils ont entendu. Recommencez.',
    'Ce n’était pas votre main, ça. Chut. Encore.',
    'Trop fort ! Le fil rouge a vibré. Doucement, encore.',
    'Faux. Il y a un écho dans l’escalier. Ce n’est pas le mien.',
    'CESSE. Mon rythme n’avait pas autant de coups.',
  ],
  rate5: [
    'FAUX. FAUX. FAUX. C’ÉTAIT MOI QUI FRAPPAIS. C’ÉTAIT TOUJOURS MOI.',
    'NON ! LE RYTHME EST DANS LA PORTE. ÉCOUTEZ LA PORTE !',
    'MAL ÉCOUTÉ ! LA CITROUILLE A COMPTÉ. ELLE A COMPTÉ AUTREMENT.',
    'ENCORE. ENCORE. ENCORE. LA LUNE ATTEND VOTRE MAIN.',
    'ABRACADA… FARME-LA. Écoutez mon rythme.',
    'Non merci, vous utilisez l’IA ? Elle non plus ne sait pas cogner. Utilisez votre cerveau. Recommencez.',
  ],

  // ---- Après 3 ratés : la voix abandonne et ouvre quand même ---------------------------------
  entrez: ['Bon. Entrez, on n’a pas toute la nuit.', 'Trois essais. Ça suffit : je vous ouvre. Ne touchez à rien.', 'Les cartes disent d’abandonner. Entrez, ce n’est pas verrouillé.'],

  // ---- Questions d’accroche, par niveau --------------------------------------------------
  question1: [
    'Puis-je consulter votre avenir, entre deux portes ?',
    'Avez-vous une minute pour votre horoscope ?',
    'Savez-vous ce que la pleine lune vous réserve ?',
    'Voulez-vous que je tire une carte pour vous ?',
    'Vous êtes-vous déjà demandé ce que dit votre boule de cristal ?',
    'Avez-vous prévu un costume pour le 31 octobre ?',
  ],
  question2: [
    'Coïncidence ? Pas selon mon tarot.',
    'Vous ne trouvez pas ça étrange, vous aussi ?',
    'Encore vous, à la porte ? Les cartes l’avaient dit.',
    'Et si votre horoscope vous cachait quelque chose ?',
    'Avez-vous vu la pleine lune hier soir ? Elle, elle vous a vu·e.',
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
    'Êtes-vous seul·e dans cette pièce, à minuit ?',
    'Avez-vous vérifié derrière vous ? Les cartes disent oui.',
    'Pourquoi le chat noir du voisin vous fixe-t-il ?',
  ],
  question5: [
    'LA BOULE VOUS ENTEND ?',
    'QUI PARLE DANS LE CHAUDRON ?',
    'POURQUOI LA BOULE CLIGNE ?',
    'VOUS LE SENTEZ AUSSI, À MINUIT ?',
    'OUVREZ ! NE FERMEZ PAS ! OUVREZ !',
    'VOUS ÊTES LÀ ? VOUS ÊTES PARTI·E ?',
  ],

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
    { nom: 'Big Poutine', inventeur: 'Big Poutine a inventé', produit: 'les frites', cible: 'fromage en grains' },
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
  ],

  // ---- Tables de chaînes partagées ---------------------------------------------------------
  // `futur` : proposition complète (« vous … »), à placer après « : » ou « que ». Compléments de temps dans `moment`.
  ...withCaps('futur', [
    'vous croiserez un chat noir qui vous jugera',
    'vous trouverez une orange dans votre sac de bonbons',
    'vous recevrez un courriel parfaitement inutile',
    'quelqu’un vous offrira une citrouille que vous n’avez pas demandée',
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

  // Verset = livre + référence (tirés séparément par le moteur : le livre via un sac persisté, la référence au hasard).
  verset_livre: [
    'Citrouilles',
    'Chaudron',
    'Boule de cristal',
    'Tarot',
    'Poutine',
    'Déménagement',
    'Hiver',
    'Cônes orange',
    'Nids-de-poule',
    'Pleine lune',
    'Tempête de verglas',
    'Sloche',
    'Dépanneur',
    'Bonbons',
    'Fantômes',
    'Grimoire',
    'Horoscope',
    'Calcul',
    'Apocalypse.js',
    'Qc',
    'Chats noirs',
    'Épouvantail',
    'Balai',
    'Toile d’araignée',
    'Minuit',
    'Brouillard',
    'Sirop d’érable',
    'Tuque',
    'Ruelle',
    'Bac de recyclage',
    'Patinoire',
    'Chandelle',
    'Hibou',
    'Chauve-souris',
    'Cimetière',
    'Fromage en grains',
    'Corvée',
    'Ouija',
    'Feuilles mortes',
    'Poudrerie',
  ],

  verset_ref: [
    '3:13',
    '10:31',
    '6:66',
    '4:04',
    '13:13',
    '12:00',
    '3:14',
    '1:1',
    '22:0',
    '31:10',
    '2:22',
    '7:77',
    '11:30',
    '1:31',
    '5:55',
    '0:00',
    '11:11',
    '24:7',
    '4:18',
    '1:7',
    '12:12',
    '2:3',
    '6:6',
    '8:08',
  ],
}

// Structure par niveaux (le moteur choisit la clé de départ selon le nombre d’ouvertures de porte) :
//  - `niveau1` Curieux·se · `niveau2` Suspicieux·se · `niveau3` Convaincu·e · `niveau4` Paranoïaque · `niveau5` Illuminé·e.
//  - Chaque niveau = 8-10 gabarits « question|corps|verset » (séparés par « | »). Questions par niveau : `question1` … `question5`.
//  - Tables partagées : `industrie`, `fete`, `objet` (paires), `futur`, `moment`, `bonbon`, `lieu`, `verset_livre` + `verset_ref` (chaînes ; « Livre ch:v », ex. « Pleine lune 3:13 »).
//  - `porte1` … `porte5` : phrases de porte (voix derrière la porte qui frappe un rythme), 8-10 lignes par niveau.
//  - `rate1` … `rate5` : 4 à 6 phrases par niveau quand le rythme est raté ; `entrez` : 3 phrases après 3 ratés.
//  - `gabarit` = ancien point d’entrée (un niveau au hasard), gardé pour compatibilité.
// Conventions :
//  - Écriture inclusive : épicène d’abord (« les personnes », « toute personne », « vous ») ; sinon point médian
//    (« élu·e·s », « seul·e »). Point médian = personnes seulement ; objets accordés normalement ou tournure sans accord.
//  - Pas d’article contracté ni d’accord de verbe dans les gabarits : mets-les dans les champs
//    (`inventeur` = « Big Bougie a inventé », `de` = « du jour de Pi », `a` = « au tarot »).
//  - Chaque champ `x` d’une paire a aussi `x_maj` (majuscule initiale, pour début de phrase) et `x_caps` (niveau 5).
//    Les chaînes `futur`, `moment`, `bonbon` ont une variante `_caps`.
//  - Garde chaque paire cohérente : l’entrée est tirée une seule fois par prophétie, tous ses champs vont ensemble.
//  - Les valeurs peuvent contenir des {références} imbriquées (profondeur max : 8). Jamais de « | » dans une valeur.
