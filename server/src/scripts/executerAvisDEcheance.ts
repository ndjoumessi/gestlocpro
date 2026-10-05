import { prisma } from '../db.js'

/**
 * LES ÉCHÉANCES DE BAIL PRÉVIENNENT.
 *
 * ═══ CE QUI EXISTAIT, ET QUI N'ÉTAIT ALIMENTÉ PAR PERSONNE ═══
 *
 * `NotificationKind.lease` n'était écrit qu'à UN endroit du routeur — la mise en
 * demeure. Pendant ce temps, le dictionnaire portait depuis des lots un libellé
 * complet, avec son pluriel et ses quatre variables :
 *
 *     leaseRenewal: { title: 'Bail {unit} à renouveler dans {count} jours',
 *                     detail: '{tenant} · échéance au {date}' }
 *
 * Et les deux dates existaient aussi, posées par le lot « congé, révision,
 * garant » : `Lease.endsOn` et `Lease.moveOutOn`. Un bail arrivait donc à son
 * terme, un locataire annonçait son départ, et le produit n'en disait rien.
 *
 * C'est la troisième fois que ce dépôt trouve cette forme : un tuyau d'aval
 * posé, et rien en amont. `RentCharge.waterMinor` servie par la quittance et
 * écrite par personne ; `AuditEvent` écrit à seize endroits et lu nulle part.
 *
 * ═══ DEUX ÉCHÉANCES, DEUX DÉLAIS, ET LE SECOND EST PLUS COURT ═══
 *
 * Soixante jours avant le terme, trente avant le départ. Ce n'est pas une
 * symétrie manquée : les deux avis ne demandent pas le même travail.
 *
 * Renouveler se négocie — il faut écrire au locataire, s'entendre sur un loyer,
 * peut-être poser une révision. Deux mois est le délai dans lequel cette
 * conversation tient sans se faire sous la contrainte.
 *
 * Un départ, lui, est déjà décidé. Ce qu'il reste à faire est une liste :
 * l'état des lieux de sortie, l'arbitrage de la caution, et l'annonce du
 * logement. Un mois suffit, et prévenir deux mois à l'avance d'un geste qui
 * s'exécute en une semaine fabrique un avis qu'on apprend à ignorer.
 */

/**
 * COMBIEN DE JOURS AVANT, POUR CHACUNE.
 *
 * Des constantes et non des colonnes de parc, et c'est un choix de périmètre
 * déclaré. Les rendre réglables demanderait deux champs de plus dans un écran
 * de réglages qui en reçoit déjà deux dans ce même lot, pour une question que
 * personne n'a encore posée. Le jour où un bailleur la pose, la forme est déjà
 * connue — c'est celle de `reminderMilestoneDays`.
 */
export const JOURS_AVANT_LE_TERME = 60
export const JOURS_AVANT_LE_DEPART = 30

/** Minuit UTC du jour de `quand` — la granularité des colonnes `@db.Date`. */
export function jourUtc(quand: Date): Date {
  return new Date(Date.UTC(quand.getUTCFullYear(), quand.getUTCMonth(), quand.getUTCDate()))
}

/**
 * COMBIEN DE JOURS SÉPARENT DEUX JOURS.
 *
 * Les deux bornes sont ramenées à minuit UTC AVANT la soustraction. Sans cela,
 * une échéance lue à 23 h et un « aujourd'hui » lu à 1 h rendraient 59,08 jours
 * là où le calendrier en compte 60, et `Math.floor` les tronquerait à 59 : le
 * bail serait annoncé un jour trop tard, une fois sur vingt-quatre.
 */
export function joursJusqua(echeance: Date, depuis: Date): number {
  return Math.round((+jourUtc(echeance) - +jourUtc(depuis)) / 86_400_000)
}

/**
 * CETTE ÉCHÉANCE EST-ELLE ASSEZ PROCHE POUR SON GENRE ?
 *
 * ═══ UNE SEULE BORNE ICI, ET C'EST UNE MUTATION QUI L'A IMPOSÉ ═══
 *
 * Cette fonction portait `jours >= 0 && jours <= delai`. La borne basse y était
 * MORTE : la requête filtre déjà `gte: aujourdhui`, si bien qu'aucune échéance
 * passée n'atteint jamais cette ligne. Mesuré en retirant le `>= 0` — le cas
 * « n'annonce PAS une échéance déjà passée » est resté VERT.
 *
 * C'est la faute que ce dépôt nomme ailleurs mot pour mot : « deux gardes pour
 * une même règle ne valent pas mieux qu'une : elles se couvrent l'une l'autre,
 * et AUCUNE des deux ne peut alors être mise en défaut ». Le cas qui croyait
 * éprouver la borne basse éprouvait la requête, et le `>= 0` aurait survécu à
 * n'importe quelle mutation sans qu'on sache s'il servait encore.
 *
 * LA BORNE BASSE VIT DONC DANS LA REQUÊTE, qui en a besoin de toute façon pour
 * ne pas ramener tout l'historique du parc. Une seule garde, à l'endroit où
 * elle est aussi utile.
 *
 * ZÉRO RESTE DEDANS : le jour même de l'échéance est le dernier où l'avis vaut
 * quelque chose, et le seul où un bail que le cron n'a pas vu pendant deux mois
 * peut encore être rattrapé.
 *
 * ═══ CE QUE CETTE FENÊTRE NE COUVRE PAS, ET QUI EST UN VRAI DÉFAUT ═══
 *
 * Un bail `active` dont `endsOn` est PASSÉ continue de courir sans que rien ne
 * le signale. Ce n'est pas une échéance à venir, c'est une incohérence
 * installée — et elle demande un autre geste que l'avis : une correction du
 * bail, ou un avenant. Le dire ici reviendrait à poster un avis que personne ne
 * peut refermer. Nommé, pas construit.
 */
export function dansLeDelai(jours: number, delai: number): boolean {
  return jours <= delai
}

/**
 * CE QUE LE PASSAGE A FAIT, EN UNE LIGNE QUI NE MENT PAS.
 *
 * `bauxLus` sépare « aucun bail n'approche » de « le cron n'a rien trouvé à
 * lire » — même raison que `parcsALHeure` chez les relances. Un zéro doit dire
 * lequel de ses sens il porte.
 */
export function compteRenduDesAvis(
  r: { bauxLus: number; termes: number; departs: number },
  aBlanc: boolean,
): string {
  const quoi = `${r.termes} terme(s), ${r.departs} départ(s)`
  return aBlanc
    ? `À BLANC — ${r.bauxLus} bail(s) dans une fenêtre d'annonce : ${quoi} PARTIRAIENT. Rien n'a été écrit.`
    : `Avis d'échéance — ${r.bauxLus} bail(s) dans une fenêtre d'annonce, ${quoi} annoncé(s).`
}

export async function executerAvisDEcheance(
  options: { aBlanc?: boolean } = {},
): Promise<{ bauxLus: number; termes: number; departs: number }> {
  const maintenant = new Date()
  const aujourdhui = jourUtc(maintenant)
  /* LA PLUS LONGUE DES DEUX FENÊTRES borne la requête PAR LE HAUT ; chaque
     échéance est ensuite confrontée à SON délai, plus court pour un départ.
     Deux requêtes auraient lu deux fois les mêmes baux — ceux qui approchent
     des deux à la fois.

     PAR LE BAS, `gte: aujourdhui` EST LA GARDE et non une commodité : c'est la
     seule chose qui empêche d'annoncer le terme de tous les baux échus depuis
     l'origine du parc, « à renouveler dans −400 jours », le libellé rendant ce
     nombre tel quel. Elle ne se double pas d'un `>= 0` en mémoire — voir
     `dansLeDelai`, et la mutation qui l'a fait retirer. */
  const horizon = new Date(
    +aujourdhui + Math.max(JOURS_AVANT_LE_TERME, JOURS_AVANT_LE_DEPART) * 86_400_000,
  )

  const baux = await prisma.lease.findMany({
    where: {
      /* `pending` EST DEDANS AVEC `active`, exactement comme pour l'appel des
         loyers : un bail signé qui n'a pas encore commencé peut déjà porter un
         terme, et le taire le ferait découvrir le jour de son échéance. */
      status: { in: ['active', 'pending'] },
      OR: [
        { endsOn: { gte: aujourdhui, lte: horizon } },
        { moveOutOn: { gte: aujourdhui, lte: horizon } },
      ],
    },
    select: {
      id: true,
      endsOn: true,
      moveOutOn: true,
      unitId: true,
      tenant: { select: { fullName: true } },
      unit: { select: { building: { select: { parkId: true } } } },
      /* LES AVIS DÉJÀ DONNÉS POUR CE BAIL, lus en une fois avec lui. Les
         relire bail par bail ferait deux requêtes par bail — la faute que
         l'appel des loyers évite déjà en lisant relevés et tarifs en bloc. */
      deadlineNotices: { select: { kind: true, dueOn: true } },
    },
  })

  let termes = 0
  let departs = 0
  let bauxLus = 0

  for (const bail of baux) {
    /* LES DEUX ÉCHÉANCES DU BAIL, DANS CET ORDRE ET PAS L'AUTRE : un départ
       annoncé prime sur un terme contractuel, et c'est lui qu'on veut lire en
       premier dans un journal. */
    const echeances = [
      { kind: 'moveOut' as const, quand: bail.moveOutOn, delai: JOURS_AVANT_LE_DEPART },
      { kind: 'term' as const, quand: bail.endsOn, delai: JOURS_AVANT_LE_TERME },
    ]
    let compteCeBail = false

    for (const echeance of echeances) {
      if (echeance.quand === null) continue
      const jours = joursJusqua(echeance.quand, maintenant)
      if (!dansLeDelai(jours, echeance.delai)) continue
      compteCeBail = true

      /* DÉJÀ DIT POUR CETTE ÉCHÉANCE-LÀ. La comparaison porte sur la DATE et
         non sur le seul genre : déplacer un congé rouvre le droit d'en parler,
         le laisser en place le referme. */
      const dejaDit = bail.deadlineNotices.some(
        (avis) => avis.kind === echeance.kind && +avis.dueOn === +jourUtc(echeance.quand!),
      )
      if (dejaDit) continue

      if (echeance.kind === 'term') termes += 1
      else departs += 1
      if (options.aBlanc) continue

      /*
        L'AVIS ET SA TRACE, DANS UNE TRANSACTION.

        L'ordre inverse de celui de la mise en demeure, et pour la raison
        opposée : là-bas « l'acte EST l'avis », si bien que le registre ne doit
        pas pouvoir empêcher la mise en demeure de partir. Ici la trace n'est
        pas un registre, c'est la GARDE D'IDEMPOTENCE : un avis écrit sans sa
        trace se répéterait toutes les heures pendant deux mois, et c'est
        précisément le défaut que cette table existe pour fermer.

        Les deux ensemble, donc — et `skipDuplicates` n'y suffirait pas, parce
        que c'est l'avis, non la trace, qui se dupliquerait.
      */
      await prisma.$transaction([
        prisma.notification.create({
          data: {
            parkId: bail.unit.building.parkId,
            kind: 'lease',
            messageKey: echeance.kind === 'term' ? 'leaseRenewal' : 'leaseMoveOut',
            /*
              `unit` N'EST PAS DANS LES PARAMÈTRES, et c'est voulu.

              Le libellé réclame `{unit}`, mais l'écran le résout lui-même
              depuis `Notification.unitId` — « `if (data.unitId) vars.unit =
              data.unitId` » poserait sinon l'uuid brut à l'écran, et un
              libellé figé ici cesserait de suivre un logement renommé.

              `dueOn` EST EN PARTIES MACHINE, dont le mois est à base ZÉRO :
              c'est la forme de `DateParts`, que `useAlertMessage` passe à
              `d.fullDate`. Écrire une chaîne française ici referait le défaut
              que le lot des dates a corrigé partout ailleurs.
            */
            params: {
              tenant: bail.tenant.fullName,
              count: jours,
              dueOn: {
                year: echeance.quand.getUTCFullYear(),
                month: echeance.quand.getUTCMonth(),
                day: echeance.quand.getUTCDate(),
              },
            },
            /* UN DÉPART EST PLUS URGENT QU'UN RENOUVELLEMENT, à délai plus
               court : ce qu'il reste à faire est une liste de gestes datés —
               état des lieux de sortie, arbitrage de caution — alors qu'un
               terme ouvre une négociation. */
            severity: echeance.kind === 'moveOut' ? 'high' : 'medium',
            unitId: bail.unitId,
          },
        }),
        prisma.leaseDeadlineNotice.create({
          data: { leaseId: bail.id, kind: echeance.kind, dueOn: jourUtc(echeance.quand) },
        }),
      ])
    }

    if (compteCeBail) bauxLus += 1
  }

  return { bauxLus, termes, departs }
}
