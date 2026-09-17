import type { DateParts } from '@/data/portfolio'

/**
 * LES CONDITIONS GÉNÉRALES D'UTILISATION — ce que le produit fait, et non ce
 * qu'un service de ce genre promet d'habitude.
 *
 * ═══ POURQUOI « UTILISATION » ET NON « VENTE » ═══
 *
 * Relevé dans le schéma le 2026-09-17, sur vingt-neuf modèles : AUCUN
 * abonnement, aucun plan, aucun paiement du service. `Payment` porte les loyers
 * que les locataires versent à leur bailleur, pas le chiffre d'affaires de
 * l'éditeur. Rien dans le serveur ne sait facturer qui que ce soit.
 *
 * La vitrine annonce pourtant trois paliers, un prix par unité, « 30 jours
 * d'essai » et « résiliable à tout moment ». Ces conditions ne les reprennent
 * pas : des conditions de VENTE décriraient un contrat que personne ne peut
 * conclure. Elles disent le service tel qu'il est — fourni sans contrepartie
 * financière à ce jour — et posent ce qu'il faudra faire avant de le rendre
 * payant. L'écart entre la vitrine et le produit reste entier, il est NOMMÉ, et
 * il appartient à Nelson.
 *
 * ═══ CE QUI EST RELEVÉ, ET CE QUI EST UN CHOIX ═══
 *
 * RELEVÉ dans le code, le 2026-09-17 :
 *   - le délai de trente jours entre la demande de fermeture et l'effacement
 *     (`DELAI_D_EFFACEMENT_JOURS`, et l'effacement tourne pour de vrai) ;
 *   - ce que l'effacement emporte : le compte, et les parcs dont il est le seul
 *     propriétaire (`parcsEmportesParLEffacement`) ;
 *   - l'export intégral, par `GET /:parkId/export`, seize natures ;
 *   - aucune purge automatique par ailleurs — rien n'est effacé sans demande.
 *
 * CHOIX À FAIRE VALIDER PAR NELSON, écrits ici pour qu'ils se voient :
 *   - aucun engagement de disponibilité n'est pris, parce qu'aucun n'est
 *     mesuré ni tenu ;
 *   - la responsabilité est limitée à ce qui est prévisible et direct ;
 *   - le droit français s'applique, ce qui découle du siège de l'éditeur ;
 *   - LE MÉDIATEUR DE LA CONSOMMATION EST ABSENT, et c'est une lacune assumée :
 *     l'article L612-1 du code de la consommation en impose un au professionnel
 *     qui contracte avec des consommateurs, et aucun n'est souscrit. Inventer un
 *     nom serait pire que l'omettre ; la page renvoie donc au droit commun, et
 *     la rubrique devra être complétée le jour où l'adhésion sera prise.
 */

/**
 * LE DÉLAI ENTRE LA FERMETURE DEMANDÉE ET L'EFFACEMENT, EN JOURS.
 *
 * Recopié du serveur — `server/src/auth/fermeture.ts`, `DELAI_D_EFFACEMENT_JOURS` —
 * parce que le client ne peut pas l'importer : deux paquets, deux compilations.
 * Un cas le garde en lisant la source du serveur, pour qu'une divergence rougisse
 * plutôt que de laisser une page juridique promettre un délai que le code ne
 * tient pas.
 */
export const DELAI_D_EFFACEMENT_JOURS = 30

/**
 * Date du relevé qui fonde ces conditions. Affichée sur la page : un texte
 * juridique sans date ne se compare pas à celui qu'on a accepté.
 */
export const RELEVE_LE = { year: 2026, month: 8, day: 17 } satisfies DateParts
