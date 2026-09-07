import { createServer } from 'node:http'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db.js'
import { installerArretPropre } from './arretPropre.js'

/**
 * LA COUCHE DU DESSOUS : UNE TRANSACTION ENGAGÉE SURVIT-ELLE AU SIGNAL ?
 *
 * Le lot précédent a mesuré que la RÉPONSE HTTP survit à la relève, et il s'est
 * fermé sur ce qu'il laissait ouvert : « ce qui reste non mesuré est donc la
 * couche du dessous — qu'une transaction Prisma engagée survive au signal. Elle
 * survit si la requête HTTP survit, puisque la seconde attend la première ;
 * mais c'est encore un raisonnement, pas une observation. »
 *
 * Le raisonnement était juste. Ce fichier l'observe — et il observe aussi OÙ IL
 * CESSE D'ÊTRE VRAI, ce qu'aucun raisonnement ne donnait.
 *
 * ═══ CE QUI EST RÉEL ICI, ET CE QUI EST UNE DOUBLURE ═══
 *
 * La TRANSACTION est réelle : `prisma.$transaction`, sur la base de test, avec
 * une écriture qu'on relit après. Le code d'arrêt est celui de la production.
 * Le SERVEUR est une doublure — l'API n'a aucune route qui dure assez longtemps
 * pour qu'on glisse un signal au milieu d'une transaction, et en inventer une
 * pour le cas reviendrait à mesurer une route qui n'existe pas.
 *
 * C'est l'inverse du fichier voisin : là-bas la doublure était la lenteur, le
 * réel était l'arrêt. Ici s'ajoute la seule chose qui manquait — l'écriture, et
 * sa relecture.
 *
 * ═══ CE QUE LA DURABILITÉ VEUT DIRE, ET POURQUOI LA RÉPONSE NE SUFFIT PAS ═══
 *
 * Un cas qui n'exigerait que le corps de la réponse laisserait passer le pire
 * scénario : une réponse « enregistré » rendue au bailleur, et rien en base.
 * C'est le mensonge que ce produit traque partout ailleurs. On RELIT donc la
 * ligne, après la fermeture.
 */

const IDENTIFIANT = 'transaction-en-vol@example.com'

/** Une transaction qui écrit, puis tient la ligne ouverte `duree` ms. */
async function ecrireLentement(duree: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.userAccount.create({
        data: {
          email: IDENTIFIANT,
          passwordHash: 'peu-importe',
          fullName: 'Écriture en vol',
          /* `termsAcceptedAt` n'a pas de valeur par défaut au schéma : c'est un
             CONSENTEMENT, et une base qui le daterait toute seule daterait un
             accord que personne n'a donné. Prisma me l'a rappelé. */
          termsAcceptedAt: new Date(),
        },
      })
      /* LA PAUSE EST DANS LA TRANSACTION, et c'est tout l'objet du cas : le
         signal doit arriver alors que la ligne est écrite mais PAS ENCORE
         validée. Une pause posée après le `commit` ne mesurerait rien. */
      await new Promise((suite) => setTimeout(suite, duree))
    },
    { timeout: 20_000 },
  )
}

beforeEach(async () => {
  await prisma.userAccount.deleteMany({ where: { email: IDENTIFIANT } })
  process.removeAllListeners('SIGTERM')
  process.removeAllListeners('SIGINT')
})

afterAll(async () => {
  await prisma.userAccount.deleteMany({ where: { email: IDENTIFIANT } })
  process.removeAllListeners('SIGTERM')
  process.removeAllListeners('SIGINT')
  await prisma.$disconnect()
})

describe('une transaction engagée survit à la relève', () => {
  it('valide son écriture, et la ligne EST en base après la fermeture', async () => {
    const journal: string[] = []
    const sorties: number[] = []

    const serveur = createServer((_, reponse) => {
      journal.push('transaction ouverte')
      void ecrireLentement(300).then(() => {
        journal.push('transaction validée')
        reponse.writeHead(200, { 'content-type': 'text/plain' })
        reponse.end('ECRIT')
      })
    })
    await new Promise<void>((pret) => serveur.listen(0, pret))
    const port = (serveur.address() as { port: number }).port

    installerArretPropre(serveur, {
      sortir: (code) => {
        journal.push(`fermeture (code ${code})`)
        sorties.push(code)
      },
      delaiDeGraceMs: 10_000,
    })

    const enVol = fetch(`http://127.0.0.1:${port}/`).then((r) => r.text())
    await new Promise<void>((ouverte) => {
      const guet = setInterval(() => {
        if (journal.includes('transaction ouverte')) {
          clearInterval(guet)
          ouverte()
        }
      }, 10)
    })

    /* Le signal tombe pendant que la transaction tient sa ligne. */
    process.emit('SIGTERM')

    expect(await enVol).toBe('ECRIT')
    await new Promise<void>((ferme) => {
      const guet = setInterval(() => {
        if (sorties.length > 0) {
          clearInterval(guet)
          ferme()
        }
      }, 10)
    })

    expect(journal).toEqual([
      'transaction ouverte',
      'transaction validée',
      'fermeture (code 0)',
    ])

    /*
      LA SEULE ASSERTION QUI PARLE DE DURABILITÉ. Les trois précédentes disent
      que le processus s'est bien conduit ; celle-ci dit que la donnée EXISTE.
      Un produit qui répondrait « enregistré » sans avoir écrit serait pire
      qu'un produit qui coupe.
    */
    const ligne = await prisma.userAccount.findUnique({ where: { email: IDENTIFIANT } })
    expect(ligne, 'la transaction a été validée mais la ligne n’est pas en base').not.toBeNull()
  }, 20_000)

  it('AVOUE par un code non nul quand la transaction dépasse le délai de grâce', async () => {
    /*
      ═══ OÙ LA GARANTIE S'ARRÊTE, ET CE QUE CE CAS PROUVE EXACTEMENT ═══

      Le délai de grâce n'est pas une politesse, c'est une BORNE. Au-delà, on
      sort de nous-mêmes plutôt que de laisser l'orchestrateur trancher sans
      rien dire — et on sort par UN, ce qui est un aveu et non un succès.

      CE QUE CE CAS NE PROUVE PAS, ET IL FAUT LE DIRE : dans ce processus de
      test, `sortir` ne tue personne, donc la transaction se termine quand même
      et la ligne finit par exister. En production, `process.exit(1)` couperait
      là — la transaction serait annulée par la base à la rupture de connexion,
      et le client aurait reçu... rien, puisque la réponse n'était pas partie.
      Ce cas mesure donc le SIGNAL de la borne, pas la perte. C'est déjà ce qui
      manquait : sans lui, « dix secondes » est un nombre que personne n'a
      jamais éprouvé.
    */
    const sorties: number[] = []
    const serveur = createServer((_, reponse) => {
      void ecrireLentement(600).then(() => {
        reponse.writeHead(200)
        reponse.end('TARD')
      })
    })
    await new Promise<void>((pret) => serveur.listen(0, pret))
    const port = (serveur.address() as { port: number }).port

    installerArretPropre(serveur, {
      sortir: (code) => sorties.push(code),
      /* Cent millisecondes : la transaction en demande six cents. La borne est
         donc franchie à coup sûr, sans faire attendre la porte. */
      delaiDeGraceMs: 100,
    })

    const enVol = fetch(`http://127.0.0.1:${port}/`).then((r) => r.text())
    await new Promise((suite) => setTimeout(suite, 50))
    process.emit('SIGTERM')

    await new Promise<void>((avoue) => {
      const guet = setInterval(() => {
        if (sorties.includes(1)) {
          clearInterval(guet)
          avoue()
        }
      }, 10)
    })
    expect(sorties[0], 'le dépassement doit sortir par UN, jamais par zéro').toBe(1)

    await enVol
    serveur.close()
  }, 20_000)
})
