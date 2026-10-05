import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../db.js'
import {
  estSonJour,
  executerAppelDesLoyers,
  jourDeclencheur,
  premierDuMoisDansLeFuseau,
} from '../scripts/executerAppelDesLoyers.js'

/**
 * L'APPEL DES LOYERS SANS QUE PERSONNE NE CLIQUE.
 *
 * ═══ CE QUE SON ABSENCE COÛTAIT, ET POURQUOI ELLE ÉTAIT MUETTE ═══
 *
 * `POST /:parkId/charges` est la route qui FABRIQUE la dette. Sans échéance, il
 * n'y a ni solde, ni retard, ni relance : le cron des relances tournait
 * au-dessus d'un mois que personne n'avait appelé, et imprimait « 0 bail au
 * jalon ». Ce zéro se lit comme un parc sain.
 *
 * ═══ CE QUE CES CAS GARDENT, ET DANS QUEL ORDRE ═══
 *
 * Le premier est le plus important et c'est celui qu'on oublie : l'interrupteur
 * naît ÉTEINT. Un appel de loyer crée de l'argent dû, et l'hériter aurait fait
 * naître des échéances sur tous les parcs existants à l'heure suivant la
 * migration. C'est le seul réglage de parc dans ce cas, donc le seul que la
 * prochaine main pourrait « harmoniser » avec les autres sans voir le prix.
 *
 * Viennent ensuite les deux bornes de date, éprouvées par FONCTION PURE et non
 * à travers la base — le `>=` ne se distingue de `===` que les jours où le
 * réglage et la date diffèrent, et un cas qui exige « la veille » rougirait le
 * 1er du mois sans qu'aucun code n'ait changé.
 *
 * ═══ CE QUE CES CAS NE COUVRENT PAS ═══
 *
 * LES MONTANTS. L'eau, le courant, le gel des lignes libres et le loyer figé à
 * l'émission sont ceux de `emettreLesAppelsDeLoyer`, que la route manuelle
 * appelle aussi et que ses propres cas tiennent déjà. Ce fichier garde QUI
 * déclenche et QUAND — exactement la portion que ce lot ajoute. Si l'appel
 * automatique et l'appel manuel divergeaient un jour sur un montant, c'est que
 * quelqu'un aurait réécrit la requête au lieu d'appeler la fonction, et le
 * dernier cas est là pour que ce reproche soit mesurable.
 *
 * L'ORDRE DANS LE CRON — l'appel avant les relances — vit dans le bloc
 * d'exécution directe d'`executerRelancesAutomatiques.ts`, qu'on ne peut pas
 * importer sans déclencher le parcours complet. Même limite que celle déjà
 * déclarée pour l'heure du résumé du fil, et même remède : la décision est
 * extraite quand elle peut l'être, et déclarée quand elle ne peut pas.
 */

beforeEach(async () => {
  await prisma.park.deleteMany()
  await prisma.userAccount.deleteMany()
})

/**
 * Un parc avec un bail actif, et AUCUNE échéance.
 *
 * Le bail démarre deux cents jours plus tôt pour que le mois courant lui soit
 * dû quel que soit le jour où la suite tourne : un bail qui commence après la
 * période ne doit rien pour elle, et c'est la route qui le refuse.
 */
async function parcSansEcheance(reglages: Record<string, unknown>) {
  const parc = await prisma.park.create({
    data: { name: 'Parc de sonde', countryCode: 'CM', currency: 'XAF', ...reglages },
  })
  const immeuble = await prisma.building.create({
    data: { parkId: parc.id, name: 'Résidence', district: 'Bastos' },
  })
  const unite = await prisma.unit.create({
    data: {
      buildingId: immeuble.id,
      label: 'A1',
      type: 'T2',
      surfaceSqm: 50,
      baseRentMinor: 100000,
    },
  })
  const locataire = await prisma.tenant.create({
    data: { parkId: parc.id, fullName: 'Paul Kamga', email: 'paul@example.com' },
  })
  const bail = await prisma.lease.create({
    data: {
      unitId: unite.id,
      tenantId: locataire.id,
      startsOn: new Date(Date.now() - 200 * 86_400_000),
      rentMinor: 100000,
      status: 'active',
    },
  })
  return { parc, bail }
}

describe('l’interrupteur du parc', () => {
  it('N’APPELLE RIEN sur un parc qui n’a rien réglé', async () => {
    /*
      LE CAS QUI PORTE LA DÉCISION DU LOT. `autoRentCall` vaut `false` au
      schéma, et c'est le seul interrupteur de parc dans ce cas : une relance
      RAPPELLE une dette, un appel la CRÉE.

      Le parc est créé SANS mentionner le réglage — comme l'a fait chaque parc
      existant avant cette migration. Passer `autoRentCall: false`
      explicitement garderait la boucle du cron et non le DÉFAUT, qui est la
      seule chose que la migration décide.
    */
    const { bail } = await parcSansEcheance({})
    const resultat = await executerAppelDesLoyers()
    expect(resultat.parcsAllumes, 'aucun parc n’est compté comme allumé').toBe(0)
    expect(resultat.emises).toBe(0)
    expect(await prisma.rentCharge.count({ where: { leaseId: bail.id } })).toBe(0)
  })

  it('appelle le mois courant quand il est allumé', async () => {
    const { bail } = await parcSansEcheance({ autoRentCall: true, rentCallDayOfMonth: 1 })
    const resultat = await executerAppelDesLoyers()
    expect(resultat.emises).toBe(1)
    const echeances = await prisma.rentCharge.findMany({ where: { leaseId: bail.id } })
    expect(echeances).toHaveLength(1)
    expect(echeances[0]?.rentMinor, 'le loyer du BAIL, figé à l’émission').toBe(100000)
    expect(
      +(echeances[0]?.periodStart ?? 0),
      'la période est le premier du mois courant',
    ).toBe(+premierDuMoisDansLeFuseau(new Date(), 'UTC'))
  })

  it('ne double PAS un mois déjà appelé', async () => {
    /* C'est cette propriété qui autorise le passage HORAIRE à n'avoir aucune
       borne d'heure, et c'est elle que l'aide de l'écran promet au
       propriétaire au moment de cocher la case. */
    const { bail } = await parcSansEcheance({ autoRentCall: true, rentCallDayOfMonth: 1 })
    expect((await executerAppelDesLoyers()).emises).toBe(1)
    expect((await executerAppelDesLoyers()).emises, 'le second passage n’émet rien').toBe(0)
    expect(await prisma.rentCharge.count({ where: { leaseId: bail.id } })).toBe(1)
  })
})

describe('la borne du jour', () => {
  it('appelle encore APRÈS son jour, et non le seul jour dit', () => {
    /*
      LA GARDE DU `>=`, ET ELLE EST LE SUJET DE CE LOT AUTANT QUE
      L'INTERRUPTEUR.

      Avec `===`, un parc réglé au 3 dont le cron n'a pas tourné le 3 n'aurait
      plus aucune occasion avant le mois suivant — et ce dépôt a mesuré les
      trois causes : un déploiement, une panne, et une porte rouge qui a gelé
      l'hébergeur quarante-cinq minutes. Trente jours sans échéance, donc sans
      relance, et rien à l'écran pour le dire.
    */
    expect(estSonJour(3, new Date('2026-02-03T08:00:00Z'), 'UTC'), 'le jour dit').toBe(true)
    expect(estSonJour(3, new Date('2026-02-15T08:00:00Z'), 'UTC'), 'douze jours après').toBe(
      true,
    )
    expect(estSonJour(3, new Date('2026-02-02T08:00:00Z'), 'UTC'), 'la veille').toBe(false)
  })

  it('n’éteint PAS février pour un réglage au 31', () => {
    /*
      Un parc réglé au 31 ne serait jamais appelé en février, avril, juin,
      septembre ni novembre : le mois n'atteint pas 31, la comparaison ne
      devient jamais vraie, et cinq mois sur douze passeraient sans qu'une
      ligne de journal le dise.

      La garde en zod refuse désormais tout réglage au-dessus de 28 ; cette
      borne-ci est le second rempart, parce que la colonne est un `Int` sans
      contrainte et qu'une valeur hors bornes peut venir d'une écriture directe
      en base.
    */
    expect(jourDeclencheur(31, new Date(Date.UTC(2026, 1, 1))), 'février 2026').toBe(28)
    expect(jourDeclencheur(31, new Date(Date.UTC(2024, 1, 1))), 'février bissextile').toBe(29)
    expect(jourDeclencheur(31, new Date(Date.UTC(2026, 3, 1))), 'avril').toBe(30)
    expect(jourDeclencheur(31, new Date(Date.UTC(2026, 0, 1))), 'janvier, intact').toBe(31)
    expect(estSonJour(31, new Date('2026-02-28T08:00:00Z'), 'UTC'), 'le 28 février part').toBe(
      true,
    )
    /* Un 0 ou un négatif en base n'appellerait jamais, ou appellerait tous les
       jours selon le sens de la comparaison. */
    expect(jourDeclencheur(0, new Date(Date.UTC(2026, 1, 1))), 'un zéro remonte à 1').toBe(1)
  })

  it('lit le mois dans le FUSEAU du parc, et non en UTC', () => {
    /*
      Le 1er mars à 00 h 30 à Douala, il est encore le 28 février en UTC. Lire
      le mois en UTC appellerait février une seconde fois — sans effet grâce à
      l'unicité — mais mars ne partirait pas ce jour-là, et le parc attendrait
      le passage suivant.

      Le fuseau est celui de qui REÇOIT : ce produit a en production un parc qui
      porte `FR` et loue à Yaoundé.
    */
    const auBordDuMois = new Date('2026-03-01T00:30:00+01:00')
    expect(+premierDuMoisDansLeFuseau(auBordDuMois, 'Africa/Douala')).toBe(
      +new Date(Date.UTC(2026, 2, 1)),
    )
    expect(
      +premierDuMoisDansLeFuseau(auBordDuMois, 'UTC'),
      'en UTC, c’est encore février — et c’est le défaut qu’on évite',
    ).toBe(+new Date(Date.UTC(2026, 1, 1)))
  })
})

describe('le mode à blanc', () => {
  it('compte ce qui partirait, et n’écrit RIEN', async () => {
    /*
      Ce passage crée de l'argent dû. Le brancher sans pouvoir lire d'abord ce
      qu'il émettrait serait espérer, pas décider — et le mode à blanc des
      relances a déjà servi exactement à cela avant leur premier envoi réel.
    */
    const { bail } = await parcSansEcheance({ autoRentCall: true, rentCallDayOfMonth: 1 })
    const resultat = await executerAppelDesLoyers({ aBlanc: true })
    expect(resultat.emises, 'il annonce l’échéance').toBe(1)
    expect(
      await prisma.rentCharge.count({ where: { leaseId: bail.id } }),
      'et il n’en a écrit aucune',
    ).toBe(0)
  })

  it('ignore la borne du jour, pour répondre à la bonne question', async () => {
    /*
      Le blanc répond à « qu'émettrait ce parc À SON JOUR », et non à
      « qu'émettrait-il maintenant ». Sans cela, la seule lecture qui précède la
      décision de brancher rendrait zéro pour la seule raison qu'on l'a lancée
      le 2 — et c'est la faute que ce dépôt a déjà payée sur le blanc des
      relances, qui « voyait une famille de courriels sur deux ».

      Le réglage est pris à 28 : c'est le seul jour dont on sait qu'il n'est
      jamais dépassé, donc le seul qui rende ce cas vrai tous les jours du mois
      sauf le dernier — et au dernier, la borne est satisfaite de toute façon,
      si bien que le cas ne peut pas rougir sur un calendrier.
    */
    await parcSansEcheance({ autoRentCall: true, rentCallDayOfMonth: 28 })
    expect((await executerAppelDesLoyers({ aBlanc: true })).emises).toBe(1)
  })
})

describe('la trace', () => {
  it('pose un acte SYSTÈME au registre, sans acteur et sans compte supprimé', async () => {
    /*
      TROISIÈME NATURE D'AUTEUR, et c'est ce lot qui la crée. `AuditEvent` ne
      savait dire que deux choses : un compte, ou un compte effacé dont le nom
      est conservé. Un acteur nul se lisait donc « Compte supprimé » à l'écran
      du registre — faux ici : aucun compte n'a jamais existé derrière cette
      ligne, le parc a un réglage allumé.

      LA CHARGE PORTE `source: 'auto'`, et c'est de là que l'écran tire sa
      troisième réponse. Ce cas est aussi ce qui rend fiable la lecture faite
      par le serveur : `payload` est du JSON libre, et la seule chose qui en
      garantisse le sens est que `emettreLesAppelsDeLoyer` soit le seul endroit
      qui l'écrive.
    */
    const { parc } = await parcSansEcheance({ autoRentCall: true, rentCallDayOfMonth: 1 })
    await executerAppelDesLoyers()
    const actes = await prisma.auditEvent.findMany({ where: { parkId: parc.id } })
    expect(actes).toHaveLength(1)
    expect(actes[0]?.action, 'le MÊME nom d’acte que l’appel manuel').toBe('rent.call')
    expect(actes[0]?.actorId, 'personne n’a cliqué').toBeNull()
    expect(actes[0]?.actorName, 'et aucun nom n’est conservé — il n’y en a jamais eu').toBeNull()
    expect((actes[0]?.payload as { source?: string })?.source).toBe('auto')
  })

  it('ne marque PAS un appel manuel comme automatique', async () => {
    /*
      L'ABSENCE DE LA CLÉ EST LE SIGNAL. Écrire `source: 'user'` sur un appel
      manuel aurait fait croire à une information : les charges d'avant ce lot
      ne la portent pas, et elles sont manuelles. Une clé absente et une clé à
      `'user'` diraient donc la même chose, la seconde en coûtant une lecture.
    */
    const { parc } = await parcSansEcheance({})
    const compte = await prisma.userAccount.create({
      data: {
        email: 'proprio@example.com',
        passwordHash: 'x',
        fullName: 'Awa Diallo',
        /* OBLIGATOIRE AU SCHÉMA : aucun compte n'existe sans avoir accepté les
           conditions, et c'est une garde du produit et non une formalité de
           fixture. */
        legalConfirmedAt: new Date(),
        legalConfirmation: 'acceptedTermsReadPrivacy',
      },
    })
    const { emettreLesAppelsDeLoyer } = await import('./routes.js')
    await emettreLesAppelsDeLoyer({
      parkId: parc.id,
      debut: premierDuMoisDansLeFuseau(new Date(), 'UTC'),
      perimetreUnite: {},
      acteurId: compte.id,
    })
    const actes = await prisma.auditEvent.findMany({ where: { parkId: parc.id } })
    expect(actes).toHaveLength(1)
    expect(actes[0]?.actorId).toBe(compte.id)
    expect(
      (actes[0]?.payload as { source?: string })?.source,
      'aucune source déclarée sur un acte cliqué',
    ).toBeUndefined()
  })
})
