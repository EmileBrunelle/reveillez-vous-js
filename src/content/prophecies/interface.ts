// Textes de l’interface : titres d’onglet cachés, bulles de la barre des tâches, fausses fenêtres d’erreur Windows 98.
// Format : `onglet<N>` = chaînes simples (≤ 40 caractères) ; `bulle<N>` et `erreur<N>` = « Titre|Texte » ;
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

  // ---- Bulles de la barre des tâches (« Titre|Texte ») -------------------------------------------
  // Niveau 1 : une seule bulle, juste après la toute première lecture de la session (visites = 0) ; elle annonce la suite.
  bulle1: [
    'Visite enregistrée|Une première visite. La porte vous attend.',
    'Barre des tâches|Votre passage a été noté. Revenez : la suite vous connaît déjà.',
    'Niveau de vigilance : 1|Je vous regarde, avec bienveillance. Pour l’instant.',
  ],
  bulle2: [
    'Nouveau message|La boule de cristal a essayé de vous joindre.',
    'Mise à jour disponible|Votre avenir a été mis à jour. Redémarrage requis.',
    'Rappel|Vous avez rendez-vous avec le 31 octobre.',
    'Barre des tâches|La porte a été ouverte avant vous.',
  ],
  bulle3: [
    'Connexion détectée|Une personne consulte votre horoscope en ce moment.',
    'Avertissement|Un chat noir a traversé votre bureau.',
    'Nouveau matériel détecté|Une carte de tarot a été installée sans votre accord.',
    'Rappel|Le fil rouge est branché. Ne le débranchez pas.',
  ],
  bulle4: [
    'Connexion à distance|On s’est connecté à votre avenir.',
    'Espace disque faible|Il reste très peu de destin sur le disque C:.',
    'Avertissement de sécurité|Un fantôme demande l’accès à vos fichiers.',
    'Programme inconnu|Ça tourne en arrière-plan depuis le 1er octobre.',
  ],
  bulle5: [
    'Dernier avertissement|Il n’y a plus de barre des tâches. Il n’y en a jamais eu.',
    'Erreur fatale|Le futur a cessé de répondre.',
    'Session terminée|Vous n’avez jamais ouvert cette porte.',
    'Message de personne|Regardez derrière vous.',
  ],

  // ---- Fausses fenêtres d’erreur Windows 98 (« Titre|Message »), niveaux 3 à 5 ---------------------
  erreur3: [
    'AVENIR.EXE|Le fichier AVENIR.DLL est introuvable.',
    'Boule de cristal|Une opération illégale a été prédite.',
    'Tarot|Mémoire insuffisante pour contenir tout ce que les cartes savent.',
    'Halloween|Le fichier CHAT_NOIR.SYS a cessé de répondre.',
    'Big Citrouille|La licence de votre 31 octobre a expiré. Veuillez la renouveler.',
    'Assistant Horoscope|Il semble que vous tentiez de changer votre destin. Voulez-vous de l’aide ?',
    'Imprimante|Le tarot est coincé dans le bac. Retirez la carte et réessayez.',
    'Réseau|La pleine lune a perdu sa connexion. Nouvelle tentative dans 29 jours.',
    'Calendrier|Le jour de Pi a été ajouté à votre agenda. Personne ne sait par qui.',
    'POUTINE.EXE|Le fromage en grains a commis une faute de protection générale.',
    'Défragmenteur de disque|Votre 31 octobre est fragmenté à 87 %. Voulez-vous continuer ?',
    'Corbeille|La corbeille contient 4 citrouilles. Voulez-vous les vider ?',
    'Mise en veille|Ce programme refuse de dormir tant que la lune est pleine.',
    'Installation|Une soupe de sorcière s’installe. Ne fermez pas la session.',
    'Cône orange|Détour obligatoire. L’erreur 511 est en travaux jusqu’en 2041.',
    'Lecteur A:|Impossible de lire la carte. Insérez un tarot valide.',
  ],
  erreur4: [
    'Avertissement|Le fichier FIL_ROUGE.DLL est utilisé par un autre programme. Ce programme, c’est vous.',
    'FANTOME.EXE|FANTOME.EXE a provoqué une faute de protection générale dans le module PORTE.DLL.',
    'Mémoire insuffisante|Impossible d’oublier ce que vous avez vu.',
    'Erreur système|Une personne utilise déjà ce destin.',
    'Gestionnaire de tâches|Le processus REGARD.EXE utilise 94 % de vos ressources. Il ne se ferme pas.',
    'Pare-feu|Un fantôme tente de franchir le pare-feu. Autoriser ? Il dit que oui.',
    'Connexion à distance|Une personne inconnue consulte votre écran depuis la lune.',
    'Journal des événements|Erreur 666 : vous avez déjà vu cette fenêtre. Elle vous a déjà vu.',
    'Mise à jour|L’horoscope a été modifié à 3 h 13. Aucune session n’était ouverte.',
    'Webcam|La webcam est éteinte. La lumière verte, elle, est allumée.',
    'Antivirus|Menace détectée : MÊME FOURNISSEUR. Aucune action possible.',
    'Corbeille|Impossible de vider la corbeille : les citrouilles sont revenues.',
    'Sauvegarde|Votre mémoire a été sauvegardée. Vous ne l’aviez pas demandé.',
    'CHAT_NOIR.SYS|Le chat noir d’à côté a changé votre mot de passe. Il le connaissait déjà.',
    'Explorateur|Le dossier MINUIT est vide. Il se remplit pendant que vous lisez.',
    'Alerte|Un cône orange se déplace tout seul sur votre bureau.',
  ],
  erreur5: [
    'ERREUR FATALE|Une exception 0E a eu lieu à 31:10:00. Elle vous attendait.',
    'Écran bleu|Appuyez sur une touche pour continuer. Il n’y a plus de touche.',
    'PERSONNE|Le fichier VOUS.DLL est introuvable. Il se trouvait derrière vous.',
    'Redémarrage|Windows doit redémarrer. Pas vous. Vous restez.',
    'ERREUR 31:10|CETTE FENÊTRE N’EST PAS UNE FENÊTRE. C’EST LA PORTE.',
    'MÊME FOURNISSEUR|MÊME ERREUR. MÊME FENÊTRE. MÊME VOUS.',
    'PROTECTION GÉNÉRALE|LA BOULE DE CRISTAL A FAIT UNE FAUTE. ELLE A AUSSI FAIT VOTRE NOM.',
    'ÉCRAN BLEU|LE BLEU, C’EST LE CIEL. IL N’Y A PLUS DE CIEL. APPUYEZ SUR RIEN.',
    'FORMATER C:|VOS SOUVENIRS SERONT EFFACÉS. CE SERA LA DEUXIÈME FOIS.',
    'IMPRIMANTE|LA CITROUILLE IMPRIME VOTRE ADRESSE. 1 COPIE. 2 COPIES. 3 COPIES.',
    'MS-DOS|TAPEZ « SORTIR ». LA COMMANDE SORTIR N’EST PAS RECONNUE.',
    'MINUIT.EXE|MINUIT A CESSÉ DE RÉPONDRE. MINUIT NE RÉPOND PLUS DEPUIS TOUJOURS.',
    'ERREUR 404|LA RÉALITÉ EST INTROUVABLE. ESSAYEZ DE VOUS RÉVEILLER.',
    'RÉINITIALISATION|LE FUTUR REDÉMARRE DANS 3… 2… 3… 1… 3…',
    'TOC TOC|L’ERREUR FRAPPE À LA PORTE. ELLE CONNAÎT LE RYTHME.',
    'ANTIVIRUS|LE VIRUS, C’EST LA FENÊTRE. LA FENÊTRE, C’EST VOUS.',
  ],
  // Icône (stop, warn, info, question) et boutons (« Réessayer/Annuler ») tirés au hasard pour chaque fausse erreur : la même phrase ne se présente jamais tout à fait pareil.
  erreur_icone: ['stop', 'warn', 'info', 'question'],
  erreur_boutons: ['OK', 'OK/Annuler', 'Réessayer/Annuler', 'Ignorer/Réessayer', 'Oui/Non', 'Détails/OK', 'Ignorer', 'Oui/Non/Annuler'],
}
