// Textes de l’interface : titres d’onglet cachés, bulles de la barre des tâches, fausses fenêtres d’erreur Windows 98.
// Format : `onglet<N>` = chaînes simples (≤ 40 caractères) ; `bulle<N>` et `erreur<N>` = `{ titre, texte }` ;
// `erreur_icone` et `erreur_boutons` sont tirés au hasard pour chaque fausse erreur.
import type { Grammar } from '../../engine/grammar'

/** `onglet1` … `onglet5`, `bulle1` … `bulle5`, `erreur3` … `erreur5`, `erreur_icone`, `erreur_boutons`. */
export const interfaceTextes: Grammar = {
  // ---- Titre de l’onglet quand il est caché (≤ 40 caractères) -----------------------------------
  onglet1: ['Revenez…', 'La porte vous attend.', 'On n’a pas fini.'],
  onglet2: ['Je vous vois encore.', 'Vous partez déjà ?', 'La carte vous attend.'],
  onglet3: ['Revenez. Maintenant.', 'Je sais où vous êtes.', 'Je sais que vous revenez.'],
  onglet4: ['Une présence est entrée.', 'Ne me laissez pas ici.', 'Je regarde l’onglet vide.'],
  onglet5: ['REVENEZ.', 'JE SUIS DANS L’ONGLET.', 'IL N’Y A PERSONNE. REVENEZ.'],

  // ---- Bulles de la barre des tâches (`{ titre, texte }`) -------------------------------------------
  // Niveau 1 : une seule bulle, juste après la toute première lecture de la session (visites = 0) ; elle annonce la suite.
  bulle1: [
    { titre: 'Visite enregistrée', texte: 'Une première visite. La porte vous attend.' },
    { titre: 'Barre des tâches', texte: 'Votre passage a été noté. Revenez : la suite vous connaît déjà.' },
    { titre: 'Niveau de vigilance : 1', texte: 'Je vous regarde, avec bienveillance. Pour l’instant.' },
  ],
  bulle2: [
    { titre: 'Nouveau message', texte: 'La boule de cristal a essayé de vous joindre.' },
    { titre: 'Mise à jour disponible', texte: 'Votre avenir a été mis à jour. Redémarrage requis.' },
    { titre: 'Rappel', texte: 'Vous avez rendez-vous avec le 31 octobre.' },
    { titre: 'Barre des tâches', texte: 'La porte a été ouverte avant vous.' },
    { titre: 'Connexion non sécurisée', texte: 'Êtes-vous en HTTP ? Parce que ://' },
  ],
  bulle3: [
    { titre: 'Connexion détectée', texte: 'Une personne consulte votre horoscope en ce moment.' },
    { titre: 'Avertissement', texte: 'Un chat noir a traversé votre bureau.' },
    { titre: 'Nouveau matériel détecté', texte: 'Une carte de tarot a été installée sans votre accord.' },
    { titre: 'Rappel', texte: 'Le fil rouge est branché. Ne le débranchez pas.' },
    { titre: 'Antivirus', texte: 'Le virus donnéebase a été hautdaté.' },
    { titre: 'Fantôme aux oignons', texte: 'Suis-je encore « Fantôme aux oignons » dans votre téléphone ?' },
  ],
  bulle4: [
    { titre: 'Connexion à distance', texte: 'On s’est connecté à votre avenir.' },
    { titre: 'Espace disque faible', texte: 'Il reste très peu de destin sur le disque C:.' },
    { titre: 'Avertissement de sécurité', texte: 'Un fantôme demande l’accès à vos fichiers.' },
    { titre: 'Programme inconnu', texte: 'Ça tourne en arrière-plan depuis le 1er octobre.' },
    { titre: 'Protection en temps réel', texte: 'Une menace a été détectée. Votre antivirus a pris la fuite.' },
    { titre: 'Appel entrant', texte: 'L’au-delà tente de vous joindre. Il sait que vous préférez les textos. Il appelle quand même.' },
    { titre: 'Précision de l’au-delà', texte: 'Je ne vous espionne pas. Je consulte.' },
  ],
  bulle5: [
    { titre: 'Dernier avertissement', texte: 'Il n’y a plus de barre des tâches. Il n’y en a jamais eu.' },
    { titre: 'Erreur fatale', texte: 'Le futur a cessé de répondre.' },
    { titre: 'Session terminée', texte: 'Vous n’avez jamais ouvert cette porte.' },
    { titre: 'Message de personne', texte: 'Regardez derrière vous.' },
  ],

  // ---- Fausses fenêtres d’erreur Windows 98 (`{ titre, texte }`), niveaux 3 à 5 ---------------------
  erreur3: [
    { titre: 'AVENIR.EXE', texte: 'Le fichier AVENIR.DLL est introuvable.' },
    { titre: 'Boule de cristal', texte: 'Une opération illégale a été prédite.' },
    { titre: 'Tarot', texte: 'Mémoire insuffisante pour contenir tout ce que les cartes savent.' },
    { titre: 'Halloween', texte: 'Le fichier CHAT_NOIR.SYS a cessé de répondre.' },
    { titre: 'Big Citrouille', texte: 'La licence de votre 31 octobre a expiré. Veuillez la renouveler.' },
    { titre: 'Assistant Horoscope', texte: 'Il semble que vous tentiez de changer votre destin. Voulez-vous de l’aide ?' },
    { titre: 'Imprimante', texte: 'Le tarot est coincé dans le bac. Retirez la carte et réessayez.' },
    { titre: 'Réseau', texte: 'La pleine lune a perdu sa connexion. Nouvelle tentative dans 29 jours.' },
    { titre: 'Calendrier', texte: 'Le jour de Pi a été ajouté à votre agenda. Personne ne sait par qui.' },
    { titre: 'POUTINE.EXE', texte: 'Le fromage en grains a commis une faute de protection générale.' },
    { titre: 'Défragmenteur de disque', texte: 'Votre 31 octobre est fragmenté à 87 %. Voulez-vous continuer ?' },
    { titre: 'Corbeille', texte: 'La corbeille contient 4 citrouilles. Voulez-vous les vider ?' },
    { titre: 'Mise en veille', texte: 'Ce programme refuse de dormir tant que la lune est pleine.' },
    { titre: 'Installation', texte: 'Une soupe de sorcière s’installe. Ne fermez pas la session.' },
    { titre: 'Cône orange', texte: 'Détour obligatoire. L’erreur 511 est en travaux jusqu’en 2041.' },
    { titre: 'Lecteur A:', texte: 'Impossible de lire la carte. Insérez un tarot valide.' },
    { titre: 'Période d’essai', texte: 'Votre période d’essai de 40 jours a expiré il y a 6 000 jours. Continuez quand même. Personne n’a jamais payé.' },
    { titre: 'Compilation', texte: 'Le code a compilé du premier coup. Vos pupilles viennent de s’agrandir de 45 %. Méfiez-vous : ça n’arrive jamais.' },
  ],
  erreur4: [
    { titre: 'Avertissement', texte: 'Le fichier FIL_ROUGE.DLL est utilisé par un autre programme. Ce programme, c’est vous.' },
    { titre: 'FANTOME.EXE', texte: 'FANTOME.EXE a provoqué une faute de protection générale dans le module PORTE.DLL.' },
    { titre: 'Mémoire insuffisante', texte: 'Impossible d’oublier ce que vous avez vu.' },
    { titre: 'Erreur système', texte: 'Une personne utilise déjà ce destin.' },
    { titre: 'Gestionnaire de tâches', texte: 'Le processus REGARD.EXE utilise 94 % de vos ressources. Il ne se ferme pas.' },
    { titre: 'Pare-feu', texte: 'Un fantôme tente de franchir le pare-feu. Autoriser ? Il dit que oui.' },
    { titre: 'Connexion à distance', texte: 'Une personne inconnue consulte votre écran depuis la lune.' },
    { titre: 'Journal des événements', texte: 'Erreur 666 : vous avez déjà vu cette fenêtre. Elle vous a déjà vu.' },
    { titre: 'Mise à jour', texte: 'L’horoscope a été modifié à 3 h 13. Aucune session n’était ouverte.' },
    { titre: 'Webcam', texte: 'La webcam est éteinte. La lumière verte, elle, est allumée.' },
    { titre: 'Antivirus', texte: 'Menace détectée : MÊME FOURNISSEUR. Aucune action possible.' },
    { titre: 'Corbeille', texte: 'Impossible de vider la corbeille : les citrouilles sont revenues.' },
    { titre: 'Sauvegarde', texte: 'Votre mémoire a été sauvegardée. Vous ne l’aviez pas demandé.' },
    { titre: 'CHAT_NOIR.SYS', texte: 'Le chat noir d’à côté a changé votre mot de passe. Il le connaissait déjà.' },
    { titre: 'Explorateur', texte: 'Le dossier MINUIT est vide. Il se remplit pendant que vous lisez.' },
    { titre: 'Alerte', texte: 'Un cône orange se déplace tout seul sur votre bureau.' },
    { titre: 'Mot de passe faible', texte: 'Votre mot de passe se sent vulnérable. Serrez votre ordinateur dans vos bras : vous l’êtes tout autant.' },
  ],
  erreur5: [
    { titre: 'ERREUR FATALE', texte: 'Une exception 0E a eu lieu à 31:10:00. Elle vous attendait.' },
    { titre: 'Écran bleu', texte: 'Appuyez sur une touche pour continuer. Il n’y a plus de touche.' },
    { titre: 'PERSONNE', texte: 'Le fichier VOUS.DLL est introuvable. Il se trouvait derrière vous.' },
    { titre: 'Redémarrage', texte: 'Windows doit redémarrer. Pas vous. Vous restez.' },
    { titre: 'ERREUR 31:10', texte: 'CETTE FENÊTRE N’EST PAS UNE FENÊTRE. C’EST LA PORTE.' },
    { titre: 'MÊME FOURNISSEUR', texte: 'MÊME ERREUR. MÊME FENÊTRE. MÊME VOUS.' },
    { titre: 'PROTECTION GÉNÉRALE', texte: 'LA BOULE DE CRISTAL A FAIT UNE FAUTE. ELLE A AUSSI FAIT VOTRE NOM.' },
    { titre: 'ÉCRAN BLEU', texte: 'LE BLEU, C’EST LE CIEL. IL N’Y A PLUS DE CIEL. APPUYEZ SUR RIEN.' },
    { titre: 'FORMATER C:', texte: 'VOS SOUVENIRS SERONT EFFACÉS. CE SERA LA DEUXIÈME FOIS.' },
    { titre: 'IMPRIMANTE', texte: 'LA CITROUILLE IMPRIME VOTRE ADRESSE. 1 COPIE. 2 COPIES. 3 COPIES.' },
    { titre: 'MS-DOS', texte: 'TAPEZ « SORTIR ». LA COMMANDE SORTIR N’EST PAS RECONNUE.' },
    { titre: 'MINUIT.EXE', texte: 'MINUIT A CESSÉ DE RÉPONDRE. MINUIT NE RÉPOND PLUS DEPUIS TOUJOURS.' },
    { titre: 'ERREUR 404', texte: 'LA RÉALITÉ EST INTROUVABLE. ESSAYEZ DE VOUS RÉVEILLER.' },
    { titre: 'RÉINITIALISATION', texte: 'LE FUTUR REDÉMARRE DANS 3… 2… 3… 1… 3…' },
    { titre: 'TOC TOC', texte: 'L’ERREUR FRAPPE À LA PORTE. ELLE CONNAÎT LE RYTHME.' },
    { titre: 'ANTIVIRUS', texte: 'LE VIRUS, C’EST LA FENÊTRE. LA FENÊTRE, C’EST VOUS.' },
    { titre: 'Erreur de l’utilisateur', texte: 'Vous regardez des mèmes pour éviter de travailler. Ce n’est pas un bogue : c’est votre faute.' },
  ],
  // Icône (stop, warn, info, question) et boutons (« Réessayer/Annuler ») tirés au hasard pour chaque fausse erreur : la même phrase ne se présente jamais tout à fait pareil.
  erreur_icone: ['stop', 'warn', 'info', 'question'],
  erreur_boutons: ['OK', 'OK/Annuler', 'Réessayer/Annuler', 'Ignorer/Réessayer', 'Oui/Non', 'Détails/OK', 'Ignorer', 'Oui/Non/Annuler'],
}
