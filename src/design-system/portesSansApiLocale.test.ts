import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * AUCUNE PORTE QUI MESURE SANS SESSION NE DÉPEND DE L'API LOCALE.
 *
 * ═══ CE QUE CETTE GARDE A COÛTÉ AVANT D'EXISTER ═══
 *
 * Le 2026-09-02, `check:navigateur` a rougi sur trois plaintes :
 * « /app@320 · /app@360 · /app@1280 : déclarée sans écran, mais elle rend un
 * <main>. » Aucune ligne du produit n'avait bougé. Ce qui avait bougé, c'est
 * qu'un `npm --prefix server run dev` tournait dans un autre terminal.
 *
 * `vite preview` hérite du proxy du serveur de développement — vite 7.3.6,
 * `resolvePreviewOptions` : `proxy: preview?.proxy ?? server.proxy`. Avec le
 * port 3001 vivant, `/auth/me` rend 401, la session bascule en « anonyme », et
 * `/app` renvoie vers `/connexion`, qui porte un `<main>`. Port éteint, la
 * session part en « hors ligne » et `/app` ne rend aucun `<main>`.
 *
 * DEUX VERDICTS POUR LE MÊME COMMIT. C'est la définition d'une porte qui ne
 * garde rien.
 *
 * ═══ POURQUOI LA GARDE EST ICI ET NON DANS LE SCRIPT ═══
 *
 * Un script ne peut pas se garder lui-même sur ce point : s'il oublie la
 * coupure, il tourne, il est vert, et il mesure autre chose que ce qu'il
 * annonce. C'est exactement la panne d'`agentDeServiceEcarte.test.ts`, et la
 * réponse est la même — une constante partagée, plus un compte qui exige que
 * CHAQUE contexte la porte.
 *
 * ═══ LE ROUGE N'ÉTAIT PAS LE PIRE ═══
 *
 * `plafond-coquille.mjs` a refusé, donc il a parlé. `mesure-ui.mjs` visite
 * `/app` sans session lui aussi, et n'a rien dit : il a mesuré `/connexion`
 * sous l'étiquette `/app`, et a imprimé « exemptions de rendu : AUCUNE » comme
 * un succès. Une porte muette qui mesure le mauvais écran ne se découvre que le
 * jour où l'on cherche pourquoi elle n'a jamais rien trouvé.
 *
 * ═══ L'EXEMPTION, NOMMÉE ═══
 *
 * `espace-connecte.mjs` a BESOIN de l'API : il monte un vrai parc en appelant
 * `http://127.0.0.1:4197/api/auth/signup` à travers ce même proxy hérité. Il est
 * nommé un par un plutôt que déduit d'une règle — une exemption qui se déduit
 * s'étend toute seule.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(RACINE, 'scripts')

/**
 * Les portes qui NAVIGUENT vers des écrans applicatifs SANS session.
 *
 * Écrite plutôt que déduite d'un `grep '/app'` : `espace-connecte.mjs` et
 * `fumee.mjs` visitent `/app` eux aussi, mais AVEC un compte, et une règle
 * automatique les rangerait du mauvais côté.
 *
 * ELLE S'EST ALLONGÉE UNE FOIS DÉJÀ, ET C'EST UN AVERTISSEMENT. La première
 * rédaction n'en portait que deux — celles dont le défaut s'était MONTRÉ.
 * `poids-ecrans.mjs` s'est déclaré au passage suivant, et par un tout autre
 * symptôme : « 3 → 4 REQUÊTES » sur les huit points mesurés. Il compte toute
 * réponse dont il peut lire le corps ; le 401 de `/auth/me` en est une, et
 * `SessionProvider` enveloppe l'application entière, donc chaque écran la
 * paie. Ses plafonds avaient été inscrits API éteinte.
 *
 * DEUX SYMPTÔMES OPPOSÉS POUR UNE SEULE CAUSE : un `<main>` qui apparaît, une
 * requête qui apparaît. Rien ne dit qu'il n'existe pas un troisième symptôme
 * dans une porte que la chaîne n'a pas encore refusée. Cette liste est donc
 * un CONSTAT, pas une preuve d'exhaustivité.
 *
 * ═══ ET ELLE S'EST RACCOURCIE, CE QUI COMPTE AUTANT ═══
 *
 * `poids-ecrans.mjs` y a figuré, puis en est SORTI — pas parce que son défaut
 * n'existait pas, mais parce que le remède était pire. `contexte.route()`
 * DÉSACTIVE LE CACHE HTTP du contexte, et cette porte-là mesure des incréments
 * mis en cache : `/demo/paiements` est passé de 3 404 à 785 951 octets bruts,
 * le paquet entier rechargé à chaque navigation. La coupure ne faussait pas
 * son verdict d'un cheveu, elle changeait ce qu'elle mesure.
 *
 * Elle écarte donc `/api/` À LA LECTURE, dans son compteur de réponses — même
 * fin, aucun effet de bord. L'instrument partagé n'est pas universel, et c'est
 * une mesure qui l'a dit.
 */
const PORTES_ANONYMES = ['plafond-coquille.mjs', 'mesure-ui.mjs']

/** Celles qui doivent joindre l'API, et pourquoi. */
const EXEMPTES = new Map([
  ['espace-connecte.mjs', 'monte un vrai parc de sonde par /api/auth/signup'],
])

function lire(nom: string): string {
  return readFileSync(join(SCRIPTS, nom), 'utf8')
}

describe('les portes qui mesurent sans session', () => {
  it.each(PORTES_ANONYMES)('%s coupe l’API locale', (nom) => {
    const source = lire(nom)
    expect(
      source.includes("from './api-locale-neutralisee.mjs'"),
      `${nom} ne coupe pas l’API : son verdict dépendra de ce qui tourne sur la machine.`,
    ).toBe(true)
    expect(source).toMatch(/neutraliserLApiLocale\s*\(/)
  })

  it.each(PORTES_ANONYMES)('%s la coupe sur CHACUN de ses contextes', (nom) => {
    const source = lire(nom)
    const contextes = source.match(/newContext\(/g)?.length ?? 0
    const coupures = source.match(/neutraliserLApiLocale\s*\(/g)?.length ?? 0
    expect(contextes, `${nom} n’ouvre aucun contexte : la liste est périmée.`).toBeGreaterThan(0)
    /* Un contexte de plus sans sa coupure est le défaut que ce compte existe
       pour attraper : le script tournerait, vert, en mesurant autre chose. */
    expect(
      coupures,
      `${nom} : ${contextes} contexte(s) ouvert(s) pour ${coupures} coupure(s).`,
    ).toBe(contextes)
  })

  it('n’exempte que ce qui est nommé, et pour un motif écrit', () => {
    for (const [nom, motif] of EXEMPTES) {
      expect(motif.length, `${nom} est exemptée sans motif.`).toBeGreaterThan(20)
      expect(
        lire(nom).includes("from './api-locale-neutralisee.mjs'"),
        `${nom} est déclarée exempte mais coupe l’API : la déclaration est périmée.`,
      ).toBe(false)
    }
  })

  /**
   * GARDE DU GARDE — l'instrument existe et fait ce que son nom dit.
   *
   * Sans elle, renommer ou vider `api-locale-neutralisee.mjs` laisserait les
   * trois cas ci-dessus verts sur une chaîne de caractères qui ne coupe plus
   * rien.
   */
  it('l’instrument coupe bien /api, et par refus de connexion', () => {
    const source = lire('api-locale-neutralisee.mjs')
    expect(source).toMatch(/contexte\.route\(\s*['"]\*\*\/api\/\*\*['"]/)
    expect(
      source.includes("abort('connectionrefused')"),
      'un 401 fabriqué ferait basculer /app vers /connexion — le verdict qu’on rend impossible.',
    ).toBe(true)
  })
})
