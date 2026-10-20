import type { MeterReading, Unit } from './portfolio'

/**
 * Indicateurs du parc, **calculés**.
 *
 * `KPIS` était une constante écrite à la main, et elle ne se recoupait avec
 * rien : `expected: 1 415 000` n'est pas la somme des loyers des dix unités
 * occupées, qui vaut 1 397 000. Les chiffres étaient cohérents entre eux —
 * 375 000 d'impayé = 155 000 de partiel + 220 000 de retard — mais reliés à
 * aucune donnée. Rattacher un locataire ne les bougeait pas d'un franc.
 *
 * Ce ne sont pas des données : ce sont des requêtes. Ici elles s'écrivent une
 * fois, sur les unités que le fournisseur sert — donc du jeu de démonstration
 * ou du parc réel, sans que le calcul ait à savoir lequel.
 *
 * **Trois chiffres ont disparu**, et leur absence est le point : les écarts
 * mois à mois — loyers attendus, impayés, taux d'occupation — supposent un
 * historique que le produit n'a pas encore. Ils valaient `+165 000`, `+95 000`
 * et `−8 pts` depuis le premier jour et n'auraient jamais bougé. Un indicateur
 * qui ne peut pas varier ment plus sûrement qu'un indicateur absent.
 */
export interface Kpis {
  /** Somme des loyers des unités occupées. */
  expected: number
  /** Somme des versements réellement encaissés. */
  collected: number
  /** Ce qui reste dû : la différence, jamais un nombre à part. */
  outstanding: number
  /** Part de l'impayé venant de règlements partiels. */
  partial: number
  /** Part de l'impayé venant d'échéances non réglées. */
  late: number
  occupied: number
  vacant: number
  /** Taux d'occupation en pourcentage entier. */
  occupancy: number
  /** Plus grand retard constaté, en jours. */
  maxOverdueDays: number
  /** Part des unités dont le relevé d'eau est saisi, en pourcentage. */
  waterRebilled: number
  powerRebilled: number
}

export function computeKpis(units: Unit[], readings: MeterReading[]): Kpis {
  const occupees = units.filter((u) => u.status !== 'vacant')

  const expected = occupees.reduce((somme, u) => somme + u.rent, 0)
  const collected = occupees.reduce((somme, u) => somme + u.paid, 0)

  // L'impayé se ventile selon la raison, et les deux parts somment au total :
  // les écrire séparément laissait le trio dériver.
  const restant = (u: Unit) => u.rent - u.paid
  const partial = occupees.filter((u) => u.status === 'partial').reduce((s, u) => s + restant(u), 0)
  const late = occupees.filter((u) => u.status === 'overdue').reduce((s, u) => s + restant(u), 0)

  const part = (releve: (r: MeterReading) => number | null) =>
    readings.length === 0
      ? 0
      : Math.round((readings.filter((r) => releve(r) !== null).length / readings.length) * 100)

  return {
    expected,
    collected,
    outstanding: expected - collected,
    partial,
    late,
    occupied: occupees.length,
    vacant: units.length - occupees.length,
    // Un parc vide donne 0 % et non `NaN` : une division par zéro s'affichait
    // « NaN % » à l'écran d'un compte qui vient d'être créé.
    occupancy: units.length === 0 ? 0 : Math.round((occupees.length / units.length) * 100),
    maxOverdueDays: Math.max(0, ...units.map((u) => u.overdueDays ?? 0)),
    waterRebilled: part((r) => r.waterCurrent),
    powerRebilled: part((r) => r.powerCurrent),
  }
}

/**
 * LA VARIATION DE L'ENCAISSÉ D'UN MOIS SUR L'AUTRE.
 *
 * ═══ POURQUOI ELLE VIT ICI ET NON DANS L'ÉCRAN ═══
 *
 * Deux écrans montrent l'encaissé du mois — le tableau de bord et les
 * paiements — et ils affichent le MÊME nombre, `collected`. Une variation
 * calculée deux fois pourrait diverger deux fois ; calculée ici, elle ne peut
 * pas. C'est la règle que ce fichier applique déjà au reste des indicateurs.
 *
 * ═══ ELLE REND `null` PLUTÔT QU'UN ZÉRO ═══
 *
 * Trois cas où il n'y a rien à comparer, et où inventer une variation serait un
 * CHIFFRE et non une mesure :
 *
 *   · le mois précédent absent de la série — un parc qui vient de naître, ou
 *     dont les échéances s'arrêtent avant lui ;
 *   · un mois précédent à zéro — la variation serait une division par zéro, et
 *     « +∞ % » ne dit rien de plus que « il n'y avait rien avant » ;
 *   · aucune série du tout, sur un serveur qui ne la rend pas encore.
 *
 * `null` oblige l'appelant à traiter l'absence, là où un zéro se serait peint en
 * pastille verte « +0 % » sur un écran qui n'a pas de passé.
 *
 * ═══ ON COMPARE LE LOYER, ET RIEN D'AUTRE ═══
 *
 * `collected` somme ce que les baux ont réglé de leur LOYER — pas l'eau, pas
 * l'électricité, qui sont des avances récupérées et non un revenu (voir le
 * second tracé du graphe empilé). La base de comparaison prend donc le même
 * champ, sans quoi la pastille rapporterait deux grandeurs différentes l'une à
 * l'autre.
 *
 * ═══ LE NUMÉRATEUR VIENT DE LA CARTE, PAS DE LA SÉRIE ═══
 *
 * Première rédaction : la variation se calculait entre les DEUX derniers mois de
 * la série. Mesuré sur la démonstration, cela donnait une carte qui se
 * contredisait — « 950 000 FCFA », puis « −16,8 % vs 1 250 000 ». Or 950 000 est
 * `collected`, sommé sur les unités, quand le dernier mois de la série vaut
 * 1 040 000. Deux sources pour le même mois, et la pastille rapportait l'une à
 * l'autre.
 *
 * Le mois courant est donc celui que la CARTE affiche, et la série ne fournit
 * plus que la BASE — le mois précédent, celui qu'aucune autre source ne donne.
 * La variation est alors vérifiable à l'œil : le nombre du haut, le nombre de la
 * note, et le pourcentage entre les deux.
 *
 * C'est le défaut que ce dépôt s'est déjà payé une fois, avec des constantes
 * d'encaissement inventées à côté d'un indicateur calculé — « un chiffre tiré au
 * hasard aurait contredit la carte d'à côté ».
 */
/**
 * CETTE PÉRIODE EST-ELLE LE MOIS OÙ NOUS SOMMES ?
 *
 * ═══ POURQUOI ELLE EXISTE ═══
 *
 * Deux signes du tableau de bord AFFIRMENT qu'une période court encore : la
 * trame de la colonne et la phrase posée au-dessus du graphe. Les deux se
 * décidaient sur un RANG — la dernière colonne — et non sur une date. Le rang
 * ne vaut que si la série va jusqu'au mois courant, ce qu'aucun parc réel ne
 * garantit : le serveur ne rend que les périodes qui portent une échéance.
 *
 * ═══ EN UTC, ET C'EST LE SUJET ═══
 *
 * `periodStart` est estampillé à minuit UTC par le serveur, et l'ancre du parc
 * de démonstration se lit en UTC elle aussi. Comparer ces périodes au
 * calendrier LOCAL du navigateur fabriquerait un décalage d'un mois chaque fois
 * que les deux calendriers divergent — une poignée d'heures autour du 1er, à
 * Douala comme à Yaoundé. Ce dépôt a déjà payé un décalage d'un mois sur les
 * quittances ; on ne l'introduit pas ici pour économiser un `getUTC`.
 *
 * LE PRIX ASSUMÉ, en sens inverse : un gestionnaire à l'est de Greenwich qui
 * ouvre son tableau de bord dans la première heure du 1er voit encore le mois
 * qui vient de finir comme « en cours ». Son parc n'a de toute façon pas
 * d'échéance pour le mois neuf — l'appel part dans le fuseau DU PARC, et le
 * cron passe toutes les heures.
 */
export function estLeMoisEnCours(
  periode: { year: number; month: number },
  maintenant: Date = new Date(),
): boolean {
  return (
    periode.year === maintenant.getUTCFullYear() && periode.month === maintenant.getUTCMonth()
  )
}

export interface VariationMensuelle {
  /** En points de pourcentage, arrondi au dixième. Négatif quand ça baisse. */
  pourcentage: number
  /** Le mois précédent, en unités mineures — la base que l'écran doit NOMMER. */
  base: number
}

export function variationDesEncaissements(
  courant: number,
  collections: { year: number; month: number; rent: number; rentToDate?: number }[],
  maintenant: Date = new Date(),
): VariationMensuelle | null {
  /**
   * LE MOIS PRÉCÉDENT SE NOMME, IL NE SE COMPTE PAS.
   *
   * La base se prenait à l'AVANT-DERNIÈRE entrée, au motif que la dernière est
   * le mois courant. Le motif tenait pour la démonstration, qui fabrique ses
   * douze mois jusqu'à aujourd'hui ; il ne tient pour aucun parc réel. Le
   * serveur ne rend que les périodes qui PORTENT une échéance, et aucune
   * n'existe tant que l'appel des loyers n'a pas eu lieu — `Park.autoRentCall`
   * naît à `false` sur tout parc.
   *
   * Relevé le 2026-10-20 : une série d'août et septembre, rien pour octobre.
   * L'avant-dernière entrée était AOÛT, et la note disait « au même jour LE
   * MOIS DERNIER » au-dessus d'une base vieille de deux mois. Le nombre était
   * juste, sa phrase était fausse, et rien à l'écran ne les départageait.
   *
   * LA BORNE `< 2` DISPARAÎT AVEC LA POSITION : elle n'existait que pour
   * qu'une avant-dernière entrée existe. Un parc né le mois dernier porte une
   * seule période, et c'est exactement celle qu'il faut comparer.
   */
  const precedent = (() => {
    const crans = maintenant.getUTCFullYear() * 12 + maintenant.getUTCMonth() - 1
    return collections.find((c) => c.year * 12 + c.month === crans)
  })()
  if (!precedent) return null
  /**
   * ON COMPARE DEUX MOIS AU MÊME JOUR, ou on ne compare pas.
   *
   * `courant` est un mois ENTAMÉ — le graphique d'à côté le hachure et l'écrit.
   * Le rapporter au TOTAL du mois précédent annonçait une baisse tous les mois,
   * maximale le 3, sur un parc qui va bien. Mesuré sur la démonstration au
   * 28 septembre : « −24 % », en rouge, tous loyers déjà rentrés.
   *
   * L'ABSENCE DE `rentToDate` NE SE REMPLACE PAS PAR `rent`. Un serveur plus
   * ancien ne la rend pas ; s'y rabattre rétablirait le défaut exactement là où
   * personne ne regarde. Ne rien dire est la seule réponse honnête.
   */
  const base = precedent.rentToDate
  if (base === undefined || base === 0) return null
  return {
    pourcentage: Math.round(((courant - base) / base) * 1000) / 10,
    base,
  }
}
