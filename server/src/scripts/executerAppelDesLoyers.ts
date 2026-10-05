import { prisma } from '../db.js'
import { emettreLesAppelsDeLoyer } from '../parks/routes.js'

/**
 * L'APPEL DES LOYERS, SANS QUE PERSONNE NE CLIQUE.
 *
 * ═══ CE QUE SON ABSENCE COÛTAIT, ET POURQUOI ELLE ÉTAIT MUETTE ═══
 *
 * `POST /:parkId/charges` est la route qui FABRIQUE la dette. Sans échéance, il
 * n'y a ni solde, ni retard, ni relance, ni mise en demeure : le cron horaire
 * des relances tournait au-dessus d'un mois que personne n'avait appelé, et
 * imprimait « 0 bail au jalon ». Ce zéro se lit comme un parc sain — c'était le
 * seul automatisme du produit dont l'absence ne disait rien.
 *
 * ═══ IL APPELLE LA FONCTION DE LA ROUTE, JAMAIS SA PROPRE REQUÊTE ═══
 *
 * `emettreLesAppelsDeLoyer` est exactement ce que `POST /:parkId/charges`
 * exécute. C'est la règle que ce dépôt s'est déjà donnée pour les relances, et
 * l'enjeu est plus lourd ici : ce qui est en cause n'est pas un courriel mais
 * une dette. Deux rédactions du même calcul finiraient par appeler deux
 * montants pour le même mois, et la seule trace pour les départager serait le
 * solde du locataire.
 *
 * ═══ IL EST ÉTEINT PARTOUT À SA NAISSANCE ═══
 *
 * `Park.autoRentCall` vaut `false` par défaut — le seul interrupteur de parc
 * dans ce cas. Une relance RAPPELLE une dette appelée ; un appel la CRÉE.
 * Hériter celui-ci aurait fait naître des échéances sur tous les baux actifs de
 * tous les parcs existants à l'heure suivant la migration.
 *
 * CONSÉQUENCE À ASSUMER : ce passage ne fera RIEN en production tant qu'aucun
 * propriétaire n'aura allumé son parc. Un compte rendu qui dirait « 0 appel »
 * sans distinguer « éteint partout » de « rien à appeler » répéterait la faute
 * qu'on vient de corriger chez les relances — d'où `parcsAllumes` dans la ligne.
 */

/**
 * LE JOUR DU MOIS DANS LE FUSEAU D'UN PARC, de 1 à 31.
 *
 * Même forme que `heureDansLeFuseau` chez les relances, et pour la même raison :
 * un parc qui loue à Yaoundé sous un hébergeur en UTC ne doit pas appeler ses
 * loyers la veille.
 */
export function jourDansLeFuseau(quand: Date, fuseau: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, day: '2-digit' }).format(quand),
  )
}

/**
 * LE PREMIER JOUR DU MOIS COURANT DANS LE FUSEAU DU PARC, à minuit UTC.
 *
 * C'est la période appelée, et elle se décide dans le calendrier du parc et non
 * dans celui du serveur. Le 1er mars à 00 h 30 à Douala, il est encore le
 * 28 février en UTC : lire le mois en UTC appellerait février une seconde fois
 * — sans effet grâce à l'unicité, mais mars ne partirait jamais ce jour-là.
 *
 * `periodStart` est une colonne `@db.Date` : minuit UTC est la seule valeur qui
 * ne se décale pas en la relisant.
 */
export function premierDuMoisDansLeFuseau(quand: Date, fuseau: string): Date {
  /* `en-CA` rend « 2026-10 », dans cet ordre et avec ce séparateur — c'est la
     seule étiquette que ce dépôt emploie pour obtenir une date ISO d'`Intl`.
     Les deux morceaux sont lus par INDICE et non par déstructuration : sous
     `noUncheckedIndexedAccess`, un `split` rend `string | undefined`, et le
     compilateur a raison de le dire — une étiquette inattendue donnerait
     `NaN`, donc une date invalide, donc un mois appelé nulle part. */
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
  })
    .format(quand)
    .split('-')
  const annee = Number(parties[0])
  const mois = Number(parties[1])
  return new Date(Date.UTC(annee, mois - 1, 1))
}

/**
 * LE JOUR OÙ L'APPEL PART RÉELLEMENT, borné au mois qu'on traverse.
 *
 * ═══ LE DÉFAUT QUE CETTE BORNE FERME ═══
 *
 * Un parc réglé au 31 ne serait JAMAIS appelé en février, avril, juin,
 * septembre ni novembre : le mois n'atteint pas 31, la comparaison ne devient
 * jamais vraie, et cinq mois sur douze passeraient sans qu'une seule ligne de
 * journal le dise. La borne ramène le réglage au dernier jour du mois.
 *
 * LA GARDE EN ZOD REFUSE DÉJÀ TOUT RÉGLAGE AU-DESSUS DE 28, et cette fonction
 * ne lui fait pas confiance pour autant. La colonne est un `Int` sans
 * contrainte : une valeur hors bornes peut venir d'une écriture directe en base
 * ou d'un lot antérieur à la garde. Un défaut qui ne se verrait que cinq mois
 * sur douze mérite deux remparts.
 */
export function jourDeclencheur(reglage: number, periode: Date): number {
  const joursDuMois = new Date(
    Date.UTC(periode.getUTCFullYear(), periode.getUTCMonth() + 1, 0),
  ).getUTCDate()
  /* `Math.max(1, …)` aussi : un 0 ou un négatif en base appellerait sinon
     jamais, ou tous les jours selon le sens de la comparaison. */
  return Math.min(Math.max(1, reglage), joursDuMois)
}

/**
 * EST-CE LE JOUR DE CE PARC ? Extraite pour être ÉPROUVÉE.
 *
 * ═══ ON COMPARE AVEC `>=`, ET NON `===` ═══
 *
 * Un passage manqué ne doit pas sauter un MOIS. Avec l'égalité, un parc réglé
 * au 3 dont le cron n'a pas tourné le 3 — déploiement, panne, porte rouge qui
 * gèle l'hébergeur, les trois mesurés dans ce dépôt — n'aurait plus aucune
 * occasion avant le mois suivant, et personne n'aurait rien à relancer pendant
 * trente jours.
 *
 * C'EST L'UNICITÉ QUI REND CE CHOIX GRATUIT : `(leaseId, periodStart)` est
 * unique et l'écriture est en `skipDuplicates`, si bien que les vingt-sept
 * passages suivants du mois ne rappellent rien. Ils rattrapent en revanche un
 * bail créé le 14, qui reçoit son échéance à l'heure suivante au lieu
 * d'attendre le mois prochain.
 *
 * ═══ POURQUOI ELLE EST UNE FONCTION, ET NON UNE LIGNE DANS LA BOUCLE ═══
 *
 * La borne `>=` ne se distingue de `===` que les jours où le réglage et la date
 * diffèrent. Éprouvée à travers la base, elle demanderait un parc réglé « la
 * veille » — impossible à construire le 1er du mois, où la garde rougirait sans
 * qu'aucun code n'ait changé. Un cas qui tombe un jour sur trente est pire
 * qu'aucun cas : il apprend à relancer la chaîne au lieu de lire.
 *
 * C'est la raison exacte pour laquelle `estLHeureDuResume` a été extraite chez
 * les relances, et la forme qu'elle y a prise.
 */
export function estSonJour(reglage: number, quand: Date, fuseau: string): boolean {
  const periode = premierDuMoisDansLeFuseau(quand, fuseau)
  return jourDansLeFuseau(quand, fuseau) >= jourDeclencheur(reglage, periode)
}

/**
 * CE QUE LE PASSAGE A FAIT, EN UNE LIGNE QUI NE MENT PAS.
 *
 * Trois nombres et non un, pour la raison exacte écrite chez les relances : un
 * zéro doit dire LEQUEL de ses sens il porte. Ici il y en a trois —
 * « personne n'a allumé », « ce n'est pas encore le jour » et « tout est déjà
 * appelé » — et seul le dernier est une information sur les baux.
 */
export function compteRenduDesAppels(
  r: { parcsTraites: number; parcsAllumes: number; parcsAuJour: number; emises: number },
  aBlanc: boolean,
): string {
  if (aBlanc) {
    return (
      `À BLANC — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsAllumes} avec l'appel automatique, ` +
      `${r.parcsAuJour} à leur jour, ${r.emises} échéance(s) PARTIRAIENT. ` +
      "Rien n'a été écrit."
    )
  }
  return (
    `Appel automatique — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsAllumes} allumé(s), ` +
    `${r.parcsAuJour} à leur jour, ${r.emises} échéance(s) émise(s).`
  )
}

export async function executerAppelDesLoyers(
  options: { aBlanc?: boolean } = {},
): Promise<{ parcsTraites: number; parcsAllumes: number; parcsAuJour: number; emises: number }> {
  const maintenant = new Date()
  const parcs = await prisma.park.findMany({
    select: { id: true, autoRentCall: true, rentCallDayOfMonth: true, reminderTimeZone: true },
  })

  let parcsAllumes = 0
  let parcsAuJour = 0
  let emises = 0

  for (const parc of parcs) {
    /* ÉTEINT POUR CE PARC : on ne compte rien, pas même à blanc. Annoncer un
       appel qu'un réglage interdit ferait mentir la seule lecture qui précède
       la décision de brancher. */
    if (!parc.autoRentCall) continue
    parcsAllumes += 1

    const debut = premierDuMoisDansLeFuseau(maintenant, parc.reminderTimeZone)

    /*
      LA BORNE DU JOUR VIT DANS `estSonJour`, et le `>=` qu'elle porte y est
      expliqué et éprouvé.

      À BLANC, ELLE NE S'APPLIQUE PAS : le mode répond à « qu'émettrait ce parc
      à son jour », et non à « qu'émettrait-il aujourd'hui ». Sans cela, la
      seule lecture qui précède la décision de brancher rendrait zéro pour la
      seule raison qu'on l'a lancée le 2.
    */
    const auJour = estSonJour(parc.rentCallDayOfMonth, maintenant, parc.reminderTimeZone)
    if (!options.aBlanc && !auJour) continue
    if (auJour) parcsAuJour += 1

    const { issued } = await emettreLesAppelsDeLoyer({
      parkId: parc.id,
      debut,
      /* AUCUNE RESTRICTION DE PÉRIMÈTRE, et c'est le seul appelant qui en a le
         droit : il n'agit au nom d'aucune adhésion, donc il n'en outrepasse
         aucune. Les routes, elles, posent toujours `porteeDesUnites`. */
      perimetreUnite: {},
      /* ACTEUR NUL : personne n'a cliqué. Le registre en dérive un acteur
         SYSTÈME par la charge de l'événement, et n'affiche donc pas
         « Compte supprimé » devant un acte que le produit a posé seul. */
      acteurId: null,
      /* `?? false` ET NON `options.aBlanc` : sous `exactOptionalPropertyTypes`,
         poser explicitement `undefined` sur une propriété optionnelle n'est pas
         la même chose que l'omettre, et le compilateur refuse la confusion. */
      aBlanc: options.aBlanc ?? false,
    })
    emises += issued
  }

  return { parcsTraites: parcs.length, parcsAllumes, parcsAuJour, emises }
}
