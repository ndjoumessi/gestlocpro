import type { MeterReading, MonthlyCollection, Unit } from './portfolio'

/**
 * LE JEU DE DÉMONSTRATION QUE LA VITRINE DESSINE — et rien d'autre.
 *
 * Trois constantes vivaient dans `portfolio.ts` parmi tout le reste du jeu :
 * les logements, les encaissements par mois, les relevés. Le héros de la
 * vitrine les lit pour sa carte d'aperçu, et il emportait avec elles le module
 * entier dans le paquet d'entrée — mesuré le 2026-09-07 sur la carte de
 * sources : 18 150 octets du module, et trois photos de fixture en JPEG
 * intégré que ce fichier importe, 38 Ko en tout que chaque visiteur analysait
 * avant que la vitrine réponde, sans jamais les voir.
 *
 * Rendre la carte paresseuse a été essayé et REFUSÉ par `poids-ecrans` : `/`
 * passait de quatre à six requêtes, et une requête vaut un aller-retour de 300
 * à 800 ms sur le réseau visé. Ce module est l'autre voie : la vitrine lit
 * ceci, `portfolio.ts` réexporte les trois noms pour ses autres lecteurs, et
 * le paquet d'entrée ne porte du jeu que ce que la carte dessine — sans une
 * requête de plus.
 *
 * LA RÈGLE DE CE FICHIER, gardée par `heroLeger.test.ts` : n'importer que des
 * TYPES, et aucune image. Une valeur importée de `portfolio.ts` ramènerait le
 * module entier dans le paquet d'entrée, et tout ce lot avec lui.
 */

/**
 * LES UNITÉS OCCUPÉES DE LA DÉMONSTRATION PORTENT UN `tenantId`, et ce n'est
 * pas de la décoration.
 *
 * « Retirer la fiche » n'est offert que si l'unité en porte un — le serveur
 * supprime par identifiant de LOCATAIRE, pas par logement, et proposer un geste
 * sans de quoi l'exécuter ferait un bouton qui échoue. La règle est juste ;
 * aucune unité de démonstration n'en portait, si bien que le bouton
 * n'apparaissait JAMAIS hors d'un vrai parc.
 *
 * Conséquence, et elle a été mesurée : toute la colonne de geste des locataires
 * échappait au balayage — `mesure-ui` ne mesure que ce que la démonstration
 * rend. Trouvée par une mutation qui a ÉCHOUÉ : icône retirée de ce bouton-ci,
 * la garde du glyphe est restée verte.
 *
 * `loc-<unité>` reprend la forme déjà employée par les cas — « loc-B2 »,
 * « loc-C1 » dans `messageAuLocataire`. Sur un vrai parc, c'est un `uuid` : ce
 * que la démonstration doit rendre vrai, c'est qu'il EXISTE et qu'il est
 * distinct par personne, pas sa forme.
 */
export const UNITS: Unit[] = [
  { id: 'A1', buildingId: 'bon', label: 'A1', type: 'T3', surface: 78, rent: 145000, tenant: 'Charles Ngassa', tenantId: 'loc-A1', phone: '+237 6 77 21 44 08', leaseStart: { year: 2024, month: 5, day: 15 }, paid: 145000, status: 'paid' },
  { id: 'A2', buildingId: 'bon', label: 'A2', type: 'T2', surface: 54, rent: 110000, tenant: 'Mireille Fotso', tenantId: 'loc-A2', phone: '+237 6 99 03 51 72', leaseStart: { year: 2023, month: 9, day: 1 }, paid: 110000, status: 'paid' },
  { id: 'A3', buildingId: 'bon', label: 'A3', type: 'T2', surface: 56, rent: 115000, tenant: 'Serge Mbarga', tenantId: 'loc-A3', phone: '+237 6 55 84 20 31', leaseStart: { year: 2025, month: 2, day: 1 }, paid: 0, status: 'overdue', overdueDays: 24 },
  { id: 'A4', buildingId: 'bon', label: 'A4', type: 'T4', surface: 96, rent: 180000, tenant: 'Famille Owona', tenantId: 'loc-A4', phone: '+237 6 70 12 96 45', leaseStart: { year: 2026, month: 2, day: 15 }, paid: 180000, status: 'paid' },
  { id: 'A5', buildingId: 'bon', label: 'A5', type: 'T1', surface: 38, rent: 75000, tenant: 'Aline Tchoumi', tenantId: 'loc-A5', phone: '+237 6 94 37 08 12', leaseStart: { year: 2026, month: 1, day: 2 }, paid: 40000, status: 'partial' },

  { id: 'B1', buildingId: 'akw', label: 'B1', type: 'T3', surface: 82, rent: 160000, tenant: 'Jean-Paul Eboa', tenantId: 'loc-B1', phone: '+237 6 78 45 11 90', leaseStart: { year: 2023, month: 7, day: 1 }, paid: 160000, status: 'paid' },
  { id: 'B2', buildingId: 'akw', label: 'B2', type: 'T3', surface: 80, rent: 155000, tenant: 'Nadia Belinga', tenantId: 'loc-B2', phone: '+237 6 51 60 73 24', leaseStart: { year: 2024, month: 10, day: 1 }, paid: 0, status: 'overdue', overdueDays: 9 },
  /* UNE FICHE SANS COMPTE, et c'est le cas le plus COURANT du marché visé, pas
     une anomalie : un bailleur qui reprend son parc en main déclare ses
     locataires déjà en place, et aucun d'eux n'a de compte le premier jour. Les
     montrer tous connectés était la version irréelle.

     ELLE EST ICI POUR ÊTRE MESURÉE. La pastille « Sans compte » et la note qui
     dit ce qu'elle coûte n'existaient sur AUCUN écran de la démonstration :
     ni `mesure-ui` en géométrie, ni `couleur-non-seule` en contraste ne les
     voyaient — les deux ne visitent que `/demo`. Voir `notes-conditionnelles`,
     qui compte désormais ces états au lieu de les laisser disparaître. */
  { id: 'B3', buildingId: 'akw', label: 'B3', type: 'T2', surface: 58, rent: 120000, tenant: 'Éric Ndongo', tenantId: 'loc-B3', tenantHasAccount: false, phone: '+237 6 96 82 30 57', leaseStart: { year: 2025, month: 5, day: 1 }, paid: 120000, status: 'paid' },
  { id: 'B4', buildingId: 'akw', label: 'B4', type: 'T2', surface: 57, rent: 118000, tenant: null, phone: null, leaseStart: null, paid: 0, status: 'vacant' },

  { id: 'C1', buildingId: 'des', label: 'C1', type: 'T4', surface: 104, rent: 195000, tenant: 'Cabinet Njoya', tenantId: 'loc-C1', phone: '+237 6 73 55 41 86', leaseStart: { year: 2022, month: 3, day: 1 }, paid: 195000, status: 'paid' },
  { id: 'C2', buildingId: 'des', label: 'C2', type: 'T3', surface: 76, rent: 142000, tenant: 'Sylvie Manga', tenantId: 'loc-C2', phone: '+237 6 82 19 64 03', leaseStart: { year: 2025, month: 8, day: 1 }, paid: 0, status: 'overdue', overdueDays: 3 },
  { id: 'C3', buildingId: 'des', label: 'C3', type: 'T2', surface: 60, rent: 125000, tenant: null, phone: null, leaseStart: null, paid: 0, status: 'vacant' },
]

/**
 * LA DÉMONSTRATION SUIT L'HORLOGE, ET NE S'ANCRE PLUS À AOÛT 2026.
 *
 * ═══ CE QUI S'EST PASSÉ LE 1er SEPTEMBRE 2026, À MINUIT ═══
 *
 * Quatorze cas de `check:rapide` sont devenus rouges sans qu'une ligne de code
 * ait bougé. Les quittances du jeu s'arrêtaient au mois d'août ; le produit,
 * lui, lit `new Date()`. « Mon espace » titrait « Loyer pour septembre 2026 » et
 * ne trouvait aucun versement à nommer ; la modale de quittance s'ouvrait sur un
 * document vide.
 *
 * Ce n'est pas une panne de tests : c'est la DÉMONSTRATION qui s'était périmée,
 * et elle se serait périmée un peu plus chaque mois. Un visiteur de `/demo`
 * l'aurait vue avant nous si personne n'avait lancé la porte ce jour-là.
 *
 * ═══ CE QUE FAIT CE DÉCALAGE ═══
 *
 * Les séries datées ne portent plus des mois ABSOLUS mais des RANGS : « le mois
 * courant », « celui d'avant ». Les montants, les jours et les écarts entre les
 * lignes ne bougent pas d'un pouce — seule l'ancre se déplace.
 *
 * POURQUOI `UTC`. `getMonth()` répond selon le fuseau de la machine ; le
 * premier du mois, à Douala, il rendrait déjà le mois suivant de ce que Londres
 * voit. Tout ce fichier compte en parties UTC, comme `lib/dates` l'exige.
 *
 * CE QUE CE DÉCALAGE NE COUVRE PAS, et il faut le dire : les dates FIXES du
 * jeu — un bail commencé le 15/06/2024, un état des lieux d'entrée — restent
 * absolues, et c'est juste : ce sont des faits passés, pas une fenêtre
 * glissante. Elles vieilliront, et c'est ce qu'un bail fait.
 */
const MAINTENANT = new Date()
const ANCRE = { year: MAINTENANT.getUTCFullYear(), month: MAINTENANT.getUTCMonth() }

/** Le mois situé `recul` crans avant le mois courant. `0` = ce mois-ci. */
export function moisAvant(recul: number): { year: number; month: number } {
  const total = ANCRE.year * 12 + ANCRE.month - recul
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

/** Le même mois, avec un jour — pour une échéance ou un versement. */
export function jourDuMois(recul: number, day: number) {
  return { ...moisAvant(recul), day }
}

export const COLLECTIONS: MonthlyCollection[] = [
  { ...moisAvant(11), rent: 1010000, water: 62000, power: 48000 },
  { ...moisAvant(10), rent: 1085000, water: 58000, power: 51000 },
  { ...moisAvant(9), rent: 1040000, water: 61000, power: 46000 },
  { ...moisAvant(8), rent: 1120000, water: 66000, power: 58000 },
  { ...moisAvant(7), rent: 1150000, water: 71000, power: 62000 },
  { ...moisAvant(6), rent: 1095000, water: 64000, power: 54000 },
  { ...moisAvant(5), rent: 1180000, water: 69000, power: 57000 },
  { ...moisAvant(4), rent: 1240000, water: 74000, power: 61000 },
  { ...moisAvant(3), rent: 1205000, water: 70000, power: 59000 },
  { ...moisAvant(2), rent: 1290000, water: 78000, power: 66000 },
  { ...moisAvant(1), rent: 1250000, water: 72000, power: 63000 },
  { ...moisAvant(0), rent: 1040000, water: 68000, power: 55000 },
]

/**
 * Tarifs de la DÉMONSTRATION, et d'elle seule.
 *
 * Ces deux nombres étaient `UTILITY_RATES`, servis à tous les parcs et à toutes
 * les devises depuis le client : l'écran des relevés et l'espace du locataire
 * les affichaient comme des faits, avec les totaux qui en découlent. Un parc
 * réel lit désormais ses propres prix, datés, que son propriétaire a posés — et
 * n'en affiche aucun tant qu'il n'en a posé aucun.
 *
 * Ils survivent ici au même titre que les loyers et les noms de ce fichier :
 * un jeu fictif assumé, qui ne quitte jamais la démonstration. Le nom le dit
 * maintenant, ce que « UTILITY_RATES » laissait croire l'inverse.
 */
export const TARIFS_DEMO = { water: 520, power: 99 }

/**
 * Les relevés de la démonstration portent les prix de la démonstration.
 *
 * Posés à la construction plutôt que multipliés à l'écran : c'est la même forme
 * que ce que le serveur rend, si bien que les deux chemins — démonstration et
 * parc réel — nourrissent le même composant sans qu'il sache lequel le sert.
 */
/* LES IDENTIFIANTS SONT FACTICES, ET C'EST LEUR RÔLE. La démonstration n'écrit
   rien au serveur — les gestes de correction y répondent « la démonstration
   n'enregistre pas ». Ils existent pour que les BOUTONS apparaissent : les
   gardes de navigateur ne mesurent que ce que la démonstration rend, et une
   colonne de gestes qui ne paraît jamais échappe à toutes. C'est la leçon de
   `ficheRetirable`, payée une fois déjà. */
export const READINGS: MeterReading[] = [
  { unitId: 'A1', waterReadingId: 'demo-A1-water', waterPrevious: 342, waterCurrent: 358, powerReadingId: 'demo-A1-power', powerPrevious: 4120, powerCurrent: 4298, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A2', waterReadingId: 'demo-A2-water', waterPrevious: 289, waterCurrent: 301, powerReadingId: 'demo-A2-power', powerPrevious: 3540, powerCurrent: 3671, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A3', waterReadingId: 'demo-A3-water', waterPrevious: 415, waterCurrent: 436, powerReadingId: 'demo-A3-power', powerPrevious: 5210, powerCurrent: 5402, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A4', waterReadingId: 'demo-A4-water', waterPrevious: 502, waterCurrent: 529, powerReadingId: 'demo-A4-power', powerPrevious: 6180, powerCurrent: 6455, readAt: { year: 2026, month: 7, day: 20 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'A5', waterReadingId: 'demo-A5-water', waterPrevious: 176, waterCurrent: null, powerReadingId: 'demo-A5-power', powerPrevious: 2140, powerCurrent: null, readAt: null, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B1', waterReadingId: 'demo-B1-water', waterPrevious: 388, waterCurrent: 402, powerReadingId: 'demo-B1-power', powerPrevious: 4870, powerCurrent: 5033, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B2', waterReadingId: 'demo-B2-water', waterPrevious: 356, waterCurrent: 371, powerReadingId: 'demo-B2-power', powerPrevious: 4405, powerCurrent: 4560, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'B3', waterReadingId: 'demo-B3-water', waterPrevious: 271, waterCurrent: 284, powerReadingId: 'demo-B3-power', powerPrevious: 3290, powerCurrent: 3418, readAt: { year: 2026, month: 7, day: 19 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'C1', waterReadingId: 'demo-C1-water', waterPrevious: 611, waterCurrent: 644, powerReadingId: 'demo-C1-power', powerPrevious: 7320, powerCurrent: 7640, readAt: { year: 2026, month: 7, day: 18 }, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
  { unitId: 'C2', waterReadingId: 'demo-C2-water', waterPrevious: 334, waterCurrent: null, powerReadingId: 'demo-C2-power', powerPrevious: 4010, powerCurrent: null, readAt: null, waterPrice: TARIFS_DEMO.water, powerPrice: TARIFS_DEMO.power },
]
