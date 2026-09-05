/**
 * UN PARC DONT LA DEVISE NE CORRESPOND PAS À SON PAYS — UN RELEVÉ, PAS UN CORRECTIF.
 *
 * ═══ LE DÉFAUT QUI A LAISSÉ DES TRACES ═══
 *
 * `initialSignupState` prenait le premier pays portant la devise AFFICHÉE — la
 * France, en tête de la zone euro. Regarder la grille tarifaire en euros
 * suffisait donc à faire naître son parc français.
 *
 * `paysDuCompte.test.tsx` le documente et le nomme : « c'est arrivé sur le
 * premier parc réel du produit, "Parc Bastos", né FR/EUR alors que Bastos est un
 * quartier de Yaoundé ». LE CODE EST RÉPARÉ — le pays n'est plus deviné, et il
 * est exigé. LES PARCS D'ALORS NE LE SONT PAS.
 *
 * ═══ CE QUE ÇA COÛTE, ET C'EST SILENCIEUX ═══
 *
 * `parseAmount` reconvertit toute saisie vers la devise DU PARC. Sur un parc en
 * euros affiché en francs, taper 70 000 écrit 106,71 € — arrondi au centime — et
 * relit 69 997 FCFA. Trois francs perdus par aller-retour, sur chaque loyer,
 * chaque caution, chaque devis. Relevé sur la production le 2026-09-05.
 *
 * ═══ POURQUOI LA MODALE DU PARC EST LE MAUVAIS OUTIL ═══
 *
 * Elle avertit que « les montants déjà saisis ne seront pas convertis ». Sur un
 * parc dans ce cas, basculer sans convertir DIVISE les montants par 655,957 :
 * 10 671 centimes d'euro se reliraient 10 671 francs. Il faut une CONVERSION,
 * pas un ré-étiquetage.
 *
 * ═══ CE SCRIPT N'ÉCRIT RIEN ═══
 *
 * Pas une ligne. Il relève les parcs concernés et chiffre, colonne par colonne,
 * ce qu'une conversion changerait. Réécrire douze colonnes de montants sur des
 * données réelles est une décision : elle appartient à celui qui en répond, et
 * elle se prend après une sauvegarde.
 *
 * ═══ LA PARITÉ EST UNE CONSTANTE, PAS UN COURS ═══
 *
 * 1 EUR = 655,957 XAF est fixée par le traité de coopération monétaire. Elle ne
 * périme pas, ne se demande à personne, et rend cette conversion rejouable à
 * l'identique — voir `PARITE_FRANC_CFA`. Un parc mal né en dollars, lui, ne se
 * convertit pas sans choisir une DATE de cours, et ce relevé le dit sans le
 * chiffrer.
 *
 * ═══ USAGE ═══
 *
 *     DATABASE_URL=… npm --prefix server run devise:incoherente
 */
import { prisma } from '../db.js'
import { deviseDuPays } from '../auth/routes.js'
import { PARITE_FRANC_CFA } from '../taux/taux.js'

/** Décimales par devise. `XAF` et `XOF` n'en ont aucune : le franc CFA n'a pas de centime. */
const DECIMALES: Record<string, number> = { XAF: 0, XOF: 0, EUR: 2, CAD: 2, USD: 2 }

/** Les douze colonnes de montant du schéma, par modèle. Écrites à la main : une
    liste dérivée serait d'accord avec elle-même et manquerait la treizième. */
const COLONNES = [
  ['unit', 'baseRentMinor', (id: string) => ({ building: { parkId: id } })],
  ['lease', 'rentMinor', (id: string) => ({ unit: { building: { parkId: id } } })],
  ['rentCharge', 'rentMinor', (id: string) => ({ lease: { unit: { building: { parkId: id } } } })],
  ['rentCharge', 'waterMinor', (id: string) => ({ lease: { unit: { building: { parkId: id } } } })],
  ['rentCharge', 'powerMinor', (id: string) => ({ lease: { unit: { building: { parkId: id } } } })],
  ['payment', 'amountMinor', (id: string) => ({ charge: { lease: { unit: { building: { parkId: id } } } } })],
  ['deposit', 'heldMinor', (id: string) => ({ lease: { unit: { building: { parkId: id } } } })],
  ['deposit', 'withheldMinor', (id: string) => ({ lease: { unit: { building: { parkId: id } } } })],
  ['utilityTariff', 'unitPriceMinor', (id: string) => ({ parkId: id })],
  ['inspectionFinding', 'costMinor', (id: string) => ({ inspection: { unit: { building: { parkId: id } } } })],
  ['workOrder', 'quotedAmountMinor', (id: string) => ({ unit: { building: { parkId: id } } })],
  ['workOrder', 'approvedAmountMinor', (id: string) => ({ unit: { building: { parkId: id } } })],
] as const

async function relever(): Promise<void> {
  const parcs = await prisma.park.findMany({
    select: { id: true, name: true, countryCode: true, currency: true },
    orderBy: { name: 'asc' },
  })

  const fautifs = parcs.filter((p) => p.currency !== deviseDuPays(p.countryCode))

  console.log(`\n${parcs.length} parc(s) lu(s), ${fautifs.length} dont la devise ne suit pas le pays.\n`)
  if (fautifs.length === 0) {
    console.log('Rien à convertir. Ce relevé n’écrit jamais rien — voir son en-tête.\n')
    return
  }

  for (const parc of fautifs) {
    const attendue = deviseDuPays(parc.countryCode)
    console.log(`  ${parc.name}  (${parc.countryCode})`)
    console.log(`    devise en base : ${parc.currency}   ·   attendue d’après le pays : ${attendue}`)

    const cfaVersEuro =
      DECIMALES[parc.currency] === 2 && DECIMALES[attendue] === 0
    if (!cfaVersEuro) {
      console.log(
        `    ⚠ conversion NON chiffrée ici : ${parc.currency} → ${attendue} demande un COURS,`,
      )
      console.log('      donc une date, donc une décision. Seule la parité CFA est une constante.\n')
      continue
    }

    let lignes = 0
    for (const [modele, colonne, ou] of COLONNES) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const table = (prisma as any)[modele]
      const somme = await table.aggregate({
        where: ou(parc.id),
        _sum: { [colonne]: true },
        _count: { _all: true },
      })
      const total = somme._sum[colonne] ?? 0
      const nombre = somme._count._all as number
      if (nombre === 0) continue
      lignes += nombre
      const converti = Math.round((total / 100) * PARITE_FRANC_CFA)
      console.log(
        `      ${modele}.${colonne}`.padEnd(44) +
          `${nombre} ligne(s)   ${total} → ${converti}`,
      )
    }
    console.log(
      `    ${lignes} ligne(s) porteraient une valeur nouvelle. RIEN N’A ÉTÉ ÉCRIT.\n`,
    )
  }

  console.log(
    'La conversion vaut `round(valeur / 100 × 655,957)` : la parité du franc CFA est\n' +
      'une constante de traité, pas un cours. Elle ne périme pas et se rejoue à\n' +
      'l’identique. Sauvegardez avant d’écrire quoi que ce soit.\n',
  )
}

relever()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
