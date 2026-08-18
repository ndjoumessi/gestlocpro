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

async function requete<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`/api${chemin}`, {
      ...init,
      /**
       * Sans cela, le navigateur n'envoie ni ne reçoit le cookie de session, et
       * chaque requête repart anonyme. Le défaut est silencieux : on obtient un
       * 401 parfaitement valide, et on cherche le bogue côté serveur.
       */
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
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

export interface AdhesionApi {
  parkId: string
  role: Role
  parkName: string
  currency: string
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
}

// ─── Authentification ────────────────────────────────────────────────────────

export const api = {
  signup: (donnees: DemandeInscription) =>
    requete<{ user: CompteApi }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(donnees),
    }),

  login: (email: string, password: string) =>
    requete<{ user: CompteApi }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => requete<void>('/auth/logout', { method: 'POST' }),

  me: () => requete<SessionApi>('/auth/me'),

  health: () => requete<{ ok: boolean }>('/health'),

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
      reference?: string
    },
  ) => requete<T>(`/parks/${parkId}/payments`, { method: 'POST', body: JSON.stringify(corps) }),

  addUnit: <T>(
    parkId: string,
    buildingId: string,
    corps: { label: string; type: string; surfaceSqm: number; baseRentMinor: number },
  ) =>
    requete<T>(`/parks/${parkId}/buildings/${buildingId}/units`, {
      method: 'POST',
      body: JSON.stringify(corps),
    }),
}
