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
  siren: '109 761 023',
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

/**
 * LES MENTIONS QUE LA LOI EXIGE ET QUI NE SONT PAS ENCORE ÉTABLIES.
 *
 * Un éditeur professionnel doit afficher un téléphone et une adresse électronique
 * où le joindre (LCEN, art. 6-III). Ce ne sont pas des faits qu'on relève : ce
 * sont des CHOIX — quel numéro, quelle adresse rendre publics —, et ils
 * appartiennent à Nelson. Le 2026-09-12, il a choisi de les laisser manquants
 * pour l'instant. Rien n'est inventé ; cette liste dit ce qui manque, et un cas
 * l'exige à l'identique pour que la combler oblige à le toucher.
 */
export const MENTIONS_A_COMPLETER = ['telephone', 'courriel'] as const
