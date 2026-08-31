import type { Role } from '@/features/auth/signupState'

/**
 * QUEL RÔLE ATTEINT QUELLE ADRESSE — la seule liste, lue par deux endroits.
 *
 * ═══ POURQUOI ELLE EXISTE ═══
 *
 * `EspaceApplicatif` posait ces rôles écran par écran, dans le JSX de chaque
 * route. C'était suffisant tant qu'un seul lecteur en avait besoin : le garde
 * qui rend l'écran ou le refus. Un second lecteur est apparu — la connexion,
 * qui doit savoir si l'adresse retenue est atteignable AVANT d'y renvoyer —, et
 * deux listes finiraient par diverger. Une adresse ajoutée d'un côté ferait
 * alors exactement ce que ce lot corrige : déposer quelqu'un sur un mur.
 *
 * Elle vit dans son PROPRE fichier, et c'est une contrainte de poids, pas de
 * goût. `EspaceApplicatif` importe les vingt écrans et le fournisseur de
 * données ; il n'est chargé qu'une fois l'adresse entrée sous `/app`. L'importer
 * depuis `Login` — qui appartient au paquet d'entrée — ferait télécharger tout
 * l'espace de gestion à un prospect qui n'ouvre que la page de vente. Ce fichier
 * ne contient que des chaînes.
 *
 * ═══ CE QU'ELLE NE DIT PAS ═══
 *
 * Les adresses ABSENTES de la table sont ouvertes à tous — le tableau de bord,
 * les paiements, les relevés, les cautions, les états des lieux, les travaux,
 * les signalements. Le locataire y accède réellement : le serveur borne déjà ce
 * qu'il rend à son bail. Les lister « ouvertes à trois rôles » n'aurait rien
 * ajouté et aurait donné une seconde chose à tenir à jour.
 *
 * Les deux VITRINES — `systeme`, `portail` — n'y sont pas non plus : leur garde
 * ne tient pas au rôle mais au mode, et un vrai compte n'y a pas accès quel que
 * soit son rôle. Une destination de connexion pointant sur elles rend donc son
 * 404, ce qui est juste : sous un vrai compte, ces adresses n'existent pas.
 */
export const ROLES_PAR_ADRESSE: Record<string, Role[]> = {
  /* Les trois écrans du locataire, et de lui seul. */
  'mon-espace': ['tenant'],
  documents: ['tenant'],
  signaler: ['tenant'],
  /* La gestion du parc. `parc/:unitId` hérite de `parc` : la borne porte sur le
     premier segment, et le dossier d'un logement n'est pas plus ouvert que la
     liste dont il vient. */
  parc: ['owner', 'manager'],
  locataires: ['owner', 'manager'],
  acces: ['owner', 'manager'],
  /* Le propriétaire seul : il délègue, et ces deux écrans sont ses moyens de
     contrôler ce qu'il a délégué. Le serveur refuse déjà le registre des
     décisions au gestionnaire par un 403. */
  decisions: ['owner'],
  'prise-en-main': ['owner'],
}

/**
 * Cette adresse d'application est-elle ouverte à ce rôle ?
 *
 * `chemin` est une adresse interne complète — « /app/parc/abc?onglet=bail ».
 * On n'en retient que le PREMIER segment sous `/app` : c'est lui qui porte le
 * garde, les suivants sont des identifiants.
 *
 * L'index — `/app` tout court — est toujours ouvert : il ne rend rien par
 * lui-même, il conduit chaque rôle chez lui.
 *
 * TOUT CE QUI N'EST PAS DANS LA TABLE PASSE, et c'est délibéré : cette fonction
 * détourne une redirection, elle ne remplace aucun garde. Refuser par défaut
 * ferait d'un oubli de table une adresse silencieusement inatteignable, quand
 * l'oubli inverse ne coûte qu'un 404 — celui qu'on aurait eu de toute façon.
 */
export function adresseOuverteAuRole(chemin: string, role: Role): boolean {
  const segment = chemin.replace(/^\/app\/?/, '').split(/[/?#]/)[0] ?? ''
  if (segment === '') return true
  const roles = ROLES_PAR_ADRESSE[segment]
  return !roles || roles.includes(role)
}
