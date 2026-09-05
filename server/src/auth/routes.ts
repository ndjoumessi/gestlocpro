import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { creerJeton, empreinteJeton } from './token.js'
import { env } from '../env.js'
import { laMessagerie } from '../messagerie/messagerie.js'
import {
  consignerLeRattachement,
  normaliserCode,
  rattacherLaFicheLocataire,
} from '../parks/invitations.js'
import { Prisma } from '../generated/prisma/client.js'
import type { ParkRole } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { hashPassword, needsRehash, verifyPassword } from './password.js'
import { fermerSession, lireSession, ouvrirSession } from './session.js'
import { semerParcDemonstration } from '../parks/demo.js'
import { Currency } from '../generated/prisma/client.js'

export const authRouter = Router()

/**
 * Devise de tenue des comptes, déduite du pays.
 *
 * `CFA` du client n'est pas un code ISO 4217 — le code client le dit lui-même —
 * et il n'existe pas de code commun aux zones CEMAC et UEMOA. Le stockage
 * tranche donc, et l'affichage les réunit sous « FCFA ». Le pays suffit à
 * retrouver laquelle des deux s'applique, ce qui est précisément l'argument
 * avancé le jour où les deux codes ont été fusionnés côté client.
 */
const UEMOA = new Set(['SN', 'CI', 'BJ', 'BF', 'ML', 'NE', 'TG', 'GW'])
const CEMAC = new Set(['CM', 'GA', 'CG', 'TD', 'CF', 'GQ'])

/* EXPORTÉE POUR LE RELEVÉ DES DEVISES INCOHÉRENTES, et non recopiée là-bas :
   deux tables pays→devise vieilliraient séparément, et c'est exactement le
   défaut que ce relevé sert à trouver. */
export function deviseDuPays(code: string | undefined): Currency {
  if (!code) return Currency.XAF
  if (CEMAC.has(code)) return Currency.XAF
  if (UEMOA.has(code)) return Currency.XOF
  if (code === 'CA') return Currency.CAD
  if (code === 'US') return Currency.USD
  return Currency.EUR
}

/**
 * L'e-mail est normalisé **à l'entrée**, à un seul endroit.
 *
 * « Sarah@… » et « sarah@… » sont la même personne. La règle pourrait vivre
 * dans un index fonctionnel côté base — c'est ce que j'avais fait, et c'était
 * une erreur : le schéma déclare `@unique` sur la colonne, donc Prisma y aurait
 * vu une dérive permanente. Un seul endroit, ici.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse e-mail invalide')
  .max(320)

/**
 * Longueur minimale, et rien d'autre.
 *
 * Pas de règle de composition — majuscule, chiffre, caractère spécial. Elles
 * réduisent l'espace de recherche au lieu de l'agrandir, et poussent à
 * « Password1! ». La longueur est ce qui compte, le NIST le dit depuis 2017.
 */
const motDePasse = z.string().min(10, 'Au moins 10 caractères').max(200)

const schemaInscription = z.object({
  email,
  password: motDePasse,
  fullName: z.string().trim().min(2, 'Au moins 2 caractères').max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Numéro attendu au format international, par exemple +237677214408')
    .optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  /**
   * L'acceptation doit être explicite : `true` littéral, pas « présent donc
   * vrai ». C'est la première chose à conserver juridiquement, avec sa date, et
   * le client la collecte déjà sans que rien ne l'enregistre.
   */
  acceptTerms: z.literal(true),
  newsletterOptIn: z.boolean().default(false),
  /**
   * Nom du parc, collecté à l'étape « Votre contexte » de l'assistant et jeté
   * jusqu'ici. Absent pour un gestionnaire ou un locataire, qui rejoignent le
   * parc de quelqu'un d'autre.
   */
  parkName: z.string().trim().min(2).max(120).optional(),
  /**
   * Code d'invitation, pour rejoindre le parc de quelqu'un d'autre.
   *
   * Exclusif de `parkName` : on fonde un parc OU on en rejoint un. Les deux
   * ensemble n'ont pas de sens, et laisser passer la combinaison créerait un
   * propriétaire d'un parc vide qui est aussi locataire ailleurs — un état que
   * rien dans l'interface ne sait montrer.
   */
  invitationCode: z.string().trim().min(4).max(40).optional(),
  /**
   * Semer le parc de démonstration.
   *
   * Un parc vide est l'état exact d'un compte qui vient d'être créé, et tous
   * les écrans savent l'afficher. Mais le produit se démontre, et un
   * propriétaire qui découvre douze écrans vides n'apprend rien de ce qu'ils
   * font. Le choix est donc explicite et porté par l'appelant, plutôt que caché
   * dans le serveur.
   */
  seedDemo: z.boolean().default(false),
})

const schemaConnexion = z.object({
  email,
  // Pas de contrainte de longueur ici : refuser un mot de passe trop court à la
  // connexion renseignerait sur la politique en vigueur lors de l'inscription.
  password: z.string().min(1),
  /**
   * « Rester connecté sur cet appareil ».
   *
   * `z.boolean()` et non une coercition : `"false"` est VRAI en JavaScript, et
   * un client qui sérialiserait la case en chaîne obtiendrait trente jours à
   * l'instant précis où son utilisateur demande le contraire. Un champ mal
   * formé est refusé, jamais deviné.
   *
   * Optionnel, et le défaut vaut `true` : les paquets déjà installés — la
   * version applicative sur les téléphones garde son ancien code un moment —
   * n'envoient pas ce champ, et les raccourcir en silence serait le seul effet
   * de ce lot qu'ils constateraient.
   */
  persistent: z.boolean().optional(),
})

function contexte(req: Request) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip ?? undefined,
  }
}

/** Ce que le client reçoit d'un compte. Jamais l'empreinte du mot de passe. */
function vueCompte(u: {
  id: string
  email: string
  fullName: string
  locale: string
  countryCode: string | null
  phoneE164: string | null
  threadEmailOptIn?: boolean
  threadEmailDigest?: boolean
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    locale: u.locale,
    countryCode: u.countryCode,
    phoneE164: u.phoneE164,
    /* Le réglage voyage avec le compte : l'écran qui le bascule doit d'abord
       pouvoir l'afficher, et une case posée à faux par défaut d'information
       ferait croire à un désabonnement que personne n'a demandé. */
    threadEmailOptIn: u.threadEmailOptIn ?? true,
    threadEmailDigest: u.threadEmailDigest ?? false,
  }
}

/**
 * Le code a été consommé entre sa vérification et son marquage.
 *
 * Une classe plutôt qu'un drapeau : elle est LEVÉE dans la transaction, ce qui
 * l'annule — c'est la levée elle-même qui défait le compte, et un booléen posé
 * après coup ne l'aurait pas fait.
 */
class CodeDejaConsomme extends Error {}

/**
 * L'adresse était déjà prise.
 *
 * Une sentinelle plutôt qu'un `catch` sur toute la transaction. Le premier jet
 * enveloppait l'ensemble et traduisait TOUT P2002 en `email_taken` : le jour où
 * une contrainte d'unicité s'ajoute dans cette transaction — sur l'adhésion,
 * sur une ligne du semis — le diagnostic aurait menti sans que rien ne le
 * signale. Filtrer sur la colonne fautive n'était pas une option : sous
 * l'adaptateur `pg`, Prisma 7 ne renseigne plus `meta.target` mais un
 * `meta.driverAdapterError.cause.constraint.fields` propre à l'adaptateur, non
 * typé et sujet à changer. On lève donc à l'endroit exact où l'on sait ce que
 * l'échec veut dire, et tout autre P2002 continue de remonter en 500 — ce qui
 * est le comportement juste pour un défaut qu'on n'a pas prévu.
 */
class AdresseDejaPrise extends Error {}

authRouter.post('/signup', async (req: Request, res: Response) => {
  const donnees = schemaInscription.parse(req.body)

  /**
   * L'INVITATION EST EXAMINÉE AVANT QUE RIEN NE SOIT ÉCRIT.
   *
   * Elle l'était après, et le refus ne défaisait rien : `userAccount.create`
   * s'exécutait le premier, inconditionnellement, puis le `return` du 400
   * laissait derrière lui un compte réel, avec son empreinte de mot de passe et
   * sans aucun parc. Trois conséquences, dont la deuxième est celle qui mord :
   *
   *  1. Le commentaire de ce handler promettait exactement l'inverse — « les
   *     créer séparément laisserait, au moindre échec, un compte sans parc ».
   *     La promesse tenait pour le couple parc/adhésion et pas pour le compte,
   *     qui est pourtant ce que la phrase nomme.
   *
   *  2. L'ADRESSE ÉTAIT PRISE. Qui saisit son code de travers reçoit 400,
   *     corrige, réessaie — et reçoit 409 `email_taken`. Il ne peut plus
   *     s'inscrire avec sa propre adresse alors que son code est valide, et
   *     rien ne lui dira de se connecter plutôt que de s'inscrire, puisque de
   *     son point de vue aucun compte n'a jamais été créé.
   *
   *  3. Un code INVENTÉ suffisait alors à occuper l'adresse de quelqu'un —
   *     avant même qu'il ait reçu son invitation.
   *
   * Le défaut s'est vu en faisant le ménage d'un parc de sonde : quatre comptes
   * y traînaient là où deux inscriptions avaient réussi. Les deux autres étaient
   * les traces de deux refus.
   */
  let invitation: {
    id: string
    parkId: string
    role: ParkRole
    // L'ACTEUR d'un rattachement consigné : voir `consignerLeRattachement`.
    issuedById: string
  } | null = null

  if (donnees.invitationCode) {
    const trouvee = await prisma.invitation.findUnique({
      where: { codeHash: empreinteJeton(normaliserCode(donnees.invitationCode)) },
      select: {
        id: true,
        parkId: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        issuedById: true,
      },
    })

    /**
     * Un code invalide, expiré, révoqué ou déjà accepté rend le MÊME refus. Les
     * distinguer dirait à qui essaie des codes au hasard lesquels ont existé.
     */
    const utilisable =
      trouvee && !trouvee.acceptedAt && !trouvee.revokedAt && trouvee.expiresAt > new Date()
    if (!utilisable) {
      res.status(400).json({ error: 'invitation_invalid' })
      return
    }

    invitation = {
      id: trouvee.id,
      parkId: trouvee.parkId,
      role: trouvee.role,
      issuedById: trouvee.issuedById,
    }
  }

  // Le hachage AVANT la transaction, et délibérément : il est lent par
  // construction, et le tenir à l'intérieur immobiliserait une connexion et
  // rapprocherait du délai au bout duquel Prisma annule la transaction.
  const passwordHash = await hashPassword(donnees.password)

  const aujourdhui = new Date()
  // En UTC : une colonne `date` est tronquée en UTC, et un premier du mois
  // construit en heure locale s'y enregistre comme le dernier du mois d'avant.
  const periode = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 1))

  /**
   * Le compte, son parc ou son adhésion : UNE transaction, ou rien.
   *
   * C'est ce que le commentaire d'origine décrivait, étendu à ce qu'il
   * nommait. Tout échec — e-mail déjà pris, code consommé entre-temps, semis
   * de démonstration interrompu — laisse la base exactement comme il l'a
   * trouvée, et l'appelant peut réessayer avec la même adresse.
   */
  const compte = await prisma
    .$transaction(async (tx) => {
      const cree = await tx.userAccount
        .create({
          data: {
            email: donnees.email,
            passwordHash,
            fullName: donnees.fullName,
            phoneE164: donnees.phoneE164 ?? null,
            countryCode: donnees.countryCode ?? null,
            locale: donnees.locale,
            termsAcceptedAt: new Date(),
            newsletterOptIn: donnees.newsletterOptIn,
          },
        })
        .catch((err: unknown) => {
          // P2002 ICI ne peut vouloir dire qu'une chose : l'unique contrainte
          // d'unicité de la table porte sur l'adresse. La levée traverse la
          // transaction et l'annule, ce qu'un `return null` n'aurait pas fait.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new AdresseDejaPrise()
          }
          throw err
        })

      /**
       * Rejoindre un parc par invitation, exclusif de la création d'un parc. Le
       * rôle vient de l'invitation, jamais de la saisie : quelqu'un qui poste
       * `role: 'owner'` n'obtient rien de plus que ce que le propriétaire lui a
       * accordé.
       */
      if (invitation) {
        await tx.membership.create({
          data: {
            userId: cree.id,
            parkId: invitation.parkId,
            role: invitation.role,
            /*
              CELLE-CI NAÎT DÉCLARÉE, et c'est tout le lot.

              Un gestionnaire qui arrive ne voit RIEN tant qu'on ne lui a rien
              confié. Le sens inverse — vide vaut tout le parc — n'était juste
              que pour les adhésions antérieures à la fonctionnalité, qu'il
              aurait fallu aveugler pour l'appliquer. Elles gardent
              `wholePark` ; celles-ci commencent à zéro.

              Le rôle ne change rien pour un locataire ou un propriétaire : leur
              périmètre ne se lit pas là.
            */
            scope: 'declared',
          },
        })

        /**
         * Le marquage tranche la COURSE, et il est ici plutôt que dans la
         * lecture qui précède : entre les deux, une autre inscription peut
         * avoir consommé le même code. `updateMany` n'écrit que si
         * `acceptedAt` est encore nul, et un compteur à zéro fait échouer la
         * transaction entière — donc le compte avec elle. Deux inscriptions
         * simultanées avec le même code ne peuvent plus produire deux
         * adhésions, ni un compte pour le perdant.
         */
        const { count } = await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null },
          data: { acceptedAt: new Date() },
        })
        if (count === 0) throw new CodeDejaConsomme()

        /* L'ADHÉSION NE SUFFIT PAS : elle dit que la personne appartient au
           parc, pas QUI elle y est. Tout ce qu'un locataire voit passe par
           `tenant: { userId }`, et sans ce rattachement il entre dans un espace
           vide — voir `rattacherLaFicheLocataire`. DANS la transaction : un
           compte créé sans sa fiche est exactement le défaut qu'on répare. */
        await rattacherLaFicheLocataire(tx, { invitationId: invitation.id, userId: cree.id })
      } else if (donnees.parkName) {
        const park = await tx.park.create({
          data: {
            name: donnees.parkName,
            countryCode: donnees.countryCode ?? 'CM',
            // La devise appartient au parc, pas à la session : un loyer de
            // Douala est en francs CFA quelle que soit la langue de qui le
            // regarde.
            currency: deviseDuPays(donnees.countryCode),
            memberships: { create: { userId: cree.id, role: 'owner' } },
          },
        })

        if (donnees.seedDemo) {
          await semerParcDemonstration(tx, {
            parkId: park.id,
            proprietaireId: cree.id,
            periode,
            aujourdhui,
          })
        }
      }

      return cree
    }, {
      /**
       * Le semis de démonstration écrit plusieurs centaines de lignes, et il
       * vit désormais dans la même transaction que le compte. Le délai par
       * défaut de Prisma est de cinq secondes : le tenir ici évite qu'une
       * machine lente transforme une inscription valide en compte perdu.
       */
      timeout: 20_000,
    })
    .catch((err: unknown) => {
      // Seules les DEUX sentinelles sont traduites. Tout le reste remonte, et
      // c'est voulu : un échec qu'on n'a pas nommé ne doit pas emprunter le
      // message d'un échec qu'on connaît.
      if (err instanceof AdresseDejaPrise) return null
      if (err instanceof CodeDejaConsomme) return err
      throw err
    })

  if (compte === null) {
    res.status(409).json({ error: 'email_taken' })
    return
  }
  if (compte instanceof CodeDejaConsomme) {
    res.status(400).json({ error: 'invitation_invalid' })
    return
  }


  /**
   * LE RATTACHEMENT DE FICHE SE CONSIGNE, comme sur les trois chemins de
   * `/api/join` — voir `consignerLeRattachement`.
   *
   * RELU PLUTÔT QUE RENDU PAR LA TRANSACTION, et c'est un choix de prudence
   * assumé : la valeur de retour de ce `$transaction` porte DEUX sentinelles
   * d'erreur — `compte === null` pour l'adresse prise, `CodeDejaConsomme` pour
   * le code brûlé — que les deux gardes ci-dessus interrogent. En changer la
   * forme pour y glisser un identifiant de fiche toucherait le chemin de
   * création de compte pour un besoin de journal. Une lecture de plus le coûte
   * moins cher.
   *
   * LE COMPTE VIENT DE NAÎTRE : une fiche portant son identifiant ne peut avoir
   * été reliée que par l'appel qui précède.
   */
  if (invitation) {
    const fiche = await prisma.tenant.findFirst({
      where: { userId: compte.id },
      select: { id: true },
    })
    if (fiche)
      await consignerLeRattachement({
        parkId: invitation.parkId,
        actorId: invitation.issuedById,
        tenantId: fiche.id,
        userId: compte.id,
      })
  }

  await ouvrirSession(res, compte.id, contexte(req))
  res.status(201).json({ user: vueCompte(compte) })
})

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email: adresse, password, persistent } = schemaConnexion.parse(req.body)

  const compte = await prisma.userAccount.findUnique({ where: { email: adresse } })

  /**
   * Une seule réponse pour « compte inconnu » et « mot de passe faux ».
   *
   * Les distinguer transforme le formulaire de connexion en oracle d'existence
   * de comptes — utile pour cibler du hameçonnage, et suffisant pour établir
   * qu'une adresse est cliente du produit.
   *
   * Le hachage est exécuté **même quand le compte n'existe pas**, contre une
   * empreinte factice. Sans cela, une adresse inconnue répondrait en une
   * milliseconde et une adresse connue en cent : le temps de réponse rétablit
   * l'oracle que le message uniforme prétendait fermer.
   */
  const empreinte =
    compte?.passwordHash ??
    'scrypt$65536$8$1$Y29tcHRlLWluZXhpc3RhbnQ$Y2V0dGUtZW1wcmVpbnRlLW5lLWNvcnJlc3BvbmQtYS1yaWVu'
  const correct = await verifyPassword(password, empreinte)

  if (!compte || !correct || compte.disabledAt) {
    res.status(401).json({ error: 'invalid_credentials' })
    return
  }

  // Le seul instant où le mot de passe en clair est disponible : si les
  // paramètres de hachage ont été relevés depuis, on en profite. Sans cela, le
  // relèvement ne protégerait que les comptes créés après.
  if (needsRehash(compte.passwordHash)) {
    await prisma.userAccount.update({
      where: { id: compte.id },
      data: { passwordHash: await hashPassword(password) },
    })
  }

  await ouvrirSession(res, compte.id, { ...contexte(req), persistante: persistent ?? true })
  res.json({ user: vueCompte(compte) })
})

authRouter.post('/logout', async (req: Request, res: Response) => {
  await fermerSession(req, res)
  // 204 et non 401 quand il n'y avait pas de session : se déconnecter deux fois
  // n'est pas une erreur, et l'appelant n'a rien à corriger.
  res.sendStatus(204)
})

authRouter.get('/me', async (req: Request, res: Response) => {
  const session = await lireSession(req)
  if (!session) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, status: 'active' },
    select: {
      parkId: true,
      role: true,
      /* `delegation` voyage avec l'adhésion, et non seulement dans `/parks` :
         c'est elle qui décide si l'écran propose de recruter un gestionnaire, et
         cet écran est monté bien avant qu'on ait listé les parcs. */
      park: {
        select: {
          name: true,
          currency: true,
          countryCode: true,
          delegation: true,
          /* Les relances se règlent dans la modale du parc, qui lit l'adhésion
             active : sans eux, elle proposerait des défauts inventés. */
          autoReminders: true,
          reminderMilestoneDays: true,
          reminderHour: true,
          reminderTimeZone: true,
        },
      },
    },
  })

  res.json({
    user: vueCompte(session.user),
    // Les rôles viennent du serveur et ne sont jamais transmis par le client :
    // c'est ce qui remplace le sélecteur de profil, qui reste disponible en
    // démonstration mais ne décide plus de rien.
    memberships: memberships.map((m) => ({
      parkId: m.parkId,
      role: m.role,
      parkName: m.park.name,
      currency: m.park.currency,
      /**
       * Le pays du parc, stocké depuis l'origine et rendu nulle part.
       *
       * L'écran qui le corrige doit d'abord pouvoir l'afficher : une modale
       * ouverte sur un champ vide ferait reposer « France » une seconde fois
       * sans que rien ne signale qu'elle y était déjà.
       */
      countryCode: m.park.countryCode,
      delegation: m.park.delegation,
      autoReminders: m.park.autoReminders,
      reminderMilestoneDays: m.park.reminderMilestoneDays,
      reminderHour: m.park.reminderHour,
      reminderTimeZone: m.park.reminderTimeZone,
    })),
  })
})

/**
 * LE RÉGLAGE DES COPIES E-MAIL, et rien d'autre pour l'instant.
 *
 * Une route de préférences par personne. Elle ne touche ni au nom, ni à
 * l'adresse, ni au mot de passe : chacun de ces trois a ses propres
 * conséquences — une adresse change l'identifiant de connexion, un mot de passe
 * exige l'ancien — et les mêler ici ferait d'un basculement de case le voisin
 * d'un changement d'identité.
 */
const schemaPreferences = z
  .object({
    threadEmailOptIn: z.boolean().optional(),
    /** Grouper les copies en un résumé. Voir `threadEmailDigest` au schéma. */
    threadEmailDigest: z.boolean().optional(),
  })
  .refine((v) => v.threadEmailOptIn !== undefined || v.threadEmailDigest !== undefined, {
    message: 'Rien à régler',
  })

authRouter.patch('/me', async (req: Request, res: Response) => {
  const session = await lireSession(req)
  if (!session) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  const analyse = schemaPreferences.safeParse(req.body)
  if (!analyse.success) {
    res.status(400).json({ error: 'invalid_body' })
    return
  }
  const compte = await prisma.userAccount.update({
    where: { id: session.userId },
    data: {
      ...(analyse.data.threadEmailOptIn !== undefined
        ? { threadEmailOptIn: analyse.data.threadEmailOptIn }
        : {}),
      ...(analyse.data.threadEmailDigest !== undefined
        ? {
            threadEmailDigest: analyse.data.threadEmailDigest,
            /*
              LE CHOIX POSE LA BORNE.

              `lastThreadDigestAt` nul voulait dire « aucune borne », donc « tout
              ce que ce compte a jamais reçu ». Quelqu'un qui coche le réglage un
              mardi recevait six mois d'échanges le lendemain — dont il avait déjà
              lu chaque ligne dans le produit, puisqu'il les recevait en copie
              immédiate jusque-là.

              Cocher veut dire « résume-moi ce qui VIENDRA », pas « raconte-moi ce
              qui fut ». On stampe donc l'instant du choix.

              À CHAQUE BASCULE, y compris quand on décoche : rallumer six mois
              plus tard ne doit pas déterrer l'intervalle qu'on a passé sans
              résumé — on n'en voulait pas.
            */
            lastThreadDigestAt: new Date(),
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      locale: true,
      countryCode: true,
      phoneE164: true,
      threadEmailOptIn: true,
      threadEmailDigest: true,
    },
  })
  res.json({ user: vueCompte(compte) })
})

/**
 * Durée de vie d'un lien de réinitialisation : une heure.
 *
 * Bien plus court que les quatorze jours d'un code d'invitation, et pour une
 * raison de nature différente : le code d'invitation est transmis de la main à
 * la main par quelqu'un qui l'a demandé, le lien de réinitialisation dort dans
 * une boîte aux lettres. Tant qu'il est valable, il EST le compte — il ouvre
 * sans mot de passe. Une heure suffit à qui vient de le demander, et réduit
 * d'autant la fenêtre pour qui lira cette boîte plus tard.
 */
const DUREE_REINITIALISATION_MS = 60 * 60 * 1000

/**
 * Le message de réinitialisation, dans ses deux corps.
 *
 * LE LIEN VIT DANS UN ATTRIBUT, et c'est tout l'objet de cette fonction. La
 * première version n'avait qu'un corps texte : le lien y occupait une ligne de
 * 112 caractères, et il est arrivé mutilé dans le navigateur — l'écran a rendu
 * « lien expiré » sans qu'aucune requête ne parte. Repli de ligne d'un client
 * de messagerie, encodage, auto-détection qui décide seule où une URL finit :
 * la cause exacte n'a pas été établie, et c'est justement pourquoi le correctif
 * ne vise aucune d'elles en particulier. Un `href` ne se coupe pas.
 *
 * Le HTML est délibérément pauvre — pas d'image, pas de fichier de style, rien
 * qu'un paragraphe et un lien. Un courriel qui exige de charger des ressources
 * distantes se fait bloquer par la moitié des clients, et un message de
 * sécurité qui s'affiche en pièces détachées inspire exactement la méfiance
 * qu'il faudrait éviter ici.
 *
 * La version texte reste jointe, et porte le même lien : elle n'est plus la
 * seule chance de l'utilisateur, seulement la dernière.
 */
export function corpsDeReinitialisation(nom: string, lien: string): { texte: string; html: string } {
  const texte =
    `Bonjour ${nom},\n\n` +
    `Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable une heure :\n\n` +
    `${lien}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.`

  /**
   * Le nom est ÉCHAPPÉ, le lien ne l'est pas.
   *
   * Le nom vient de l'inscription : c'est une chaîne choisie par un
   * utilisateur, donc à traiter comme hostile — un `fullName` contenant une
   * balise s'exécuterait chez le destinataire. Le lien, lui, est fabriqué ici à
   * partir d'un jeton tiré au hasard en base64url et d'une origine de
   * configuration : rien n'y vient de l'extérieur.
   */
  const html =
    `<p>Bonjour ${echapper(nom)},</p>` +
    `<p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable une heure.</p>` +
    `<p><a href="${lien}">Choisir un nouveau mot de passe</a></p>` +
    `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>`

  return { texte, html }
}

/** Échappe ce qui viendrait d'un utilisateur avant de l'insérer dans du HTML. */
function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Demande d'un lien de réinitialisation.
 *
 * LE PARCOURS EXISTAIT SANS SA MÉCANIQUE. `ForgotPassword.tsx` et
 * `ResetPassword.tsx` étaient écrits, soignés, et simulaient tous deux leur
 * travail par un `window.setTimeout` ; la table `PasswordReset` figurait au
 * schéma depuis l'origine, avec sa migration, et pas une ligne du serveur ne la
 * lisait ni ne l'écrivait. Un propriétaire qui perdait son mot de passe lisait
 * « un lien vient de vous être envoyé », n'en recevait aucun, et perdait
 * l'accès à son parc — ses baux, ses cautions, ses dettes — sans recours.
 *
 * LA RÉPONSE EST LA MÊME QUE L'ADRESSE EXISTE OU NON. C'est la règle qui
 * gouverne toute cette route : distinguer les deux cas transformerait le
 * formulaire en oracle — on y essaierait des adresses pour savoir qui possède
 * un compte, et sur un produit qui gère des biens immobiliers, cette liste-là
 * se revend. Le délai de réponse ne les distingue pas non plus de façon utile :
 * l'écriture et l'envoi sont du même ordre que la lecture qui les précède.
 */
authRouter.post('/forgot', async (req: Request, res: Response) => {
  const donnees = z.object({ email }).parse(req.body)

  const compte = await prisma.userAccount.findUnique({
    where: { email: donnees.email },
    select: { id: true, fullName: true, locale: true },
  })

  if (compte) {
    const jeton = creerJeton()
    await prisma.passwordReset.create({
      data: {
        userId: compte.id,
        // Seule l'empreinte, comme pour les sessions et les codes d'invitation.
        // Une fuite de cette table ne donne aucun lien utilisable.
        tokenHash: jeton.empreinte,
        expiresAt: new Date(Date.now() + DUREE_REINITIALISATION_MS),
      },
    })

    /**
     * Les demandes précédentes ne sont PAS invalidées.
     *
     * On pourrait vouloir qu'un nouveau lien périme les anciens. Ce serait un
     * moyen de nuisance : il suffirait de demander une réinitialisation pour
     * l'adresse de quelqu'un afin d'annuler le lien qu'il vient de recevoir et
     * qu'il est peut-être en train d'ouvrir. Chaque lien vit sa propre heure et
     * ne sert qu'une fois — c'est suffisant, et cela ne donne prise à personne.
     */
    const lien = `${env.CLIENT_ORIGIN}/reinitialiser?jeton=${jeton.clair}`
    await laMessagerie().envoyerEmail(
      donnees.email,
      'GestLocPro — réinitialiser votre mot de passe',
      corpsDeReinitialisation(compte.fullName, lien),
    )
  }

  /**
   * 202 et non 200 : la demande est ACCEPTÉE, et ce qu'il en advient ne se dit
   * pas ici. Le client n'apprend rien de l'existence du compte, pas même par le
   * code de statut — et il n'apprend pas davantage si le courriel est parti,
   * puisque le lui dire reviendrait à confirmer l'adresse.
   */
  res.status(202).json({ ok: true })
})

/**
 * Réinitialisation proprement dite.
 *
 * Trois effets, indissociables et dans une seule transaction :
 *
 *  1. le mot de passe change ;
 *  2. le jeton est marqué `usedAt` — le champ que rien n'écrivait, et sans quoi
 *     le lien resterait rejouable pendant toute son heure. Quelqu'un qui lit la
 *     boîte aux lettres plus tard reprendrait le compte que son porteur vient
 *     tout juste de récupérer ;
 *  3. TOUTES les sessions du compte tombent. C'est le point qu'on oublie :
 *     celui qui réinitialise le fait souvent parce qu'un autre est entré. Lui
 *     rendre son mot de passe sans éjecter l'intrus ne lui rend rien du tout —
 *     l'intrus garde son cookie, valable trente jours.
 *
 * En une transaction parce qu'un mot de passe changé sans jeton consommé, ou
 * des sessions coupées sans mot de passe changé, sont deux états pires que
 * l'échec entier.
 */
authRouter.post('/reset', async (req: Request, res: Response) => {
  const donnees = z.object({ token: z.string().trim().min(16).max(200), password: motDePasse })
    .parse(req.body)

  const demande = await prisma.passwordReset.findUnique({
    where: { tokenHash: empreinteJeton(donnees.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })

  // Un jeton inconnu, expiré ou déjà servi rend le MÊME refus, pour la raison
  // qui vaut déjà pour les codes d'invitation : les distinguer renseignerait
  // celui qui en essaie au hasard sur ceux qui ont existé.
  if (!demande || demande.usedAt || demande.expiresAt <= new Date()) {
    res.status(400).json({ error: 'reset_invalid' })
    return
  }

  const empreinte = await hashPassword(donnees.password)

  const change = await prisma
    .$transaction(async (tx) => {
      /**
       * Le marquage d'abord, et gardé par `usedAt: null` : c'est lui qui tranche
       * deux réinitialisations lancées avec le même lien. Le perdant obtient un
       * compteur à zéro, lève, et le mot de passe n'est pas changé deux fois —
       * ce qui, sinon, laisserait le second mot de passe l'emporter sans que le
       * premier demandeur le sache.
       */
      const { count } = await tx.passwordReset.updateMany({
        where: { id: demande.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      if (count === 0) return false

      await tx.userAccount.update({
        where: { id: demande.userId },
        data: { passwordHash: empreinte },
      })

      await tx.session.updateMany({
        where: { userId: demande.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      return true
    })

  if (!change) {
    res.status(400).json({ error: 'reset_invalid' })
    return
  }

  /**
   * Aucune session n'est ouverte au passage.
   *
   * Il serait commode de connecter la personne dans la foulée. Ce serait aussi
   * accorder un accès sur la seule preuve d'un lien reçu, sans que le nouveau
   * mot de passe ait jamais été saisi pour entrer. Elle se connecte, une fois,
   * avec ce qu'elle vient de choisir : c'est la vérification que le geste a
   * abouti, et elle ne coûte qu'un écran.
   */
  res.status(204).end()
})
