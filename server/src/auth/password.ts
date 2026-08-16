import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

/**
 * Hachage des mots de passe.
 *
 * `scrypt` plutôt qu'`argon2` ou `bcrypt` : il est **dans Node**, donc sans
 * dépendance à compiler, sans binaire natif à embarquer dans l'image, et sans
 * paquet tiers dans le chemin critique de l'authentification. Argon2id reste
 * préférable dans l'absolu ; scrypt est mémoire-dur, éprouvé, normalisé
 * (RFC 7914), et le passage à Argon2id restera possible sans invalider les
 * empreintes existantes — voir le préfixe d'algorithme ci-dessous.
 *
 * **Jamais de `===` sur des empreintes.** La comparaison de chaînes s'arrête au
 * premier octet différent : le temps de réponse renseigne alors sur le nombre
 * d'octets corrects, et permet de reconstruire l'empreinte octet par octet.
 * `timingSafeEqual` compare en temps constant.
 */

/**
 * Coût.
 *
 * `N = 2^16` avec `r = 8` demande environ 64 Mio et ~100 ms sur une machine
 * courante. C'est délibérément lent : le coût pour l'utilisateur est invisible
 * — une fois par connexion — quand celui d'une attaque par dictionnaire est
 * multiplié d'autant.
 *
 * `maxmem` doit être relevé explicitement : la limite par défaut de Node est de
 * 32 Mio, et `scrypt` échoue au-delà avec une erreur qui ne nomme pas la cause.
 */
const N = 2 ** 16
const R = 8
const P = 1
const LONGUEUR_CLE = 64
const MAXMEM = 128 * 1024 * 1024

/** Identifie le schéma employé, pour pouvoir en changer sans tout invalider. */
const ALGO = 'scrypt'

/**
 * Rend une empreinte auto-descriptive : `scrypt$65536$8$1$sel$empreinte`.
 *
 * Les paramètres voyagent avec l'empreinte, et non dans le code : relever le
 * coût demain n'empêchera pas de vérifier les mots de passe hachés hier.
 * Une empreinte qui ne porte pas ses paramètres condamne à tout réinitialiser
 * au premier ajustement.
 */
export async function hashPassword(plain: string): Promise<string> {
  const sel = randomBytes(16)
  const derivee = (await scryptAsync(plain.normalize('NFKC'), sel, LONGUEUR_CLE, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  })) as Buffer

  return [ALGO, N, R, P, sel.toString('base64url'), derivee.toString('base64url')].join('$')
}

/**
 * Vérifie un mot de passe contre une empreinte enregistrée.
 *
 * Rend `false` sur une empreinte illisible plutôt que de lever : un
 * enregistrement corrompu ne doit pas transformer une tentative de connexion en
 * erreur 500, qui distinguerait ce compte de tous les autres.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6) return false

  const [algo, nBrut, rBrut, pBrut, selB64, empreinteB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  if (algo !== ALGO) return false

  const n = Number(nBrut)
  const r = Number(rBrut)
  const p = Number(pBrut)
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  let sel: Buffer
  let attendue: Buffer
  try {
    sel = Buffer.from(selB64, 'base64url')
    attendue = Buffer.from(empreinteB64, 'base64url')
  } catch {
    return false
  }
  if (sel.length === 0 || attendue.length === 0) return false

  let derivee: Buffer
  try {
    derivee = (await scryptAsync(plain.normalize('NFKC'), sel, attendue.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    })) as Buffer
  } catch {
    // Paramètres hors bornes dans l'enregistrement : illisible, donc refusé.
    return false
  }

  return timingSafeEqual(derivee, attendue)
}

/**
 * `true` si l'empreinte a été produite avec des paramètres périmés.
 *
 * Permet de re-hacher au vol lors d'une connexion réussie, le seul moment où le
 * mot de passe en clair est disponible. Sans cela, relever le coût ne
 * protégerait que les comptes créés après le changement.
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6) return true
  const [algo, n, r, p] = parts
  return algo !== ALGO || Number(n) < N || Number(r) < R || Number(p) < P
}
