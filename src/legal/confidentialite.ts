import type { DateParts } from '@/data/portfolio'

/**
 * CE QUE GESTLOCPRO FAIT DES DONNÉES PERSONNELLES — relevé dans le code et chez
 * l'hébergeur, pas écrit d'après ce qu'un service de ce genre fait d'habitude.
 *
 * Relevé le 2026-09-13 : le schéma Prisma, les appels sortants du serveur, le
 * cookie de session, chaque clé de stockage du navigateur, et la production
 * elle-même (région Railway, variables présentes — leurs NOMS, jamais leurs
 * valeurs —, relais Vercel qui répond encore). La page ne dit que cela.
 *
 * CE QUI EST UN CHOIX DE NELSON, et non un relevé, le 2026-09-13 :
 *   - le contact pour exercer ses droits est l'adresse POSTALE de l'éditeur,
 *     puis, le 2026-09-14, aussi son adresse électronique (`EDITEUR.courriel`) ;
 *   - les durées de conservation sont décrites telles qu'elles sont — rien
 *     n'est purgé —, plutôt que promises avant d'être codées.
 */

/**
 * LES PRESTATAIRES QUI REÇOIVENT DES DONNÉES PERSONNELLES.
 *
 * Railway : l'application, sa base Postgres, le volume des photos et le cron des
 * relances, tous en région `iad` (est des États-Unis), vérifié sur le projet.
 * Resend : `RESEND_API_KEY` existe en production, sur le service web ET sur le
 * cron. Vercel : `gestlocpro.vercel.app` relaie toujours vers Railway
 * (`vercel.json`), vérifié par une requête le 2026-09-13 — Vercel voit donc
 * l'adresse IP, le cookie et la requête de qui passe par là.
 *
 * TWILIO N'Y EST PAS, et c'est un relevé : le code sait envoyer des SMS, mais
 * aucune des trois variables `TWILIO_*` n'existe en production — rien ne part.
 * Le jour où elles existeront, Twilio recevra des numéros de téléphone et ce
 * tableau deviendra faux ; un cas refuse aujourd'hui son nom sur la page, pour
 * que l'ajouter oblige à le toucher.
 *
 * Identités et adresses : Railway depuis `HEBERGEUR` ; Resend et Vercel depuis
 * l'accord de traitement des données de chacun, relevé le 2026-09-13 — Resend
 * est la marque de « Plus Five Five, Inc. ». Les trois déclarent, dans leur
 * politique de confidentialité, adhérer au Data Privacy Framework UE–États-Unis.
 *
 * VÉRIFIÉ SUR LA LISTE OFFICIELLE le 2026-09-15 (API de
 * dataprivacyframework.gov, statut « Active ») : Railway Corporation (n° 2913)
 * et Vercel Inc. (n° 6847), actifs ; Resend (n° 8907), « Active -
 * Re-certification under Review » — actif, recertification en cours d'examen.
 * La page garde « déclare adhérer » et non « figure sur la liste » : la
 * première reste vraie si une certification tombe, la seconde deviendrait
 * fausse sans que rien dans le dépôt ne le voie. Aucune garde ne relit la liste.
 */
export const SOUS_TRAITANTS = [
  { cle: 'railway', nom: 'Railway Corporation', role: 'hebergement', pays: 'US' },
  { cle: 'resend', nom: 'Plus Five Five, Inc. (Resend)', role: 'courriels', pays: 'US' },
  { cle: 'vercel', nom: 'Vercel Inc.', role: 'relais', pays: 'US' },
] as const

/** Le seul cookie : celui de `server/src/auth/session.ts` (`NOM_COOKIE`). */
export const COOKIE_DE_SESSION = 'gestlocpro_session'

/**
 * CHAQUE CLÉ QUE LE NAVIGATEUR GARDE, ET POURQUOI.
 *
 * Un cas relit les sources et exige que cette liste soit EXACTEMENT celle des
 * clés `gestlocpro.*` du dépôt : une clé ajoutée sans être déclarée ici fait
 * rougir, et c'est la page qui mentirait sinon.
 *
 * `gestlocpro.session.adresse` porte l'ADRESSE ÉLECTRONIQUE de qui a coché
 * « rester connecté », et elle survit à la déconnexion — elle ne s'efface que si
 * l'on décoche la case (`Login.tsx`). La page le dit tel quel.
 */
export const CLES_DU_NAVIGATEUR = {
  'gestlocpro.theme': 'preferences',
  'gestlocpro.locale': 'preferences',
  'gestlocpro.region': 'preferences',
  'gestlocpro.currency': 'preferences',
  'gestlocpro.rates': 'preferences',
  'gestlocpro.session.persistante': 'connexion',
  'gestlocpro.session.adresse': 'connexion',
  'gestlocpro.portfolio': 'demonstration',
  'gestlocpro.demo': 'demonstration',
} as const

/** Date du relevé : 13 septembre 2026 (`DateParts` compte les mois depuis zéro). */
export const RELEVE_LE = { year: 2026, month: 8, day: 13 } satisfies DateParts

