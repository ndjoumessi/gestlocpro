import { describe, expect, it } from 'vitest'
import { GESTES, cleDe, gestesDe } from './manuelDesGestes'
import { adresseOuverteAuRole } from '@/app/adressesParRole'
import type { Role } from '@/features/auth/signupState'
import { fr } from '@/i18n/fr'
import { en } from '@/i18n/en'

/**
 * UN MANUEL QUI ENVOIE AU MAUVAIS ENDROIT EST PIRE QU'AUCUN MANUEL.
 *
 * ═══ CE QUE CES CAS EMPÊCHENT, ET CE N'EST PAS THÉORIQUE ═══
 *
 * Un manuel est de la PROSE SUR DU COMPORTEMENT, et ce dépôt a une mémoire
 * entière sur la prose qui vieillit sans que personne ne le voie. Trois façons
 * de se tromper, toutes silencieuses à l'exécution :
 *
 *  1. ENVOYER SUR UNE ADRESSE QUI N'EXISTE PAS. Le produit est une page unique :
 *     un lien vers `/app/facturation` rend l'écran « introuvable », avec un 200.
 *     Rien ne rougit, et le lecteur conclut que le produit est cassé.
 *
 *  2. ENVOYER UN RÔLE OÙ IL N'A PAS LE DROIT. `decisions` est au propriétaire
 *     seul ; dire à un gestionnaire d'y aller le dépose sur un refus. C'est le
 *     défaut exact que `adressesParRole` a été créé pour éviter du côté de la
 *     connexion — « déposer quelqu'un sur un mur » —, et un manuel peut le
 *     reproduire sans toucher une seule route.
 *
 *  3. DÉCRIRE UN GESTE DANS UNE SEULE LANGUE. Le dictionnaire anglais oublié
 *     rend la clé brute à l'écran, et la porte d'i18n ne voit pas ce qui manque
 *     dans un sous-objet qu'elle ne sait pas devoir exister.
 *
 * ═══ CE QUE `tsc` TIENT DÉJÀ, ET QU'ON NE REFAIT PAS ICI ═══
 *
 * Les clés de libellé sont typées `MessageKey`, dérivé du dictionnaire français :
 * une clé supprimée ou déplacée fait échouer la compilation. Vérifié par mutation
 * le 2026-10-01 — `app.lease.cle-qui-nexiste-pas` est refusée parmi 2100 clés
 * valides. Ces cas-ci couvrent ce que le compilateur ne voit PAS : les adresses,
 * les rôles, et la langue anglaise.
 *
 * ═══ LA GARDE DU GARDE ═══
 *
 * Chaque extraction est confrontée à un PLANCHER. Une lecture cassée rendrait
 * zéro route, et « aucune adresse morte parmi zéro » s'écrit comme « tout va
 * bien » — c'est [[cas-negatif-vert-a-vide]] appliqué à un test.
 */

/* Le routeur est LU COMME UN TEXTE, l'idiome de `heroLeger` et de
   `decisions-nommees` : l'importer monterait vingt écrans et leur fournisseur
   de données pour en extraire une liste de chaînes. */
const SOURCES = import.meta.glob(['/src/app/EspaceApplicatif.tsx', '/src/features/auth/signupState.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const routeur = SOURCES['/src/app/EspaceApplicatif.tsx'] ?? ''
const ADRESSES_DECLAREES = new Set(
  [...routeur.matchAll(/<Route path="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((p) => p !== '*' && !p.includes(':')),
)

describe('le manuel ne porte aucun lien mort', () => {
  it('a lu le routeur — sinon tout ce qui suit est vide de sens', () => {
    expect(ADRESSES_DECLAREES.size).toBeGreaterThanOrEqual(15)
  })

  it('chaque geste nomme une adresse que le routeur déclare', () => {
    const inconnues = GESTES.filter((g) => !ADRESSES_DECLAREES.has(g.adresse))
    expect(inconnues.map((g) => `${cleDe(g)} → ${g.adresse}`)).toEqual([])
  })

  it("chaque geste nomme un PREMIER segment, pas un chemin — sinon aucun lien ne se compose", () => {
    const composees = GESTES.filter((g) => g.adresse.includes('/'))
    expect(composees.map(cleDe)).toEqual([])
  })

  it('chaque rôle a le droit d’atteindre les adresses qu’on lui indique', () => {
    const interdits = GESTES.flatMap((g) =>
      g.roles
        .filter((role) => !adresseOuverteAuRole(`/app/${g.adresse}`, role))
        .map((role) => `${cleDe(g)} : ${role} n’a pas accès à ${g.adresse}`),
    )
    expect(interdits).toEqual([])
  })
})

/*
  LES RÔLES SONT LUS DANS LEUR TYPE, JAMAIS RECOPIÉS ICI.

  `signupState.ts` ne porte qu'un type — aucune liste n'existe à l'exécution —, et
  les scripts du dépôt le lisent déjà comme un texte (`rolesDuProduit`). Recopier
  « owner, manager, tenant » dans ce fichier ferait qu'un QUATRIÈME rôle ajouté
  demain n'aurait aucun geste au manuel et que rien ne le dirait : le cas
  passerait, puisqu'il ne connaîtrait pas le rôle manquant.
*/
const ROLES = (() => {
  const source = SOURCES['/src/features/auth/signupState.ts'] ?? ''
  const ligne = /export type Role = ([^\n]+)/.exec(source)?.[1] ?? ''
  return [...ligne.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!) as Role[]
})()

describe('le manuel couvre les trois rôles', () => {
  it('a lu les rôles dans leur type — sinon les cas suivants ne comparent rien', () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(3)
  })

  it('aucun rôle ne reste sans gestes', () => {
    const vides = ROLES.filter((role) => gestesDe(role).length === 0)
    expect(vides).toEqual([])
  })

  /* TROIS AU MINIMUM, et ce n'est pas un chiffre de confort : un rôle qui
     tomberait à un seul geste serait un rôle dont le manuel a été vidé par
     accident, et « il reste un geste » se lit comme « c'est couvert ». */
  it('chaque rôle en a au moins trois', () => {
    const maigres = ROLES
      .map((role) => [role, gestesDe(role).length] as const)
      .filter(([, n]) => n < 3)
    expect(maigres).toEqual([])
  })

  it('aucun geste n’est sans rôle — il ne serait atteint par personne', () => {
    expect(GESTES.filter((g) => g.roles.length === 0).map(cleDe)).toEqual([])
  })

  it('aucune clé en double', () => {
    const vues = GESTES.map(cleDe)
    expect(vues.length).toBe(new Set(vues).size)
  })
})

describe('chaque geste est décrit dans les deux langues', () => {
  const phrases = (d: typeof fr | typeof en) =>
    (d as unknown as { app: { manual: { gestes: Record<string, string> } } }).app.manual.gestes

  it('le français porte une phrase par geste', () => {
    const manquantes = GESTES.filter((g) => !phrases(fr)[cleDe(g)]?.trim())
    expect(manquantes.map(cleDe)).toEqual([])
  })

  it('l’anglais aussi — une clé non traduite s’affiche brute', () => {
    const manquantes = GESTES.filter((g) => !phrases(en)[cleDe(g)]?.trim())
    expect(manquantes.map(cleDe)).toEqual([])
  })

  /* AUCUNE PHRASE ORPHELINE : une entrée du dictionnaire dont le geste a été
     retiré est du texte que personne ne lira plus, et qui vieillira seul. */
  it('aucune phrase ne décrit un geste retiré', () => {
    const connus = new Set(GESTES.map(cleDe))
    const orphelines = Object.keys(phrases(fr)).filter((k) => !connus.has(k))
    expect(orphelines).toEqual([])
  })
})
