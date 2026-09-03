/**
 * L'INVENTAIRE DES ROUTES, DÉDUIT DE LA SOURCE DU ROUTEUR.
 *
 * Un seul module, importé par les trois relevés (navigateur, sources, jetons),
 * pour qu'aucun des trois ne recopie une liste d'écrans. Une liste recopiée se
 * périme au premier écran ajouté, et le silence qu'elle produit ressemble
 * exactement à « aucun défaut » — la forme de mensonge que ce lot existe pour
 * éviter.
 *
 * DEUX FICHIERS, parce que la vitrine et l'application ne partagent plus de
 * paquet depuis le découpage paresseux :
 *   - `src/App.tsx`               : les adresses publiques, `/app/*`, `/demo/*`
 *   - `src/app/EspaceApplicatif.tsx` : le détail des vingt écrans de gestion
 * Ne lire que le premier ferait tomber le compte de 23 à 8.
 *
 * CE MODULE NE MESURE RIEN. Il rend des adresses et les rôles qui y accèdent ;
 * ce qu'on en mesure vit ailleurs. C'est la frontière qui garde les trois
 * relevés disjoints.
 *
 * PIÈGE TAILWIND v4 : ce fichier est balayé par la détection automatique des
 * sources. Toute classe citée en littéral ici serait RÉELLEMENT générée dans le
 * CSS livré. Aucun motif de classe n'y est donc écrit en entier — et il n'y en
 * a aucun besoin : ce module ne lit que des routes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const RACINE = new URL('../..', import.meta.url).pathname

/**
 * Les trois rôles du produit, dans le vocabulaire du rapport.
 *
 * Lus dans `signupState.ts` plutôt que recopiés : un quatrième rôle ajouté là
 * doit faire rougir ici, pas passer sous silence avec ses écrans.
 */
export function rolesDuProduit() {
  const source = readFileSync(join(RACINE, 'src/features/auth/signupState.ts'), 'utf8')
  const ligne = source.match(/export type Role = ([^\n]+)/)
  if (!ligne) throw new Error("routes : `export type Role` introuvable dans signupState.ts.")
  return [...ligne[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
}

/** owner/manager/tenant → ARBITRE/OPÈRE/CONSULTE, le vocabulaire du rapport. */
const NOM_DU_ROLE = { owner: 'ARBITRE', manager: 'OPÈRE', tenant: 'CONSULTE' }

export function nommerRoles(roles) {
  return roles.map((r) => {
    const nom = NOM_DU_ROLE[r]
    if (!nom) throw new Error(`routes : rôle « ${r} » sans nom de rapport. Complétez NOM_DU_ROLE.`)
    return nom
  })
}

/**
 * LA TABLE DES RÔLES, LUE LÀ OÙ ELLE VIT MAINTENANT.
 *
 * ═══ CE QUE CE MODULE A LU DE TRAVERS PENDANT UN LOT ENTIER ═══
 *
 * Les routes portaient `allow={['owner','manager']}`, et c'est ce que le motif
 * ci-dessous cherchait. Depuis `a320d4b`, elles portent `adresse="parc"` et la
 * liste vit dans `src/app/adressesParRole.ts` — parce que la CONNEXION avait
 * besoin de la même, et que « deux listes finiraient par diverger ».
 *
 * Le motif n'a pas cessé de fonctionner : il a cessé de TROUVER. `allow` absent
 * valait déjà « les trois rôles », qui est le repli légitime d'un écran sans
 * garde. Les quinze écrans de gestion se sont donc mis à s'annoncer ouverts à
 * tous, `decisions` comme `mon-espace`, et le rapport d'inventaire l'imprimait
 * sans que rien ne rougisse. C'est la forme exacte de panne que l'en-tête de ce
 * fichier promet d'éviter — « le silence qu'elle produit ressemble exactement à
 * “aucun défaut” » — et elle est passée par la porte que ce fichier garde.
 *
 * Trouvé en écrivant `espace-connecte.mjs`, à la première lecture : trois rôles
 * sur quinze écrans, y compris ceux dont ce dépôt vient de réparer le refus.
 *
 * ═══ LA GARDE QUI EMPÊCHE QUE ÇA RECOMMENCE ═══
 *
 * Le repli « pas de garde → les trois rôles » est ce qui a rendu la panne
 * silencieuse : on ne peut pas distinguer « écran ouvert » de « lecture
 * cassée » quand les deux rendent la même chose. On les distingue donc AVANT :
 * une route enveloppée de `<Restricted>` ou de `<Locataire>` DOIT nommer une
 * adresse que la table connaît, sinon on lève. Le repli ne couvre plus que les
 * routes qui n'ont visiblement aucun garde.
 */
function tableDesRoles() {
  const source = readFileSync(join(RACINE, 'src/app/adressesParRole.ts'), 'utf8')
  const bloc = source.match(/ROLES_PAR_ADRESSE[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!bloc) {
    throw new Error(
      "routes : `ROLES_PAR_ADRESSE` introuvable dans src/app/adressesParRole.ts. " +
        "Sans elle, tout écran réservé s'annoncerait ouvert à tous.",
    )
  }
  const table = new Map()
  for (const m of bloc[1].matchAll(/^\s*'?([\w-]+)'?\s*:\s*\[([^\]]*)\]/gm)) {
    table.set(m[1], [...m[2].matchAll(/'([a-z]+)'/g)].map((x) => x[1]))
  }
  if (table.size === 0) {
    throw new Error('routes : `ROLES_PAR_ADRESSE` lue VIDE — la lecture est cassée, pas le produit.')
  }
  return table
}

/**
 * Les écrans de gestion, avec le garde qui les protège.
 *
 * Trois formes dans la source, et une seule sert de vérité :
 *   `<Route path="x" element={<Restricted adresse="x">…`  → les rôles de la table
 *   `<Route path="x" element={<Locataire adresse="x">…`   → idem
 *   `<Route path="x" element={<Vitrine>…`                 → démonstration seule
 *   `<Route path="x" element={<Écran />} />`              → les trois rôles
 * Le `element=` est lu jusqu'à la fermeture de la `<Route>`, sur une ligne ou
 * sur six : `parc/:unitId` s'écrit sur six lignes dans la source, et un motif
 * mono-ligne l'aurait manqué sans rien dire.
 */
function routesInternes(tousLesRoles) {
  const source = readFileSync(join(RACINE, 'src/app/EspaceApplicatif.tsx'), 'utf8')
  const table = tableDesRoles()
  const trouvees = []

  for (const m of source.matchAll(/<Route\s+path="([^"]+)"([\s\S]*?)\/>\s*(?:\n|$)/g)) {
    const [, chemin, corps] = m
    const garde = corps.match(/<(?:Restricted|Locataire)\s+adresse="([^"]+)"/)
    const vitrine = /<Vitrine[\s>]/.test(corps)

    if (garde && !table.has(garde[1])) {
      throw new Error(
        `routes : la route « ${chemin} » est gardée sur l'adresse « ${garde[1]} », que ` +
          "`ROLES_PAR_ADRESSE` ne connaît pas. Un écran absent de la table n'ouvre à personne " +
          "dans le produit, et s'annoncerait ouvert à TOUS ici.",
      )
    }

    const roles = garde ? table.get(garde[1]) : [...tousLesRoles]
    trouvees.push({ chemin, roles, vitrine })
  }

  // `index` ne porte pas de `path=` : c'est `/demo` nu, et c'est un écran.
  if (/<Route\s+index\b/.test(source)) trouvees.unshift({ chemin: '', roles: [...tousLesRoles], vitrine: false })

  /*
    GARDE DU GARDE — au moins un écran RÉSERVÉ, ou la lecture est cassée.

    C'est le contrôle qui manquait. `allow=` a disparu des routes sans que rien
    ne bouge, parce que « aucun écran réservé » et « je ne sais plus les lire »
    rendaient le même résultat. Le produit en compte huit ; en exiger un seul
    suffit à séparer les deux cas sans faire de ce nombre une prose à entretenir.
  */
  if (!trouvees.some((r) => r.roles.length < tousLesRoles.length)) {
    throw new Error(
      "routes : AUCUN écran de gestion ne s'annonce réservé. Le produit en compte plusieurs — " +
        "`decisions`, `mon-espace`, `parc` — donc c'est la lecture des gardes qui est cassée, " +
        'pas le routeur.',
    )
  }

  return trouvees
}

/**
 * Les adresses publiques, lues dans `App.tsx`.
 *
 * Écartées : les chemins à paramètre (`:role`), le joker `*`, et les frontières
 * paresseuses `/app/*` et `/demo/*` — ce ne sont pas des adresses qu'un
 * navigateur visite telles quelles. `/app` et `/demo` reviennent plus bas.
 */
function routesPubliques() {
  const source = readFileSync(join(RACINE, 'src/App.tsx'), 'utf8')
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((c) => c.startsWith('/') && !c.includes(':') && c !== '*' && !c.endsWith('/*'))
}

/**
 * `KitchenSink` est hors produit — même arbitrage que `check-i18n.mjs`, qui
 * l'exempte nommément, et que `mesure-ui.mjs`, qui l'exclut de son balayage :
 * une page qui aligne tous les composants côte à côte n'a pas de mise en page à
 * défendre, et personne ne l'ouvre.
 */
const HORS_PRODUIT = ['/kitchen-sink']

/** L'écran 404 : sa route est `*`, écartée ci-dessus, mais l'écran se visite. */
const ADRESSE_404 = '/adresse-qui-n-existe-pas'

/**
 * LE PLANCHER, et il colle au réel plutôt que de flotter loin dessous.
 *
 * Asymétrique par construction : ajouter une route fait monter le compte et ne
 * dérange personne ; en retirer une le fait tomber et arrête tout. C'est la
 * seule direction où l'on veuille une alarme, parce qu'un écran sorti du champ
 * de la mesure se lit « aucun défaut » alors qu'il veut dire « pas regardé ».
 *
 * PASSÉ DE 23 À 24 LE 2026-09-03. Le produit avait gagné un écran depuis le
 * 2026-08-22 et ce plancher ne l'avait pas suivi : il flottait donc À UN ÉCRAN
 * SOUS LE RÉEL, ce que son premier paragraphe interdit. Un écran pouvait sortir
 * du champ sans que rien ne tombe. Trouvé en cherchant pourquoi `releve-refonte`
 * refusait son propre relevé, et non par une alarme — c'est le défaut d'un
 * plancher : il ne dit jamais qu'il a vieilli.
 */
export const ROUTES_ATTENDUES = 24

/**
 * @returns {{adresse: string, roles: string[], origine: string, vitrine: boolean}[]}
 */
export function inventaireDesRoutes() {
  const tousLesRoles = rolesDuProduit()
  if (tousLesRoles.length === 0) {
    throw new Error("routes : aucun rôle lu dans signupState.ts — la lecture est cassée, pas le produit.")
  }

  const table = new Map()
  const ajouter = (adresse, roles, origine, vitrine = false) => {
    if (HORS_PRODUIT.includes(adresse)) return
    if (!table.has(adresse)) table.set(adresse, { adresse, roles, origine, vitrine })
  }

  for (const c of routesPubliques()) ajouter(c, [...tousLesRoles], 'src/App.tsx')

  // Les frontières elles-mêmes : ce sont elles qu'un navigateur atteint.
  ajouter('/app', [...tousLesRoles], 'src/App.tsx')
  ajouter('/demo', [...tousLesRoles], 'src/App.tsx')

  // Les écrans de gestion sont montés sous `/app` ET `/demo` ; `/demo` est la
  // seule des deux qui serve un parc complet sans authentification, donc la
  // seule qu'un navigateur puisse mesurer sans compte.
  for (const { chemin, roles, vitrine } of routesInternes(tousLesRoles)) {
    if (chemin.startsWith('/') || chemin.includes(':') || chemin === '*') continue
    if (chemin === '') continue // déjà couvert par `/demo`
    ajouter(`/demo/${chemin}`, roles, 'src/app/EspaceApplicatif.tsx', vitrine)
  }

  ajouter(ADRESSE_404, [...tousLesRoles], 'src/App.tsx (route `*`)')

  return [...table.values()]
}

/**
 * GARDE DU GARDE — appelée par tout relevé qui part de cet inventaire.
 *
 * ZÉRO route, ou moins de routes qu'hier, doit REFUSER. Un inventaire vide qui
 * rendrait « aucun défaut » serait la panne la plus grave que ce lot puisse
 * produire : le rapport aurait l'air propre parce qu'il n'aurait rien lu.
 */
export function exigerUnInventairePlein(routes) {
  if (routes.length === 0) {
    throw new Error(
      "inventaire : ZÉRO route lue dans le routeur. Ce n'est pas « aucun défaut », c'est une lecture " +
        'cassée. Vérifiez `src/App.tsx` et `src/app/EspaceApplicatif.tsx`, ou le motif `<Route path=…>` ' +
        'de scripts/inventaire/routes.mjs.',
    )
  }
  if (routes.length < ROUTES_ATTENDUES) {
    throw new Error(
      `inventaire : ${routes.length} routes lues, moins que les ${ROUTES_ATTENDUES} attendues. ` +
        `Un écran est sorti du champ — ce n'est pas une absence de défaut. ` +
        `Lues : ${routes.map((r) => r.adresse).join(', ')}`,
    )
  }
  return routes
}

/**
 * LES ÉCRANS DE L'ESPACE CONNECTÉ, avec le rôle qui y a droit.
 *
 * `inventaireDesRoutes` ci-dessus monte les mêmes écrans sous `/demo`, et la
 * raison est écrite là-haut : `/demo` est « la seule des deux qui serve un parc
 * complet sans authentification, donc la seule qu'un navigateur puisse mesurer
 * sans compte ». `espace-connecte.mjs` retire précisément cette contrainte — il
 * monte un vrai serveur, une vraie base, trois vrais comptes — et a donc besoin
 * de la MÊME lecture du routeur, projetée sur l'autre adresse.
 *
 * DEUX EXCLUSIONS, ET AUCUNE N'EST DE CONFORT :
 *
 *  · les écrans de VITRINE (`systeme`, `portail`). Sous `/app`, `<Vitrine>`
 *    rend `NotFoundInApp` par construction — « sous un vrai compte, ces
 *    adresses n'existent pas ». Les balayer mesurerait le 404, que
 *    `mesure-ui` tient déjà sur son adresse dédiée ;
 *  · les chemins à PARAMÈTRE. Ils ne se visitent pas tels quels ; le dossier
 *    d'un logement est ajouté à la main par la porte, avec l'identifiant que
 *    son parc de sonde vient de créer — exactement comme `mesure-ui` ajoute
 *    `/demo/parc/A1`.
 */
export function ecransDeLEspaceConnecte() {
  const tousLesRoles = rolesDuProduit()
  return routesInternes(tousLesRoles)
    .filter((r) => !r.vitrine)
    .filter((r) => !r.chemin.includes(':') && r.chemin !== '*' && !r.chemin.startsWith('/'))
    .map((r) => ({ adresse: r.chemin === '' ? '/app' : `/app/${r.chemin}`, roles: r.roles }))
}
