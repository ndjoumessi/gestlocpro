/**
 * CE QU'UNE BASCULE DE DEVISE SANS CONVERSION A LAISSÉ — UN RELEVÉ, PAS UN CORRECTIF.
 *
 * ═══ LE GESTE ET SON PRIX ═══
 *
 * Changer la devise d'un parc ne convertit rien : la modale l'avertit — « les
 * montants déjà saisis ne seront pas convertis : 180 000 se relira 180 000 dans
 * la nouvelle devise ». Sur un parc né en EUROS par le défaut d'inscription que
 * `paysDuCompte.test.tsx` documente, les montants sont stockés en CENTIMES
 * d'euro. Ramené en francs sans conversion, un loyer de 70 000 FCFA — écrit
 * 10 671 centimes — se relit 10 671 FCFA. Divisé par 6,56.
 *
 * ═══ POURQUOI UNE CONVERSION EN BLOC SERAIT PIRE ═══
 *
 * Toutes les lignes n'ont pas été écrites sous la même devise. Multiplier tout
 * par 655,957 corromprait celles qui sont déjà justes — celles saisies APRÈS la
 * bascule. Ce relevé DATE chaque ligne au lieu de deviner.
 *
 * ═══ CE QUE LE REGISTRE PERMET, ET DEPUIS QUAND ═══
 *
 * `park.update` est tracé depuis le 2026-08-29 (`cf1e349`) et porte la devise
 * NOUVELLE avec son horodatage. On en tire une CHRONOLOGIE : entre deux
 * événements, la devise en vigueur est celle du dernier.
 *
 * LA TRACE NE PORTE PAS L'ANCIENNE VALEUR. Avant le premier événement, la devise
 * de naissance ne se lit nulle part : elle se DÉCLARE, par `--depart=`. Sans
 * elle, ce relevé ne suppose rien et le dit.
 *
 * ═══ TROIS COLONNES SUR DOUZE NE SE DATENT PAS ═══
 *
 * `InspectionFinding` n'a AUCUNE date — le schéma le dit — donc son `costMinor`
 * est inclassable. `WorkOrder` n'a pas de `createdAt` mais un `reportedAt`, qui
 * date le signalement et non le chiffrage : ses deux montants sont datés par
 * approche, et le relevé le signale plutôt que de faire comme si.
 *
 * ═══ IL N'ÉCRIT RIEN ═══
 *
 * Il montre, ligne par ligne, la date, la devise en vigueur, la valeur actuelle
 * et celle qu'une reconstruction poserait. Vous reconnaissez vos loyers, ou
 * non — et c'est cette reconnaissance qui autorise l'écriture, pas ce script.
 *
 * ═══ USAGE ═══
 *
 *     DATABASE_URL=… npm --prefix server run montants:a-dater
 *     DATABASE_URL=… npm --prefix server run montants:a-dater -- --depart=EUR
 */
import { prisma } from '../db.js'
import { PARITE_FRANC_CFA } from '../taux/taux.js'

const DECIMALES: Record<string, number> = { XAF: 0, XOF: 0, EUR: 2, CAD: 2, USD: 2 }

/** Les colonnes de montant, avec ce qui les DATE. `null` : rien ne les date. */
const COLONNES: {
  modele: string
  colonne: string
  date: string | null
  approche?: string
  ou: (id: string) => object
}[] = [
  { modele: 'unit', colonne: 'baseRentMinor', date: 'createdAt', ou: (id) => ({ building: { parkId: id } }) },
  { modele: 'lease', colonne: 'rentMinor', date: 'createdAt', ou: (id) => ({ unit: { building: { parkId: id } } }) },
  { modele: 'rentCharge', colonne: 'rentMinor', date: 'createdAt', ou: (id) => ({ lease: { unit: { building: { parkId: id } } } }) },
  { modele: 'rentCharge', colonne: 'waterMinor', date: 'createdAt', ou: (id) => ({ lease: { unit: { building: { parkId: id } } } }) },
  { modele: 'rentCharge', colonne: 'powerMinor', date: 'createdAt', ou: (id) => ({ lease: { unit: { building: { parkId: id } } } }) },
  { modele: 'payment', colonne: 'amountMinor', date: 'createdAt', ou: (id) => ({ charge: { lease: { unit: { building: { parkId: id } } } } }) },
  { modele: 'deposit', colonne: 'heldMinor', date: 'createdAt', ou: (id) => ({ lease: { unit: { building: { parkId: id } } } }) },
  { modele: 'deposit', colonne: 'withheldMinor', date: 'createdAt', ou: (id) => ({ lease: { unit: { building: { parkId: id } } } }) },
  { modele: 'utilityTariff', colonne: 'unitPriceMinor', date: 'createdAt', ou: (id) => ({ parkId: id }) },
  { modele: 'workOrder', colonne: 'quotedAmountMinor', date: 'reportedAt', approche: 'daté par le SIGNALEMENT, pas par le chiffrage', ou: (id) => ({ unit: { building: { parkId: id } } }) },
  { modele: 'workOrder', colonne: 'approvedAmountMinor', date: 'reportedAt', approche: 'daté par le SIGNALEMENT, pas par la validation', ou: (id) => ({ unit: { building: { parkId: id } } }) },
  { modele: 'inspectionFinding', colonne: 'costMinor', date: null, ou: (id) => ({ inspection: { unit: { building: { parkId: id } } } }) },
]

/**
 * L'ACCÈS PAR NOM AU CLIENT PRISMA, ET POURQUOI IL EST ÉCRIT À LA MAIN.
 *
 * `COLONNES` nomme douze couples modèle/colonne. Les écrire en douze requêtes
 * typées ferait douze fois le même corps ; les lire par nom demande un index
 * dynamique, que Prisma ne type pas. On paie ce détour UNE fois, ici, et on
 * échoue FORT si le nom ne désigne rien — plutôt que de rendre « 0 ligne » pour
 * un modèle mal orthographié, ce qui se lirait comme « rien à reconstruire ».
 */
type ModelePrisma = {
  count: (a: unknown) => Promise<number>
  findMany: (a: unknown) => Promise<Record<string, unknown>[]>
}

function modele(nom: string): ModelePrisma {
  const trouve = (prisma as unknown as Record<string, ModelePrisma | undefined>)[nom]
  if (!trouve) throw new Error(`Modèle Prisma inconnu : ${nom}`)
  return trouve
}

/** La devise en vigueur à une date, d'après la chronologie du registre. */
function deviseAlors(
  quand: Date,
  chronologie: { a: Date; devise: string }[],
  depart: string | null,
): string | null {
  let courante = depart
  for (const etape of chronologie) {
    if (etape.a <= quand) courante = etape.devise
    else break
  }
  return courante
}

async function relever(depart: string | null): Promise<void> {
  const parcs = await prisma.park.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: { name: 'asc' },
  })

  for (const parc of parcs) {
    const evenements = await prisma.auditEvent.findMany({
      where: { parkId: parc.id, action: 'park.update' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, payload: true },
    })
    const chronologie = evenements
      .map((e) => ({ a: e.createdAt, devise: (e.payload as { currency?: string })?.currency ?? '' }))
      .filter((e) => e.devise !== '')

    /* AUCUN CHANGEMENT TRACÉ : rien à reconstruire par datation. Le parc a
       toujours porté la devise qu'il porte, ou le geste précède le registre. */
    if (chronologie.length === 0) continue

    console.log(`\n  ${parc.name}   devise actuelle : ${parc.currency}`)
    console.log('    chronologie du registre :')
    for (const e of chronologie) {
      console.log(`      ${e.a.toISOString().slice(0, 16).replace('T', ' ')}  →  ${e.devise}`)
    }
    if (!depart) {
      console.log(
        '    ⚠ DEVISE DE NAISSANCE INCONNUE : la trace ne porte que la NOUVELLE valeur.\n' +
          '      Les lignes antérieures au premier événement ne sont pas classées.\n' +
          '      Relancez avec `-- --depart=EUR` pour les inclure, si vous le savez.',
      )
    }

    for (const col of COLONNES) {
      if (col.date === null) {
        const combien = await modele(col.modele).count({
          where: { ...col.ou(parc.id), [col.colonne]: { not: null } },
        })
        if (combien > 0) {
          console.log(
            `      ${col.modele}.${col.colonne}`.padEnd(46) +
              `${combien} ligne(s) — INCLASSABLE : ce modèle n’a aucune date.`,
          )
        }
        continue
      }

      const lignes = await modele(col.modele).findMany({
        where: col.ou(parc.id),
        select: { id: true, [col.colonne]: true, [col.date]: true },
      })

      let aConvertir = 0
      const exemples: string[] = []
      let inconnues = 0
      for (const ligne of lignes) {
        const valeur = ligne[col.colonne] as number | null
        if (valeur === null || valeur === undefined) continue
        const alors = deviseAlors(ligne[col.date] as Date, chronologie, depart)
        if (alors === null) {
          inconnues += 1
          continue
        }
        if (alors === parc.currency) continue
        aConvertir += 1
        if (DECIMALES[alors] === 2 && DECIMALES[parc.currency] === 0 && exemples.length < 3) {
          exemples.push(
            `${(ligne[col.date] as Date).toISOString().slice(0, 10)}  ${valeur} ${alors} → ` +
              `${Math.round((valeur / 100) * PARITE_FRANC_CFA)} ${parc.currency}`,
          )
        }
      }

      if (aConvertir === 0 && inconnues === 0) continue
      const suffixe = col.approche ? `   (${col.approche})` : ''
      console.log(
        `      ${col.modele}.${col.colonne}`.padEnd(46) +
          `${aConvertir} à reconstruire, ${inconnues} non classée(s)${suffixe}`,
      )
      for (const ex of exemples) console.log(`          ${ex}`)
    }
    console.log('    RIEN N’A ÉTÉ ÉCRIT.')
  }

  console.log(
    '\nReconnaissez vos montants avant d’écrire quoi que ce soit : c’est cette\n' +
      'reconnaissance qui autorise la reconstruction, pas ce relevé. Sauvegardez.\n',
  )
}

const depart =
  process.argv.find((a) => a.startsWith('--depart='))?.slice('--depart='.length) ?? null
relever(depart)
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
