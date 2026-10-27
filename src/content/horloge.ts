/** Remarques de la voyante sur l’heure locale (voir `engine/horloge.ts`). `{heure}` = heure réelle, façon Québec (« 3 h 12 »). Règles de contenu : voir AGENTS.md. */

export type FenetreHoraire = 'halloween' | 'minuit' | 'nuit' | 'matin' | 'soir'

export const HORLOGE_LIGNES: Record<FenetreHoraire, readonly string[]> = {
  // Le 31 octobre, à toute heure.
  halloween: [
    'Il est {heure}, le 31 octobre. Vous ne venez pas ici par hasard : les citrouilles le savent.',
    'Le 31 octobre à {heure} : la nuit des bonbons, et vous consultez une voyante. Bon choix, elle a des contacts.',
    '{heure}, le 31 octobre. Les masques sont prêts, les fantômes aussi. Vous, c’est moins clair.',
    'Il est {heure}, jour d’Halloween. La porte a hâte : elle a gardé ses meilleurs grincements.',
  ],
  // 23 h 50 à 0 h 10.
  minuit: [
    '{heure}. Minuit, à quelques minutes près. Vous avez bien choisi votre moment, et la porte aussi.',
    'Il est {heure} : l’heure où les fantômes changent de quart. Ne bougez pas : on vous compte.',
    '{heure} : la frontière entre les mondes est mince. Vous la traversez en pantoufles.',
    'À {heure}, la boule de cristal se réveille toute seule. Elle a des questions sur vous.',
  ],
  // 0 h à 4 h 59.
  nuit: [
    'Vous consultez à {heure}… Les gens raisonnables dorment, à cette heure-là.',
    '{heure}. Les fantômes sont en pleine heure de pointe, et vous aussi, apparemment.',
    'À {heure}, la boule de cristal est de garde. Vous, vous êtes juste debout.',
    'Il est {heure}. Les chauves-souris vous saluent : vous êtes la seule personne éveillée dans leur quartier.',
    '{heure} : l’heure où la porte craque toute seule. Cette nuit, elle a une excuse.',
  ],
  // 5 h à 8 h 59.
  matin: [
    'Déjà là à {heure} ? Les cartes ne sont pas encore levées : comptez sur leur mauvaise humeur.',
    'Il est {heure}. Votre café prédit une journée normale. Il ment, mais gentiment.',
    '{heure} : les fantômes finissent leur quart de nuit. Vous les croisez à la porte.',
    'Vous cognez à {heure} du matin ? La brume n’est même pas encore dissipée.',
  ],
  // 18 h à 23 h 49.
  soir: [
    'Il est {heure}. Les ombres s’allongent. Les vôtres ont déjà de l’avance.',
    'À {heure}, la citrouille du quartier s’allume. Elle le fait pour vous.',
    'Il est {heure}. Les cartes sentent le souper de quelqu’un d’autre. Vous mangerez tard.',
    'Vous arrivez à {heure}, la lune à peine levée. Elle vous attendait.',
  ],
}
