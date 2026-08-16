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
