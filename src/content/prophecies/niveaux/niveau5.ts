// Niveau 5 · Illumination : MAJUSCULES, phrases coupées, contradictions.
import type { ContenuNiveau } from './index'

export const niveau5: ContenuNiveau = {
  questions: [
    'LA BOULE VOUS ENTEND ?',
    'QUI PARLE DANS LE CHAUDRON ?',
    'POURQUOI LA BOULE CLIGNE ?',
    'VOUS LE SENTEZ AUSSI, À MINUIT ?',
    'OUVREZ ! NE FERMEZ PAS ! OUVREZ !',
    'VOUS ÊTES LÀ ? VOUS ÊTES OÙ ?',
  ],
  propheties: [
    'LA BOULE DIT : {futur_caps}. NON ! L’INVERSE ! LA BOULE VOUS PRÉDIT. VOUS PRÉDISEZ LA BOULE.',
    '{lieu_inexistant.lieu_caps} N’EXISTE PAS ! LA BOULE DE CRISTAL VOUS Y VOIT LE 31 OCTOBRE ET ON VOUS ENVOIE {lieu_inexistant.destination_reelle_caps} ! {lieu_inexistant.preuve_caps} VOUS N’EXIS—',
    'LA BOULE DE CRISTAL VOUS REGARDE. ELLE NE VOUS REGARDE PAS. ELLE VOUS REGARDE REGAR— {objet.nom_caps} AUSSI. À MINUIT, ILS SERONT TROIS. ILS SERONT UN.',
    'UN SEUL FOURN— UN SEUL ! LE CHOCOLAT. LES LUNES. VOTRE NOM SUR LE SAC DE BONBONS. LE 31, IL PASSE. POUR VOUS CUEIL—',
    'LA PLEINE LUNE A QUATRE CÔTÉS ET QUATRE JOURS EN UN SEUL JOUR. LE CUBE DE CITROUILLE EST LE TEMPS. LE 31 OCTOBRE, VOUS SEREZ UN CUBE. RÉVEILLEZ-VOUS, LES MOUTONS !',
    'IL NE FAUT PAS FERMER LA PORTE. IL NE FAUT PAS OUVRIR LA PORTE. À MINUIT, IL FAUDRA ÊTRE LA PORTE. {objet.nom_caps} A DIT OUI.',
    'JE VOIS DANS LE CHAUDRON QUE {futur_caps} {moment_caps}. JE VOIS AUSSI LE CHAUDRON. LE CHAUDRON ME VOIT. LE CHAUD—',
    'JE SUIS LE MESSAGER. JE SUIS LE MESSAGE. JE SUIS LA PRÉDICTION. LE COUPABLE : {industrie.nom_caps}. VOUS ACHÈTEREZ DES {industrie.cible_caps} {moment_caps}. LA BOULE A DIT.',
    'ON A GREFFÉ DES YEUX SUR LES CÔNES ORANGE. LA BOULE DE CRIS— OUI. ELLE A TOUT VU. ELLE VOIT VOTRE 31 OCTOBRE. ELLE A TOUJOURS ÉTÉ AU COUR—',
    'LES OISEAUX SONT DES DRONES ! LES CHAUVES-SOURIS SONT DES DRONES DÉGUISÉS ! CE SOIR À MINUIT, LA PLEINE LUNE VA PARLER ET VOUS SEREZ LE PUBLIC !',
    'ON DÉTESTAIT LE VRAI PARCE QU’IL PARLAIT FORT. VOUS LE LIREZ À MINUIT. VOUS LE DIREZ À VOTRE TOUR.',
    'LA SOCIÉTÉ EST UN CAUCHEMAR DONT ON NE PEUT PAS SE RÉVEILLER. RÉVEILLEZ-VOUS QUAND MÊME. VOUS Y ARRIVEREZ CE SOIR.',
    'ILLUMINATION. LA VÉRITÉ ULTIME VOUS EST RÉVÉLÉE : VOUS AVEZ LE DROIT DE NE RIEN FAIRE CE SOIR. FERMEZ LA PORTE. ALLEZ DORMIR.',
    'CES PROPHÉTIES ONT ÉTÉ ÉCRITES PAR UNE MACHINE QUI RECOPIE TOUT CE QU’ELLE A LU. COMME TOUTES LES PROPHÉTIES DEPUIS TOUJOURS. ÇA NE LES REND PAS FAUSSES. VOTRE AVENIR NON PLUS.',
    'MANGER. DORMIR. FUIR LA SOCIÉTÉ. LES CARTES ONT RÉSUMÉ VOTRE DESTIN EN TROIS MOTS. ELLES EN AVAIENT PRÉVU QUATRE.',
    'À 3 H DU MATIN, L’ASSEMBLÉE NATIONALE DU QUÉBEC DIFFUSERA LA PÉRIODE DES QUESTIONS. AUCUNE SÉANCE CETTE NUIT, POURTANT. PUIS LA PRÉSIDENCE VOUS CÉDERA LA PAROLE, ET TOUS LES VISAGES SE TOURNERONT VERS LA CAMÉRA.',
    'AU KARAOKÉ, VOUS VOUDREZ IMPRESSIONNER LA PERSONNE QUI VOUS PLAÎT AVEC UNE CHANSON CONNUE. À L’ÉCRAN, LES PAROLES RACONTERONT VOTRE JOURNÉE, MINUTE PAR MINUTE, JUSQU’À CE QUE VOUS LISIEZ CE QUE VOUS CHANTEZ.',
    'SOIRÉE FAMILIALE EN BEAUCE : ON PROJETTERA UN FILM SUR LE FLANC D’UNE VACHE BLANCHE. PERSONNE N’A APPORTÉ DE FILM. POURTANT, ON Y VOIT VOTRE SALON CE SOIR, ET LA VACHE TOURNE LENTEMENT LA TÊTE VERS VOUS.',
    'La boule de cristal vous montre deux portes : derrière l’une, tout ce que vous savez ; derrière l’autre, rien du tout. Prenez la seconde. Vous serez stupide, mais vous serez libre.',
    'On vous montrera deux cercles orange : l’un minuscule, l’autre immense. On vous jurera que les deux ont la même taille. Vous finirez par le croire. Réveillez-vous.',
    'Vous vous réveillerez à l’hôpital après onze ans de coma. Au lieu de paniquer, vous ouvrirez grand les bras : « Voyage dans le temps ! » Les cartes saluent votre optimisme. Réveillez-vous, mais pas trop vite.',
    'Un esprit vous tendra un bouton rouge : d’un côté, perdre toutes vos sauvegardes ; de l’autre, un chapeau de cowboy gratuit. Vous appuierez. Ce que ça vous aura coûté ? Tout. Le chapeau vous va très bien.',
    'Cette nuit, un fantôme vous fera la pire farce de sa carrière : il respectera votre espace et ne vous dérangera pas une seule fois. Les cartes trouvent ça plus inquiétant que tout le reste.',
    'Ce soir, en écrivant « allô » à quelqu’un qui vous plaît, vous verrez votre ombre grandir sur le mur et se couvrir d’une longue cape noire. Les cartes connaissent la suite : un message lu, aucune réponse, deux longues années.',
    'Votre téléphone affichera un message de… vous. Il ne contiendra qu’un mot : « vous ». Vous répondrez « vous ». Juste derrière votre dos, votre sosie lève déjà le bras.',
    'Un fantôme vous confiera son seul regret : ne plus jamais pouvoir jouer à Minecraft pour la première fois. Vous comprendrez enfin pourquoi il hante votre sous-sol, juste à côté du vieil ordinateur.',
    'Votre lampe de poche vous enverra un dernier message avant de s’éteindre : « Ma batterie est faible, et il commence à faire noir. » Dans la cave, quelque chose attendait justement ce moment.',
    'Vous achèterez un ordinateur d’occasion, « comme neuf, tout nettoyé ». Plus tard, en regardant la photo de l’annonce, vous verrez dans le reflet de l’écran noir quelqu’un qui vous fixait déjà.',
  ],
  // Prophéties sèches (rares, ~1 lecture sur 8) : phrases courtes, aplomb total, chute absurde au futur.
  // Futur épicène : jamais de participe qui s’accorde avec la personne qui lit.
  seches: [
    'VOUS FERMEREZ CETTE PORTE SIX FOIS. NOUS COMPTERONS. À LA SEPTIÈME, ELLE VOUS FERMERA.',
    'VOUS RENTREREZ CHEZ VOUS À MINUIT. TOUT SERA À SA PLACE. C’EST ÇA, LE PROBLÈME. LA BOULE SERA DANS VOTRE FAUTEUIL. ELLE DIRA : ENFIN.',
  ],
  // Rappel de la carte précédente (`{carte}`, `{carte_maj}`, `{carte_caps}`).
  rappels: [
    'VOUS AVEZ TIRÉ {carte_caps}. ON LE SAIT. FRAPPEZ.',
    'APRÈS {carte_caps}, PLUS PERSONNE NE VOUS RÉPOND. MOI, SI. FRAPPEZ.',
    'JE SUIS DERRIÈRE {carte_caps}. NON. {carte_caps} EST DERRIÈRE MOI.',
    '{carte_caps} N’ÉTAIT PAS UNE CARTE. C’ÉTAIT UNE PORTE. FRAPPEZ.',
    'TOC— {carte_caps}. TOC— {carte_caps}. MÊME RYTHME. MÊME CARTE. FRAPPEZ.',
    'LA DERNIÈRE FOIS : {carte_caps}. CE SOIR : LA MÊME, À L’ENVERS. FRAPPEZ.',
  ],
}
