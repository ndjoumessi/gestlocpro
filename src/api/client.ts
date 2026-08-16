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
    corps: { unitId: string; fullName: string; phoneE164?: string },
  ) => requete<T>(`/parks/${parkId}/tenants`, { method: 'POST', body: JSON.stringify(corps) }),
}
