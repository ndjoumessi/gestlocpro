import type { DateParts } from '@/data/portfolio'

/**
 * L'ÉDITEUR DE GESTLOCPRO, TEL QUE LE REGISTRE L'ÉTABLIT — et rien de plus.
 *
 * Source : l'attestation d'immatriculation au Registre national des entreprises,
 * éditée le 10 septembre 2026, transmise par Nelson le 2026-09-12. Chaque valeur
 * ci-dessous y figure en toutes lettres ; aucune n'est déduite, complétée ni
 * reformulée, hormis la casse de l'adresse (« 71 RUE de rome » au registre).
 *
 * POURQUOI UN MODULE ET NON DES CHAÎNES DANS LA PAGE. Ce sont des FAITS, pas des
 * libellés : ils ne se traduisent pas — une adresse ne change pas de langue, une
 * nature d'établissement inscrite au registre français se cite telle qu'elle est
 * inscrite —, et ils changeront ensemble le jour où l'entreprise changera.
 *
 * CE QUE L'ATTESTATION NE DONNE PAS, écrit ici plutôt que deviné. La page 1 du
 * document est une image : son texte n'a rendu que l'en-tête. Le numéro SIREN,
 * que la loi exige d'afficher (LCEN, art. 6-III), y figure sans doute ; il n'a
 * pas été lu, donc il n'est pas écrit. Voir `MENTIONS_A_COMPLETER`.
 */
export const EDITEUR = {
  denomination: 'DJOUMESSI',
  /** « Nature de l'établissement » à l'attestation. */
  nature: 'Libérale non réglementée',
  /** « Activité principale » — sa première proposition, sans la liste des technologies. */
  activite: 'Programmation informatique',
  adresse: ['71 rue de Rome', '13001 Marseille', 'France'],
  registre: 'Registre national des entreprises',
  /**
   * « Date de mise à jour de l'entreprise (aucun autre évènement depuis cette
   * date) » : le 10 septembre 2026. `month: 8` parce que `DateParts` compte les
   * mois à partir de zéro — la première écriture disait 9, et la page affichait
   * octobre ; c'est le cas en anglais qui l'a vu.
   */
  miseAJour: { year: 2026, month: 8, day: 10 } satisfies DateParts,
} as const

/**
 * LES MENTIONS QUE LA LOI EXIGE ET QUE L'ATTESTATION NE PORTE PAS.
 *
 * Un éditeur professionnel doit afficher, en plus de ce qui précède, son numéro
 * d'immatriculation, un téléphone et une adresse électronique, le nom du
 * directeur de la publication, et l'identité de son hébergeur (LCEN, art. 6-III).
 * Aucune n'est inventée : la page ne rend que ce qui est établi, et cette liste
 * dit ce qui manque — un cas l'exige à l'identique, pour que la combler oblige à
 * la toucher.
 */
export const MENTIONS_A_COMPLETER = [
  'siren',
  'telephone',
  'courriel',
  'directeurDeLaPublication',
  'hebergeur',
] as const
