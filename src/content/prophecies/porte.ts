// Phrases dites par la voix derrière la porte : le rythme frappé et l’invitation à le répéter.
// Format : chaînes simples, avec `{table}` / `{table.champ}` possibles (voir `tables.ts`).
import type { Grammar } from '../../engine/grammar'

/** `porte1` … `porte5` (invitations), `rate1` … `rate5` (rythme raté, ≤ ~110 caractères) et `entrez` (après 3 ratés). */
export const portes: Grammar = {
  // ---- Phrases de porte : la porte reste fermée, la personne frappe ; la voix derrière frappe un rythme et invite à le répéter
  porte1: [
    'Toc toc toc… Voilà mon rythme. À votre tour : frappez la même chose.',
    'Bonsoir ! Écoutez bien, je ne le répéterai pas. Enfin si, mais pas gratuitement.',
    'Toc toc. Je vois l’avenir, je sais déjà que vous êtes là. Frappez comme moi, pour la forme.',
    'Écoutez ce rythme, puis frappez-le. Ensuite, nous parlerons {objet.de}.',
    'Je ne vends rien. Je teste seulement votre oreille, avec des bonbons à la clé.',
    'Il paraît que vous voulez connaître le futur. Rendez-moi le rythme, on commence.',
    'Bonjour ! Avez-vous l’oreille musicale ? La boule de cristal, elle, a le sens du rythme.',
    'Je vous donne un rythme, vous me le rendez. C’est la politique de la maison.',
    'Toc toc toc… Écoutez, puis frappez. Le futur n’aime pas qu’on l’interrompe.',
    'Vous cognez en français ? J’adore le français. J’adore le ç. « Ça », avec sa cédille : quel beau mot. Répétez mon rythme.',
  ],
  porte2: [
    'Toc toc toc… Encore vous. La boule de cristal m’avait dit que vous frapperiez.',
    'Vous cognez en français ? Les gens qui parlent en français ont tellement de charisme… Répétez mon rythme.',
    'Toc toc. J’ai changé le rythme depuis la dernière fois. Vous l’aviez remarqué ?',
    'Écoutez bien : les cartes ont insisté pour que je vous teste. Moi, je voulais dormir.',
    'Toc toc. Frappez-moi ça. Il y a eu des développements au sujet {objet.de}.',
    'Deuxième visite. Coïncidence ? Mon tarot ne croit pas aux coïncidences. Répétez le rythme.',
    'Toc toc toc… Je reconnais votre façon de frapper. Je ne devrais pas, vous n’avez pas encore frappé.',
    'On m’a dit de ne pas vous répondre. La pleine lune a dit le contraire. Frappez.',
    'J’ai une question sur {industrie.nom}. D’abord, le rythme. La boule le trouve important.',
    'Il y avait une présence derrière vous la dernière fois. Frappez doucement, au cas où.',
    'Vous avez dit « knock knock » ? Ici, on dit toc toc. Recommencez, en français.',
    'Les fêtes ? Je m’en fous. Halloween ? Même pas, je m’en fous aussi. Moi, j’adore mes citrouilles, c’est tout. Répétez mon rythme.',
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
    'Toc. Toc. Toc. On me suit depuis {fete.nom}. Frappez vite, qu’on croie que c’est vous.',
    'TOC TOC. Je vois votre souper dans la boule. Je vois aussi que {futur}. Frappez.',
    'Toc toc toc… Vérifiez {lieu}. Maintenant frappez mon rythme.',
    'TOC TOC TOC ! Le fil rouge passe par votre poing ! Frappez comme moi !',
    'Toc toc. Parlez bas : {objet.nom} écoute tout le voisinage. Frappez plutôt.',
    'TOC TOC. Ce n’est pas la poste, ce n’est pas la livraison, c’est pire : c’est mon rythme. Répétez-le.',
    'Ce soir, une autre personne cognera à votre porte. C’est une dinde sauvage. Elle est plus grande que vous. Elle connaît le rythme.',
  ],
  porte5: [
    'FRAPPEZ. ON ÉCOUTE PAR LE TROU DE LA SERRURE.',
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
    'Non. Écoutez mieux : on frappe aussi, derrière vous.',
    'Mal. Mes cartes avaient prévu cette erreur. Elles s’en lassent.',
    'Vous montez la côte, la côte vous remonte. Recommencez.',
  ],
  rate4: [
    'NON. Pas comme ça. On a entendu. Recommencez.',
    'Ce n’était pas votre main, ça. Chut. Encore.',
    'Trop fort ! Le fil rouge a vibré. Doucement, encore.',
    'Faux. Il y a un écho dans l’escalier. Ce n’est pas le mien.',
    'CESSEZ. Mon rythme n’avait pas autant de coups.',
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
  entrez: [
    'Bon. Entrez, on n’a pas toute la nuit.',
    'Trois essais, et la porte a le cœur tendre. Entrez, c’est moi qui vous ouvre.',
    'Les cartes disent d’abandonner. Entrez, ce n’est pas verrouillé.',
  ],
}
