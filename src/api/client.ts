/**
 * Accès à l'API.
 *
 * Un seul endroit qui sache parler au serveur. Les écrans appellent des
 * fonctions nommées — `signup`, `login` — et ne composent jamais d'URL ni
 * d'en-tête : un `fetch` recopié d'écran en écran finit toujours par oublier
 * `credentials`, et le défaut ne se voit que sur l'écran qu'on n'a pas testé.
 *
 * Les chemins sont **relatifs**. En développement, Vite mandate `/api` vers le
 * port 3001 ; en production, client et API partagent le domaine. Dans les deux
 * cas le cookie de session est de première partie — voir `vite.config.ts`.
 */

/** Erreur portée par l'API, avec son code stable et ses champs fautifs. */
export class ApiError extends Error {
  readonly status: number
  /** Code stable, destiné au code appelant. Jamais affiché tel quel. */
  readonly code: string
  /** Champs rejetés par la validation, pour les rattacher à leur saisie. */
  readonly fields: { path: string; message: string }[]

  constructor(status: number, code: string, fields: { path: string; message: string }[] = []) {
    super(`${status} ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

/**
 * Rejet réseau : le serveur n'a pas répondu du tout.
 *
 * Distinct d'une réponse d'erreur, et la distinction compte à l'écran : « le
 * serveur est injoignable » appelle un nouvel essai, « adresse déjà prise »
 * appelle une correction. Les confondre produit le message le plus inutile de
 * l'informatique — « une erreur est survenue ».
 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Le serveur est injoignable')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

interface ReponseErreur {
  error?: string
  fields?: { path: string; message: string }[]
}

/**
 * LES PARAMÈTRES DE REQUÊTE PASSENT PAR UNE OPTION, jamais par le gabarit.
 *
 * Le premier chemin paginé du produit les composait à la main —
 * `` `/parks/${id}/decisions${avant ? `?avant=…` : ''}` `` — et deux choses en
 * ont souffert. `check-orphelins` lit la SOURCE de ce fichier pour vérifier
 * qu'aucune route du serveur ne reste sans appelant : il compare des chemins
 * étoilés, et un gabarit qui se termine par une expression rend `/decisions*`,
 * qui ne correspond à rien. Un outil qu'on rend aveugle ne proteste plus.
 *
 * Et l'encodage se serait répété à chaque appelant, jusqu'à ce que l'un d'eux
 * l'oublie. Ici il est fait une fois, par `URLSearchParams`, qui connaît les
 * règles mieux qu'un `encodeURIComponent` posé au bon endroit par habitude.
 *
 * Une valeur `undefined` n'est pas envoyée : c'est ce qui permet d'écrire
 * `{ avant }` sans tester d'abord, et donc de ne pas retrouver la
 * concaténation conditionnelle chez l'appelant.
 */
type Parametres = Record<string, string | undefined>

async function requete<T>(
  chemin: string,
  init: RequestInit & { query?: Parametres } = {},
): Promise<T> {
  const { query, ...reste } = init
  const parametres = new URLSearchParams(
    Object.entries(query ?? {}).flatMap(([cle, valeur]) =>
      valeur === undefined ? [] : [[cle, valeur] as [string, string]],
    ),
  ).toString()
  const adresse = `/api${chemin}${parametres ? `?${parametres}` : ''}`

  let reponse: Response
  try {
    reponse = await fetch(adresse, {
      ...reste,
      /**
       * Sans cela, le navigateur n'envoie ni ne reçoit le cookie de session, et
       * chaque requête repart anonyme. Le défaut est silencieux : on obtient un
       * 401 parfaitement valide, et on cherche le bogue côté serveur.
       */
      credentials: 'same-origin',
      headers: {
        ...(reste.body ? { 'Content-Type': 'application/json' } : {}),
        ...reste.headers,
      },
    })
  } catch (cause) {
    throw new NetworkError(cause)
  }

  if (reponse.status === 204) return undefined as T

  // Une réponse illisible est traitée comme une erreur serveur plutôt que de
  // laisser remonter une exception de désérialisation, qui masquerait le
  // véritable code de statut.
  const corps: unknown = await reponse.json().catch(() => null)

  if (!reponse.ok) {
    const erreur = (corps ?? {}) as ReponseErreur
    throw new ApiError(reponse.status, erreur.error ?? 'internal_error', erreur.fields ?? [])
  }

  return corps as T
}

// ─── Types partagés avec le serveur ──────────────────────────────────────────

export type Role = 'owner' | 'manager' | 'tenant'

export interface CompteApi {
  id: string
  email: string
  fullName: string
  locale: 'fr' | 'en'
  countryCode: string | null
  phoneE164: string | null
}

/** Devises que le serveur STOCKE. `CFA` n'en est pas une : voir `DeviseDuParc`. */
export const DEVISES_DU_PARC = ['XAF', 'XOF', 'EUR', 'CAD', 'USD'] as const

/**
 * La devise telle que le PARC la porte, et non telle que l'écran l'affiche.
 *
 * Le client n'en connaît que quatre — `CFA` réunit les deux francs sous un seul
 * libellé, puisqu'il n'affiche que des montants et que la parité est la même.
 * Le stockage, lui, doit trancher : `XAF` en zone CEMAC, `XOF` en zone UEMOA.
 * Une correction de parc parle donc au serveur dans SA langue, sinon `CFA`
 * partirait pour un code ISO qui n'existe pas.
 */
export type DeviseDuParc = (typeof DEVISES_DU_PARC)[number]

export interface AdhesionApi {
  parkId: string
  role: Role
  parkName: string
  currency: string
  /**
   * Pays du parc. FACULTATIF, et c'est délibéré.
   *
   * Il est stocké depuis l'origine et n'était rendu nulle part ; le serveur le
   * sert maintenant sur chaque adhésion, gardé par son propre cas. Le déclarer
   * REQUIS aurait obligé vingt-quatre jeux d'essai, qui ne parlent ni de pays ni
   * de devise, à porter un champ dont ils n'ont que faire — et le manque y
   * aurait été comblé par une valeur inventée, ce que ce lot combat.
   *
   * Absent, l'écran de correction ouvre sur un champ vide plutôt que sur un pays
   * supposé : c'est le comportement juste, pas un contournement.
   */
  countryCode?: string | null
  /**
   * Politique de délégation du parc.
   *
   * FACULTATIVE, comme tout ce qui est arrivé après coup : un serveur antérieur
   * à ce champ ne le rend pas, et les écrans doivent alors se comporter comme
   * avant plutôt que de lire `undefined` comme « je gère seul » — ce qui
   * retirerait le recrutement d'un gestionnaire à des parcs qui l'ont.
   */
  delegation?: 'solo' | 'delegate'
}

export interface SessionApi {
  user: CompteApi
  memberships: AdhesionApi[]
}

export interface DemandeInscription {
  email: string
  password: string
  fullName: string
  phoneE164?: string
  countryCode?: string
  locale: 'fr' | 'en'
  acceptTerms: true
  newsletterOptIn?: boolean
  /** Nom du parc fondé — propriétaire seulement. */
  parkName?: string
  /**
   * Code d'invitation : rejoint le parc d'un tiers, au rôle de l'invitation.
   *
   * Le serveur traite cette branche EN PREMIER et exclusivement de la création
   * d'un parc. Le client ne l'envoyait jamais — le mot n'existait nulle part
   * dans les sources — et tout invité devenait propriétaire d'un parc vide.
   */
  invitationCode?: string
}

// ─── Authentification ────────────────────────────────────────────────────────

export const api = {
  signup: (donnees: DemandeInscription) =>
    requete<{ user: CompteApi }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(donnees),
    }),

  /**
   * `persistent` est REQUIS ici, alors que le serveur l'accepte absent.
   *
   * Son défaut y vaut `true`, pour les paquets déjà installés qui ne
   * l'envoient pas. Le reprendre à l'identique côté client rendrait l'omission
   * indolore : un écran qui oublierait de transmettre la case obtiendrait
   * trente jours en silence, et rien ne le dirait. En le rendant obligatoire,
   * l'oubli devient une erreur de compilation.
   */
  login: (email: string, password: string, persistent: boolean) =>
    requete<{ user: CompteApi }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, persistent }),
    }),

  logout: () => requete<void>('/auth/logout', { method: 'POST' }),

  /**
   * Demande d'un lien de réinitialisation.
   *
   * Rend le même 202 que l'adresse existe ou non — la règle est portée par le
   * serveur, et l'écran doit se garder de la contredire en affichant autre
   * chose selon le cas. Il n'y a d'ailleurs rien à lire dans la réponse.
   */
  forgotPassword: (email: string) =>
    requete<{ ok: true }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),

  /**
   * Réinitialisation proprement dite. Un jeton refusé — inconnu, périmé ou déjà
   * servi — rend 400 `reset_invalid`, sans dire lequel des trois.
   */
  resetPassword: (token: string, password: string) =>
    requete<void>('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),

  /**
   * Rejoint un parc avec un compte DÉJÀ créé.
   *
   * Le code ne se consommait qu'à l'inscription : un compte existant n'avait
   * aucun moyen de rejoindre quoi que ce soit, et l'invitation restait valable
   * et sans porte.
   */
  joinPark: (invitationCode: string) =>
    requete<{ parkId: string; role: Role }>('/join', {
      method: 'POST',
      body: JSON.stringify({ invitationCode }),
    }),

  me: () => requete<SessionApi>('/auth/me'),

  health: () => requete<{ ok: boolean }>('/health'),

  /**
   * Les cours de change, publics et sans session.
   *
   * Le franc CFA y est par sa PARITÉ LÉGALE — 655,957 pour un euro, exacte et
   * permanente — et les deux dollars par les cours de la Banque centrale
   * européenne, avec leur date. `date: null` dit que le flux n'a pas répondu :
   * ce n'est pas une panne du produit, c'est l'absence des seules devises qui
   * flottent.
   */
  rates: () => requete<TauxApi>('/rates'),

  // ─── Parc ──────────────────────────────────────────────────────────────────

  /**
   * Le parc entier en une seule réponse.
   *
   * Trois requêtes séparées arriveraient dans un ordre indéterminé, et
   * l'interface montrerait un parc à jour à côté de cautions périmées le temps
   * que la dernière revienne. `loadState()` rendait déjà un état cohérent d'un
   * bloc, et c'est ce qu'il faut conserver.
   */
  portfolio: <T>(parkId: string) => requete<T>(`/parks/${parkId}/portfolio`),

  /**
   * Le locataire demande une pièce administrative.
   *
   * Elle empruntait `addWork`, le canal des signalements : le gestionnaire la
   * recevait bien — ce qui valait mieux qu'un toast sans envoi — mais sous la
   * forme d'une intervention, rangée dans « Travaux dans mon logement » à côté
   * d'une fuite d'évier.
   *
   * Le serveur rend 409 `already_pending` si la même pièce est déjà demandée et
   * sans réponse : l'écran le dit, il ne réessaie pas.
   */
  requestDocument: <T>(parkId: string, unitId: string, kind: string) =>
    requete<T>(`/parks/${parkId}/units/${unitId}/document-requests`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),

  /**
   * Le gestionnaire répond : la pièce est fournie, ou elle ne peut pas l'être.
   *
   * Les deux sont des réponses. Sans le refus, une demande impossible à
   * satisfaire resterait « en attente » pour toujours.
   */
  resolveDocumentRequest: <T>(parkId: string, requestId: string, status: string) =>
    requete<T>(`/parks/${parkId}/document-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  approveWork: <T>(parkId: string, workId: string) =>
    requete<T>(`/parks/${parkId}/works/${workId}/approve`, { method: 'PATCH' }),

  /**
   * Défait une validation de devis. Le devis subsiste, l'accord est retiré.
   *
   * Refusé sur un travail TERMINÉ : l'artisan est passé, la dépense est réelle.
   */
  unapproveWork: <T>(parkId: string, workId: string) =>
    requete<T>(`/parks/${parkId}/works/${workId}/unapprove`, { method: 'PATCH' }),

  /** Défait un arbitrage de caution. Les deux traces restent au journal. */
  unsettleDeposit: <T>(parkId: string, depositId: string) =>
    requete<T>(`/parks/${parkId}/deposits/${depositId}/unsettle`, { method: 'PATCH' }),

  /** Chiffre une intervention déclarée. Le propriétaire arbitrera. */
  quoteWork: <T>(parkId: string, workId: string, quotedAmountMinor: number) =>
    requete<T>(`/parks/${parkId}/works/${workId}/quote`, {
      method: 'PATCH',
      body: JSON.stringify({ quotedAmountMinor }),
    }),

  /**
   * Clôt une intervention.
   *
   * Le serveur refuse un devis en attente d'arbitrage : le clore le ferait
   * disparaître de la carte du propriétaire sans qu'il ait rien décidé.
   */
  completeWork: <T>(parkId: string, workId: string, completedOn?: string) =>
    requete<T>(`/parks/${parkId}/works/${workId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(completedOn ? { completedOn } : {}),
    }),

  /**
   * Rouvre une intervention close.
   *
   * PERMANENT, et non une fenêtre de quelques secondes : une clôture prise pour
   * une autre se découvre en relisant sa liste, pas dans les six secondes.
   */
  reopenWork: <T>(parkId: string, workId: string) =>
    requete<T>(`/parks/${parkId}/works/${workId}/reopen`, { method: 'PATCH' }),

  /**
   * Établit un état des lieux.
   *
   * Le serveur refuse en 422 une réserve d'entrée CHIFFRÉE : ce document relève
   * ce qui est déjà abîmé, précisément pour que le locataire n'en réponde pas.
   */
  addInspection: <T>(
    parkId: string,
    unitId: string,
    corps: {
      kind: 'entry' | 'exit'
      rooms: number
      performedOn?: string
      signedByName?: string
      findings: { room: string; description: string; severity: 'minor' | 'major'; costMinor?: number }[]
    },
  ) =>
    requete<T>(`/parks/${parkId}/units/${unitId}/inspections`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),

  /** Déclare une intervention sur un logement. */
  addWork: <T>(
    parkId: string,
    unitId: string,
    corps: { title: string; trade: string; urgency?: string; description?: string },
  ) =>
    requete<T>(`/parks/${parkId}/units/${unitId}/works`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),

  settleDeposit: <T>(
    parkId: string,
    depositId: string,
    corps: { withheldMinor: number; reason?: string },
  ) =>
    requete<T>(`/parks/${parkId}/deposits/${depositId}/settle`, {
      method: 'PATCH',
      body: JSON.stringify(corps),
    }),

  addTenant: <T>(
    parkId: string,
    corps: {
      unitId: string
      fullName: string
      phoneE164?: string
      startsOn?: string
      rentMinor?: number
      /** Caution encaissée à l'entrée. Sans elle, le parc n'en porte aucune. */
      depositMinor?: number
    },
  ) => requete<T>(`/parks/${parkId}/tenants`, { method: 'POST', body: JSON.stringify(corps) }),

  addBuilding: <T>(parkId: string, corps: { name: string; district: string }) =>
    requete<T>(`/parks/${parkId}/buildings`, { method: 'POST', body: JSON.stringify(corps) }),

  /**
   * Retire un immeuble VIDE. Le serveur refuse s'il porte des logements.
   *
   * Aucun corps, aucune réponse : le 204 dit tout. `requete` sait déjà rendre
   * `undefined` sur un corps absent.
   */
  deleteBuilding: <T>(parkId: string, buildingId: string) =>
    requete<T>(`/parks/${parkId}/buildings/${buildingId}`, { method: 'DELETE' }),

  /**
   * Appelle les loyers du mois : émet les échéances de tous les baux en cours.
   *
   * Sans cet appel, une échéance n'existait que comme effet de bord d'un
   * encaissement — le locataire qui ne paie pas n'en avait aucune, donc n'était
   * jamais en retard.
   */
  callRent: <T>(parkId: string, periodStart: string) =>
    requete<T>(`/parks/${parkId}/charges`, {
      method: 'POST',
      body: JSON.stringify({ periodStart }),
    }),

  /**
   * Relance les BAUX désignés.
   *
   * Le serveur revérifie chacun : rien d'exigible, déjà relancé ce matin, ou
   * d'un autre parc. Il rend donc `sent` et `skipped` plutôt qu'un
   * simple succès — l'écran doit pouvoir dire « 2 relancés, 1 déjà relancé »
   * plutôt que d'annoncer trois envois dont un n'a pas eu lieu.
   */
  remindRent: <T>(parkId: string, leaseIds: string[]) =>
    requete<T>(`/parks/${parkId}/reminders`, {
      method: 'POST',
      body: JSON.stringify({ leaseIds }),
    }),

  /**
   * Retire une fiche locataire, avec son bail et ses échéances appelées.
   *
   * Le serveur refuse tant qu'une somme a circulé — versement encaissé ou
   * caution détenue. On défait dans l'ordre inverse de ce qu'on a fait.
   */
  deleteTenant: <T>(parkId: string, tenantId: string) =>
    requete<T>(`/parks/${parkId}/tenants/${tenantId}`, { method: 'DELETE' }),

  /**
   * Retire un versement saisi par erreur.
   *
   * L'échéance reste : elle a été appelée, elle est due. Retirer le versement
   * rétablit la dette, il ne l'efface pas.
   */
  deletePayment: <T>(parkId: string, paymentId: string) =>
    requete<T>(`/parks/${parkId}/payments/${paymentId}`, { method: 'DELETE' }),

  /** Met en demeure — droit du seul propriétaire, motif obligatoire. */
  serveFormalNotice: <T>(parkId: string, leaseId: string, reason: string) =>
    requete<T>(`/parks/${parkId}/leases/${leaseId}/formal-notice`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Le registre des accès : qui est membre, et quels codes attendent encore.
   *
   * Une seule lecture pour les deux, parce qu'ils répondent à la même question
   * — qui peut entrer dans ce parc — et que les séparer laisserait un écran
   * afficher une moitié à jour et l'autre périmée.
   */
  access: <T>(parkId: string) => requete<T>(`/parks/${parkId}/access`),
  /**
   * Le registre des DÉCISIONS : ce que le parc a écrit, et qui l'a écrit.
   *
   * Distinct du registre des accès, qui répond à « qui a le droit » quand
   * celui-ci répond à « qui a fait ». Réservé au propriétaire — le serveur rend
   * 403 aux autres, et l'écran ne s'offre pas à eux.
   *
   * `avant` est un curseur, et non un numéro de page : un registre s'allonge
   * par le haut, et une pagination par décalage rejouerait ou sauterait une
   * ligne entre deux lectures.
   */
  decisions: <T>(parkId: string, avant?: string) =>
    requete<T>(`/parks/${parkId}/decisions`, { query: { avant } }),

  /**
   * Les prix de refacturation, historique compris.
   *
   * Un tarif passé n'est pas un déchet : c'est ce qui explique une quittance de
   * l'an dernier, et c'est la question qu'un locataire pose quand il conteste.
   */
  tariffs: <T>(parkId: string) => requete<T>(`/parks/${parkId}/tariffs`),

  /**
   * Pose un prix, daté. Réservé au propriétaire — fixer un prix engage l'argent
   * du locataire. Deux prix pour la même énergie le même jour rendent 409.
   */
  setTariff: <T>(
    parkId: string,
    corps: { utility: 'water' | 'power'; unitPriceMinor: number; effectiveFrom: string },
  ) => requete<T>(`/parks/${parkId}/tariffs`, { method: 'POST', body: JSON.stringify(corps) }),

  /**
   * Corrige le parc — son nom, son pays, sa devise, sa politique de délégation.
   *
   * Le corps ne porte QUE les champs à changer : envoyer les quatre à chaque
   * fois réécrirait le pays et la devise avec ce que l'écran croyait savoir en
   * s'ouvrant. Un corps vide rend 422, le serveur n'ayant rien à corriger.
   *
   * Rend 409 `has_managers` si l'on passe en `solo` avec un gestionnaire en
   * place : le réglage annoncerait qu'aucun tiers n'opère le parc pendant qu'un
   * tiers l'opère.
   */
  updatePark: <T>(
    parkId: string,
    corps: {
      name?: string
      countryCode?: string
      currency?: DeviseDuParc
      delegation?: 'solo' | 'delegate'
    },
  ) => requete<T>(`/parks/${parkId}`, { method: 'PATCH', body: JSON.stringify(corps) }),

  /** Reprend un code encore en attente. Un code déjà consommé rend 409. */
  revokeInvitation: (parkId: string, invitationId: string) =>
    requete<void>(`/parks/${parkId}/invitations/${invitationId}/revoke`, { method: 'PATCH' }),

  /** Retire son accès à un membre. Réservé au propriétaire, et jamais le sien. */
  /**
   * Relie une fiche locataire à un compte déjà membre du parc.
   *
   * Le serveur porte les quatre refus — compte non membre, membre non
   * locataire, fiche déjà reliée, compte déjà relié — et l'écran ne les redit
   * pas : il ne propose que ce qui est reliable. Voir `relierLaFiche.test.ts`.
   */
  linkTenantAccount: (parkId: string, tenantId: string, userId: string) =>
    requete<void>(`/parks/${parkId}/tenants/${tenantId}/compte`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  revokeMembership: (parkId: string, membershipId: string) =>
    requete<void>(`/parks/${parkId}/memberships/${membershipId}/revoke`, { method: 'PATCH' }),

  issueInvitation: <T>(
    parkId: string,
    corps: { role: 'tenant' | 'manager'; unitId?: string },
  ) => requete<T>(`/parks/${parkId}/invitations`, { method: 'POST', body: JSON.stringify(corps) }),

  issueReceipt: <T>(parkId: string, corps: { unitId: string; periodStart: string }) =>
    requete<T>(`/parks/${parkId}/receipts`, { method: 'POST', body: JSON.stringify(corps) }),

  recordPayment: <T>(
    parkId: string,
    corps: {
      unitId: string
      periodStart: string
      amountMinor: number
      method: string
      paidOn?: string
      /** L'identifiant de l'opérateur. Opposable : le locataire le lit aussi. */
      reference?: string
      /** L'annotation du bailleur. INTERNE : le serveur ne la sert pas au locataire. */
      note?: string
    },
  ) => requete<T>(`/parks/${parkId}/payments`, { method: 'POST', body: JSON.stringify(corps) }),

  /**
   * Marque des notifications comme lues, pour le compte connecté.
   *
   * L'état « lu » appartient au couple destinataire × notification, et il vivait
   * dans un `Set` de session : le bouton « tout marquer comme lu » vidait un
   * compteur qui repoussait au rechargement. Le serveur relisait `readAt` depuis
   * l'origine — personne ne l'écrivait.
   *
   * Rend `marked`, le nombre de lectures NOUVELLES : renvoyer deux fois la même
   * liste rend `2` puis `0`, ce qui est la seule façon de voir qu'une seconde
   * lecture ne réécrit pas la première date.
   */
  markNotificationsRead: <T>(parkId: string, ids: string[]) =>
    requete<T>(`/parks/${parkId}/notifications/read`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),

  /**
   * RÉPONDRE AU LOCATAIRE QUI A SIGNALÉ.
   *
   * Le fil n'existait que dans un sens : le locataire déclarait une fuite, puis
   * regardait un statut avancer sans jamais savoir quand quelqu'un passerait.
   *
   * La réponse dit `delivered`, et l'écran doit le lire : un locataire dont la
   * fiche n'est reliée à aucun compte n'a pas d'espace où lire le message. Il
   * est quand même consigné au dossier, mais il reste un appel à passer —
   * annoncer « réponse envoyée » dans ce cas serait le mensonge que ce produit
   * retire partout ailleurs. Le serveur rend 409 `no_reporter` sur une
   * intervention que le bailleur a ouverte lui-même : il n'y a personne à qui
   * répondre.
   */
  replyToWork: <T>(parkId: string, workId: string, message: string) =>
    requete<T>(`/parks/${parkId}/works/${workId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  /**
   * Le message groupé aux locataires en place.
   *
   * `buildingId` absent vaut TOUT LE PARC : c'est le serveur qui borne, et le
   * client ne compose pas la liste des destinataires — il l'ignore. Un bail
   * terminé n'est pas prévenu, et cette règle n'a pas à être recopiée ici.
   *
   * Rend `delivered` et `unreachable` : le compte de ceux qui liront, et le nom
   * de ceux qu'il faudra appeler.
   */
  announce: <T>(parkId: string, corps: { message: string; buildingId?: string }) =>
    requete<T>(`/parks/${parkId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),

  addUnit: <T>(
    parkId: string,
    buildingId: string,
    corps: { label: string; type: string; surfaceSqm: number; baseRentMinor: number },
  ) =>
    requete<T>(`/parks/${parkId}/buildings/${buildingId}/units`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),

  /**
   * Réserve une place pour la photo d'une réserve, et rend de quoi l'envoyer.
   *
   * `sizeBytes` est la taille du blob TRANSCODÉ, pas celle du fichier choisi :
   * elle est scellée dans l'autorisation d'envoi et le dépôt refuse tout ce qui
   * n'en fait pas exactement autant. Annoncer la taille de l'original ferait
   * refuser chaque envoi.
   */
  reservePhoto: <T>(
    parkId: string,
    findingId: string,
    corps: { contentType: 'image/jpeg'; sizeBytes: number },
  ) =>
    requete<T>(`/parks/${parkId}/findings/${findingId}/photos`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),

  /**
   * Dit que les octets sont montés. C'est ICI que le serveur les regarde.
   *
   * Sans cet appel, la ligne reste non confirmée et rien ne la sert — une photo
   * déposée mais non confirmée est payée et invisible, ce que l'écran doit
   * dire plutôt que de refermer sur un succès.
   */
  confirmPhoto: <T>(parkId: string, photoId: string) =>
    requete<T>(`/parks/${parkId}/photos/${photoId}/confirmation`, { method: 'POST' }),

  /**
   * Demande l'adresse de lecture d'une photo — signée, et courte.
   *
   * Elle N'EST PAS dans le portefeuille, et ne peut pas y être : le portefeuille
   * se lit une fois puis vit en mémoire des heures, l'adresse périme en quelques
   * minutes. Une adresse scellée dans la vue serait morte avant d'être affichée.
   *
   * Un appel PAR PHOTO, donc, et c'est le prix du seau non public. Le
   * portefeuille borne déjà ce que le locataire peut demander : le serveur rend
   * 404 sur tout ce qui sort de son bail, y compris sur son propre logement.
   */
  readPhoto: <T>(parkId: string, photoId: string) =>
    requete<T>(`/parks/${parkId}/photos/${photoId}`),
}

/**
 * DÉPOSE LES OCTETS, hors de `requete` et c'est délibéré.
 *
 * `requete` préfixe `/api` et pose `Content-Type: application/json` ; ni l'un
 * ni l'autre ne convient. L'adresse vient du serveur, déjà complète et signée,
 * et le corps est une image — le jour où le dépôt sera R2, cette même adresse
 * pointera vers un autre domaine et cette fonction n'aura pas à changer.
 *
 * `credentials: 'same-origin'` fait exactement ce qu'il faut des deux côtés :
 * le cookie de session part vers le transport local, et NE PART PAS vers le
 * seau distant, où il n'aurait rien à faire.
 */
export async function deposerLesOctets(
  envoi: { url: string; methode: string; entetes: Record<string, string> },
  octets: Blob,
): Promise<void> {
  const reponse = await fetch(envoi.url, {
    method: envoi.methode,
    headers: envoi.entetes,
    body: octets,
    credentials: 'same-origin',
  })
  if (!reponse.ok) {
    throw new ApiError(reponse.status, 'upload_failed')
  }
}

/**
 * Les cours servis par `/rates`, tous exprimés POUR UN EURO.
 *
 * L'euro sert de pivot parce que c'est la base de la publication de la BCE et
 * celle de la parité du franc CFA : n'importe quelle autre exigerait une
 * inversion, c'est-à-dire l'endroit où l'on se trompe.
 */
export interface TauxApi {
  /** Jour de publication des cours flottants. `null` quand le flux n'a rien rendu. */
  date: string | null
  parEuro: Partial<Record<'XAF' | 'XOF' | 'EUR' | 'CAD' | 'USD', number>>
}
