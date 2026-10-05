import { prisma } from '../db.js'
import { compteRenduDesAppels, executerAppelDesLoyers } from './executerAppelDesLoyers.js'
import { compteRenduDesAvis, executerAvisDEcheance } from './executerAvisDEcheance.js'
import { compteRenduDEffacement, effacerLesComptesFermes } from '../auth/effacementDesComptes.js'
import { calculerRetard, tenterRelanceEmailMilestone } from '../parks/routes.js'
import { envoyerLesResumesDuFil } from '../parks/resumeDuFil.js'

/**
 * LE POINT D'ENTRÉE DU CRON — branché depuis le 2026-09-02.
 *
 * Un service Railway distinct l'exécute TOUTES LES HEURES. Il passait
 * auparavant une fois par jour à 6 h UTC ; l'heure vit désormais dans le parc,
 * et la planification ne sait plus QUAND envoyer, seulement quand REGARDER.
 *
 * C'est ce qui rend l'heure réglable depuis le produit. Le prix est explicite :
 * vingt-trois passages sur vingt-quatre ne font qu'une lecture pour un parc
 * donné, et s'arrêtent. Une lecture par heure vaut mieux qu'un propriétaire
 * obligé d'ouvrir un tableau de bord d'hébergeur pour décaler un envoi d'une
 * heure.
 *
 * `executerRelancesAutomatiques()` boucle sur TOUS les parcs et appelle, pour
 * chaque bail à J+7, EXACTEMENT les fonctions que la route manuelle
 * `POST /:parkId/reminders?only=milestones` appelle déjà — `calculerRetard`
 * pour le dû et le retard, `tenterRelanceEmailMilestone` pour la garde de
 * course et l'envoi. Un déclenchement manuel et le cron ne peuvent donc pas
 * diverger sur CE QUI compte comme un envoi valide ; ils ne diffèrent que sur
 * QUI déclenche et QUAND — exactement la portion que ce lot ne construit pas.
 *
 * ═══ EN PRODUCTION, IL MIGRE AVANT DE LIRE — DEPUIS LE 2026-09-30 ═══
 *
 * Le service Railway le lance par `npm --prefix server run relances:production`,
 * qui vaut `prisma migrate deploy && tsx <ce fichier>`. Le nom est choisi pour
 * être greppable : `relances:auto` reste ce qu'on lance à la main, sans toucher
 * l'état des migrations d'une base de développement.
 *
 * POURQUOI. Seul le service WEB jouait `prisma migrate deploy`, dans son
 * `start`. Le cron, lui, démarrait droit sur son script. Le 2026-09-30, une
 * porte rouge sur `main` a gelé le déploiement web pendant quatre heures
 * pendant que le cron, réglé sans attente de vérifications, prenait le code
 * neuf : il a tourné quatre fois avec du CODE NEUF SUR UN SCHÉMA ANCIEN.
 *
 * RIEN N'A CASSÉ, ET C'ÉTAIT UNE CHANCE. Ce script ne lit aucune des colonnes
 * qui venaient d'apparaître — il aurait suffi qu'un lot touche `Lease` ou
 * `Notification` pour que chaque passage horaire échoue. On ne garde pas une
 * production sur la forme des requêtes que le prochain lot écrira.
 *
 * LE DÉCALAGE RESTE POSSIBLE DANS L'AUTRE SENS, et il est accepté : ce cron
 * peut appliquer une migration avant que le web ait fini de déployer, laissant
 * un instant du code ANCIEN sur un schéma NEUF. C'est déjà le cas à chaque
 * déploiement — le conteneur web migre puis démarre, pendant que l'ancien sert
 * encore — et les migrations de ce dépôt sont additives. Une migration
 * destructrice demanderait une autre méthode, et ce commentaire est l'endroit
 * où l'on s'en souviendra.
 *
 * DEUX SERVICES PEUVENT MIGRER SANS SE MARCHER DESSUS : `prisma migrate deploy`
 * prend un verrou consultatif sur la base, et le second attend.
 *
 * ═══ CHANGER CETTE COMMANDE DEMANDE UNE POUSSÉE, PAS UN REDÉPLOIEMENT ═══
 *
 * Mesuré le 2026-09-30, et c'est le passage de 15 h qui l'a dit. La commande de
 * démarrage a été changée chez l'hébergeur à 14 h 21, puis le service redéployé
 * à 14 h 24 — l'outil de mise à jour annonçant « use redeploy to apply
 * immediately ». À 15 h 00, le conteneur a pourtant lancé `relances:auto` :
 *
 *     14 h 18   déploiement depuis la poussée — instantané avec `relances:auto`
 *     14 h 21   `startCommand` changé, appliqué et relu dans la configuration
 *     14 h 24   REDÉPLOIEMENT — qui recopie l'instantané de 14 h 18
 *     15 h 00   le conteneur lance `relances:auto`
 *
 * UN REDÉPLOIEMENT REJOUE UN INSTANTANÉ, configuration comprise — sa propre
 * description le dit, « reusing that deployment's existing build », et je l'ai
 * lue après coup. Le changement de configuration, lui, ne crée AUCUN
 * déploiement : il attend le suivant.
 *
 * Seul un déploiement NEUF DEPUIS LA SOURCE prend la configuration courante.
 * C'est ce que ce commentaire-ci déclenche en étant poussé.
 *
 * ET C'EST LA MÊME FAMILLE DE PIÈGE QUE LE RESTE DE LA JOURNÉE : la
 * configuration DISAIT `relances:production`, trois lectures le confirmaient,
 * et le produit faisait autre chose. Lire le réglage n'est pas observer l'effet.
 */
/**
 * L'HEURE QU'IL EST DANS LE FUSEAU D'UN PARC, de 0 à 23.
 *
 * `hourCycle: 'h23'` et non `hour12: false` : ce dernier rend « 24 » à minuit
 * dans certaines versions d'ICU, et un parc réglé sur 0 ne serait jamais
 * relancé — un défaut qui ne se verrait qu'une heure par jour.
 */
export function heureDansLeFuseau(quand: Date, fuseau: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: fuseau,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(quand),
  )
}

/**
 * L'HEURE DU RÉSUMÉ DU FIL, en UTC, et pourquoi elle N'EST PAS réglable.
 *
 * Le résumé appartient au COMPTE qui le reçoit, pas au parc : un gestionnaire
 * de trois parcs n'en reçoit qu'un seul, et trois réglages ne sauraient pas
 * lequel choisir. Il garde donc l'heure historique du cron quotidien.
 *
 * SANS CETTE BORNE, le passage horaire enverrait vingt-quatre résumés par jour
 * à chacun. C'est le piège exact que le passage à l'heure introduit, et il ne
 * se serait vu qu'en production, sur de vraies boîtes aux lettres.
 */
export const HEURE_DU_RESUME_UTC = 6

/**
 * EST-CE L'HEURE DU RÉSUMÉ ? Extraite pour être ÉPROUVÉE.
 *
 * Cette décision vivait en ligne dans le bloc d'exécution directe, qu'on ne
 * peut pas importer sans déclencher le parcours complet. Sa garde LISAIT donc
 * la source à la recherche d'un motif — `heureDuResume ? await envoyer…`. Une
 * garde de forme casse au premier remaniement et ne dit rien du comportement :
 * elle serait restée verte sur une borne inversée.
 */
export function estLHeureDuResume(quand: Date): boolean {
  return quand.getUTCHours() === HEURE_DU_RESUME_UTC
}

/**
 * CE QUE LE PASSAGE A FAIT, EN UNE LIGNE QUI NE MENT PAS.
 *
 * L'ancienne disait « 2 parc(s), 0 courriel(s) parti(s) ». Ce zéro couvrait
 * DEUX états sans rapport : un parc dont ce n'est pas l'heure — le cas normal
 * vingt-trois fois sur vingt-quatre — et un parc à son heure où aucun bail
 * n'atteint le jalon, qui est une information sur le parc. Rien ne les
 * séparait, et neuf passages de production ont rendu le même « 0 ».
 *
 * `parcsALHeure` et `partiraient` sont ce qui rend le zéro lisible : zéro
 * envoyé sur deux baux au jalon est une PANNE, zéro envoyé sur zéro bail est un
 * mardi ordinaire.
 */
export function compteRenduDesRelances(
  r: { parcsTraites: number; parcsALHeure: number; envoyes: number; ignores: number; partiraient: number },
  aBlanc: boolean,
): string {
  if (aBlanc) {
    return (
      `À BLANC — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsALHeure} avec relances actives, ` +
      `${r.partiraient} relance(s) PARTIRAIENT à l'heure de leur parc. ` +
      "Rien n'a été envoyé, aucune trace posée."
    )
  }
  return (
    `Relance automatique — ${r.parcsTraites} parc(s) parcouru(s), ${r.parcsALHeure} à leur heure, ` +
    `${r.partiraient} bail(s) au jalon, ${r.envoyes} courriel(s) parti(s), ${r.ignores} ignoré(s).`
  )
}

/**
 * LE RÉSUMÉ : `null` quand il n'a PAS tourné, un nombre quand il a cherché.
 *
 * L'ancienne ligne affichait « 0 envoyé » dans les deux cas. Un compte rendu
 * muet sur ce qu'il n'a pas fait se lit comme s'il l'avait fait — c'est la
 * faute que ce dépôt a déjà payée sur le mode à blanc, qui « voyait une famille
 * de courriels sur deux ».
 */
export function compteRenduDesResumes(resumes: number | null): string {
  if (resumes === null) {
    return `Résumés du fil — pas leur heure (${HEURE_DU_RESUME_UTC} h UTC), aucun parcours.`
  }
  return `Résumés du fil — ${resumes} envoyé(s).`
}

export async function executerRelancesAutomatiques(
  /**
   * À BLANC : le même parcours, la même décision, et RIEN qui parte.
   *
   * Ce passage n'a jamais tourné en production — aucun cron ne le lançait, la
   * configuration Railway l'a confirmé. Le brancher enverrait de vrais
   * courriels à de vrais locataires au premier tour, sans que personne ait pu
   * voir ce qui partirait. Le lire d'abord, c'est la différence entre décider
   * et espérer.
   *
   * IL NE POSE AUCUNE TRACE non plus. `RentReminderEmail` est la garde
   * d'idempotence quotidienne : en écrire une à blanc ferait manquer le VRAI
   * envoi du même jour, et le blanc aurait consommé le tour qu'il devait
   * seulement décrire.
   */
  options: { aBlanc?: boolean } = {},
): Promise<{
  parcsTraites: number
  /** Ceux qui ont passé LES DEUX portes : interrupteur allumé, et leur heure. */
  parcsALHeure: number
  envoyes: number
  ignores: number
  /** Ce qui SERAIT parti. Égal à `envoyes` hors du mode à blanc. */
  partiraient: number
}> {
  let partiraient = 0
  const maintenant = new Date()
  /* LA POLITIQUE VIENT DU PARC, pas de la planification. Le cron est bête : il
     passe tous les jours. Mettre le jalon dans son expression obligerait un
     propriétaire à ouvrir un tableau de bord d'hébergeur pour changer d'avis sur
     ses propres locataires. */
  const parcs = await prisma.park.findMany({
    select: {
      id: true,
      currency: true,
      autoReminders: true,
      reminderMilestoneDays: true,
      reminderHour: true,
      reminderTimeZone: true,
    },
  })

  let envoyes = 0
  let ignores = 0
  let parcsALHeure = 0

  for (const parc of parcs) {
    /* ÉTEINTE POUR CE PARC : on ne compte rien, pas même à blanc. Annoncer un
       envoi qu'un réglage interdit ferait mentir la seule lecture qui précède la
       décision. */
    if (!parc.autoReminders) continue

    /*
      CE N'EST PAS SON HEURE : on passe, et c'est tout ce que fait le cron pour
      ce parc vingt-trois fois sur vingt-quatre.

      LE BLANC, LUI, L'IGNORE. Il répond à « qu'enverrait ce parc À SON HEURE »,
      et non à « qu'enverrait-il maintenant » — sans quoi la seule lecture qui
      précède la décision rendrait zéro pour la seule raison qu'on l'a lancée à
      21 h. La ligne qu'il imprime le dit mot pour mot.
    */
    if (!options.aBlanc && heureDansLeFuseau(maintenant, parc.reminderTimeZone) !== parc.reminderHour)
      continue

    parcsALHeure += 1

    const baux = await prisma.lease.findMany({
      where: { unit: { building: { parkId: parc.id } }, status: { in: ['active', 'pending'] } },
      select: {
        id: true,
        /* `userId` : la LANGUE du destinataire vit sur son compte, et sans lui
           la relance repartait en français pour tout le monde. */
        tenant: { select: { fullName: true, email: true, userId: true } },
        charges: {
          where: { dueOn: { lt: maintenant } },
          select: { dueOn: true, rentMinor: true, payments: { select: { amountMinor: true } } },
          orderBy: { dueOn: 'asc' },
        },
      },
    })

    for (const bail of baux) {
      const { dûMinor, jours } = calculerRetard(bail, maintenant)
      if (dûMinor <= 0 || jours !== parc.reminderMilestoneDays) continue

      partiraient += 1
      if (options.aBlanc) continue

      const issue = await tenterRelanceEmailMilestone(bail, jours, dûMinor, parc.currency)
      if (issue === 'sent') envoyes += 1
      else ignores += 1
    }
  }

  return { parcsTraites: parcs.length, parcsALHeure, envoyes, ignores, partiraient }
}

/**
 * Exécution directe : `tsx src/scripts/executerRelancesAutomatiques.ts` (ou
 * son équivalent compilé). Sans cette garde, IMPORTER ce module pour éprouver
 * `executerRelancesAutomatiques` déclencherait le parcours complet — le même
 * principe que la garde de `check-i18n.mjs`.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  /* `--a-blanc` : le même parcours, et rien qui parte. `npm run relances:blanc`. */
  const aBlanc = process.argv.includes('--a-blanc')

  /*
    L'APPEL DES LOYERS PASSE EN PREMIER, ET L'ORDRE EST LE SUJET.

    Une relance se calcule sur une échéance : `calculerRetard` lit les
    `RentCharge` du bail. Reléguer l'appel après les relances ferait, le jour du
    mois où les deux tombent ensemble, relancer sur un mois pas encore appelé —
    donc rendre « 0 bail au jalon » puis créer la dette une seconde plus tard.
    Le parc attendrait l'heure suivante pour être relancé sur une échéance qui
    existait déjà.

    C'est l'inverse de la raison qui place les résumés APRÈS : eux sont une
    commodité, et un passage interrompu doit perdre la commodité. Ici, les deux
    sont des échéances, et l'une alimente l'autre.
  */
  const appels = await executerAppelDesLoyers({ aBlanc })
  console.log(compteRenduDesAppels(appels, aBlanc))

  const resultat = await executerRelancesAutomatiques({ aBlanc })
  console.log(compteRenduDesRelances(resultat, aBlanc))

  /*
    LES AVIS D'ÉCHÉANCE DE BAIL — APRÈS les relances, AVANT les résumés.

    Après les relances, parce qu'une relance porte sur de l'argent dû
    aujourd'hui et un avis d'échéance sur une décision à prendre dans un à deux
    mois : si le passage est interrompu, c'est le plus lointain qu'on perd.

    Avant les résumés, parce qu'un terme de bail n'est pas une commodité. Il
    appelle une décision, et un départ appelle une liste de gestes datés — état
    des lieux de sortie, arbitrage de caution.

    AUCUN INTERRUPTEUR DE PARC NE LES GOUVERNE, contrairement aux relances et à
    l'appel des loyers. Ces deux-là PARLENT AU LOCATAIRE et engagent de
    l'argent ; celui-ci écrit un avis dans le produit, à destination de qui
    administre le parc. Un réglage pour éteindre une information qu'on s'adresse
    à soi-même serait un réglage pour se cacher une échéance.
  */
  const avis = await executerAvisDEcheance({ aBlanc })
  console.log(compteRenduDesAvis(avis, aBlanc))

  /*
    LES RÉSUMÉS DU FIL PARTENT AU MÊME PASSAGE, et non dans un second lanceur.

    Un expéditeur que rien n'appelle est une fonctionnalité qui n'existe pas —
    ce dépôt a déjà payé exactement cela avec une table de traces écrite et
    jamais relue. Ce passage-ci est déjà périodique et déjà branché à la
    messagerie ; y accrocher les résumés ne demande rien de neuf à personne.

    APRÈS LES RELANCES, et l'ordre a une raison : une relance de loyer est une
    échéance qui court, un résumé est une commodité. Si le passage est
    interrompu, c'est la commodité qu'on perd.

    `null` PLUTÔT QUE ZÉRO quand ce n'est pas l'heure : c'est ce qui permet au
    compte rendu de dire qu'il n'a pas tourné, au lieu de rendre un « 0 envoyé »
    qu'on lit comme un parcours infructueux. À blanc, on compte toujours — une
    lecture muette serait la faute qu'on vient de corriger.
  */
  const resumes = aBlanc || estLHeureDuResume(new Date())
    ? await envoyerLesResumesDuFil({ aBlanc })
    : null
  console.log(
    aBlanc
      ? `À BLANC — ${resumes ?? 0} résumé(s) du fil PARTIRAIENT.`
      : compteRenduDesResumes(resumes),
  )

  /*
    L'EFFACEMENT DES COMPTES FERMÉS, AU MÊME PASSAGE — et pour la raison écrite
    quinze lignes plus haut : « un expéditeur que rien n'appelle est une
    fonctionnalité qui n'existe pas ». La fermeture promet un effacement à
    trente jours ; sans ce branchement, elle promettrait dans le vide.

    EN DERNIER, après les relances et les résumés. Un passage interrompu perd
    alors l'effacement, qui a trente jours devant lui, plutôt qu'une relance de
    loyer, qui a une échéance qui court.

    À BLANC, IL N'EFFACE RIEN ET NE COMPTE RIEN. Le mode à blanc existe pour
    LIRE ce qui partirait ; lui faire supprimer des comptes ferait de la lecture
    le geste le plus destructeur du produit.
  */
  if (aBlanc) {
    console.log('À BLANC — aucun compte fermé n’est effacé, et aucun n’est compté.')
  } else {
    console.log(compteRenduDEffacement(await effacerLesComptesFermes()))
  }

  /*
    LE PASSAGE SE TERMINE — et c'est le service Railway qui l'exige.

    Le pool Prisma garde des sockets ouvertes : sans `$disconnect()`, la boucle
    d'événements reste occupée et le process NE REND JAMAIS LA MAIN. Un service
    cron Railway qui ne rend pas la main reste facturé à l'heure au lieu de la
    seconde, et Railway SAUTE l'exécution suivante tant que la précédente tourne
    — mesuré : 198 Mo occupés en continu, pour un passage censé durer quelques
    secondes.

    `process.exit(0)` APRÈS le `$disconnect()`, en filet : une dépendance qui
    laisserait un handle ouvert (client HTTP, timer) ne doit pas pouvoir
    ressusciter le symptôme.
  */
  await prisma.$disconnect()
  process.exit(0)
}
