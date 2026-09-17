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
 * CE QUE L'ATTESTATION NE DONNAIT PAS, ET D'OÙ ÇA VIENT. La page 1 du document est
 * une image : son texte n'a rendu que l'en-tête, et « Entreprise DJOUMESSI ».
 * Le SIREN, la forme juridique et le nom de l'entrepreneur viennent de
 * l'annuaire public des entreprises (recherche-entreprises.api.gouv.fr), relevé
 * le 2026-09-12 — UN seul résultat, qui recoupe l'attestation point par point :
 * 71 rue de Rome à Marseille, activité 62.01Z (programmation informatique),
 * créée le 09/09/2026, nature juridique 1000 (entrepreneur individuel), et
 * diffusion publique. L'annuaire écrit « ROMEL DJOUMESSI (NELSON DJOUMESSI) » :
 * Nelson a choisi le nom inscrit, sans le prénom d'usage.
 *
 * POUR UN ENTREPRENEUR INDIVIDUEL, LA DÉNOMINATION EST LE NOM DE LA PERSONNE. La
 * première version écrivait « DJOUMESSI » seul, faute de mieux : c'était
 * incomplet, et c'est corrigé. Le directeur de la publication est l'entrepreneur
 * lui-même.
 *
 * L'attestation a été relue EN IMAGE le 2026-09-13 : sa page 1 porte en toutes
 * lettres le SIREN, la forme juridique et le code APE que l'annuaire avait donnés.
 */
export const EDITEUR = {
  entrepreneur: 'Romel Djoumessi',
  /** Nature juridique 1000 à l'annuaire des entreprises. */
  forme: 'Entrepreneur individuel',
  /**
   * LE RÉGIME, ET IL N'EST PAS LA FORME.
   *
   * Nelson a répondu « micro-entreprise » à la question de la FORME juridique, le
   * 2026-09-17. La micro-entreprise n'en est pas une : c'est un régime fiscal et
   * social qui s'applique à un entrepreneur individuel, et la forme inscrite au
   * registre reste celle que `forme` porte. Les fondre ferait écrire à une page
   * légale une chose que l'annuaire des entreprises dément — d'où deux lignes.
   *
   * DÉCLARÉ PAR NELSON, comme la franchise de TVA, et pour la même raison : ni
   * l'attestation ni l'annuaire ne portent le régime. Les deux vieillissent
   * ensemble — sortir de la franchise et sortir de la micro-entreprise sont
   * souvent le même jour.
   */
  regime: 'Micro-entreprise',
  /**
   * LE NOM COMMERCIAL, donné le 2026-09-17.
   *
   * Un entrepreneur individuel n'a pas de dénomination sociale : sa
   * dénomination est son nom. Le nom commercial est ce sous quoi il exerce — et
   * sans lui, une mention légale ne relie pas le site qu'on lit à l'entreprise
   * qui le publie.
   */
  nomCommercial: 'GestLocPro',
  siren: '109 761 023',
  /** SIRET du siège, à l'attestation (« 10976102300018 ») et donné par Nelson le 2026-09-14. */
  siret: '109 761 023 00018',
  /** Code APE, à l'attestation (« 6201Z - Programmation informatique »). */
  codeApe: '6201Z',
  /**
   * LE TÉLÉPHONE ET L'ADRESSE ÉLECTRONIQUE, donnés par Nelson le 2026-09-14.
   *
   * Ils manquaient depuis la première version de la page : ce ne sont pas des
   * faits qu'un registre établit, ce sont des CHOIX — quel numéro, quelle adresse
   * rendre publics. `MENTIONS_A_COMPLETER` et `CONFIDENTIALITE_A_COMPLETER` les
   * nommaient ; ils sont retirés avec ce qu'ils attendaient.
   *
   * La FORME reste « Entrepreneur individuel », telle que l'attestation et
   * l'annuaire l'écrivent, et non « entreprise individuelle », la formule de
   * Nelson : depuis la réforme de 2022, c'est « entrepreneur individuel » (ou
   * « EI ») qui doit accompagner le nom (code de commerce, art. L. 526-22).
   */
  telephone: '+33 6 61 75 19 23',
  courriel: 'romel.djoumessi@gmail.com',
  /**
   * FRANCHISE EN BASE DE TVA — déclarée par Nelson le 2026-09-13, et c'est la seule
   * source : ni l'attestation, ni l'annuaire des entreprises ne portent le régime
   * fiscal, et VIES, interrogé le même jour sur `FR91109761023`, a refusé trois
   * fois (`MS_MAX_CONCURRENT_REQ`) — une réponse « invalide » n'aurait d'ailleurs
   * rien prouvé, pour une entreprise de quatre jours.
   *
   * La LCEN n'exige le numéro de TVA que de l'éditeur qui y est assujetti ; la
   * page le dit plutôt que de se taire, dans la formule de l'article 293 B du CGI.
   *
   * CE FAIT VIEILLIT. Une entreprise qui dépasse les seuils de la franchise, ou qui
   * opte pour la TVA, en devient redevable : cette ligne devient fausse, et le
   * numéro `FR91109761023` (clé calculée du SIREN) doit alors paraître — un cas
   * l'interdit aujourd'hui, pour que le changement oblige à le toucher.
   */
  tva: 'Non applicable, article 293 B du CGI',
  directeurDeLaPublication: 'Romel Djoumessi',
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
 * L'HÉBERGEUR, TEL QU'IL SE NOMME DANS SON PROPRE CONTRAT.
 *
 * Le service de production tourne chez Railway — vérifié le 2026-09-12 sur le
 * projet `gestlocpro` : service `gestlocpro`, environnement `production`, domaine
 * `gestlocpro-app-production.up.railway.app`. Les coordonnées viennent des
 * conditions générales de Railway (https://railway.com/legal/terms), relevées le
 * même jour dans le HTML complet — la version servie aux robots n'en est qu'un
 * résumé, sans une seule coordonnée.
 *
 * « Suite 68956 » et non « PMB 68956 » : l'accord de traitement des données de
 * Railway écrit le second, ses conditions générales le premier, et ce sont elles
 * qui lient. Le « +1 » est ajouté au numéro, que la source écrit « (415) 707-7675 »
 * pour un lecteur américain : un visiteur français n'a pas l'indicatif.
 */
export const HEBERGEUR = {
  raisonSociale: 'Railway Corporation',
  adresse: ['548 Market St Suite 68956', 'San Francisco, California 94104'],
  telephone: '+1 (415) 707-7675',
  courriel: 'team@railway.com',
} as const

