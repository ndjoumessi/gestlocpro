/**
 * MESURE AU NAVIGATEUR — ce qu'aucune garde de fichier ne peut voir.
 *
 * Les treize tests de `src/design-system/` lisent des FICHIERS, et chacun le
 * motive de la même façon : jsdom ne calcule ni `clamp()`, ni les couches en
 * cascade, ni `env()`, ni la moindre hauteur. C'est un choix juste, et c'est
 * aussi un plafond. Quatre défauts réels ont vécu sous ce plafond : un fanion
 * qui débordait à 320 px, un lien de 18 × 17 px qui était la seule entrée vers
 * l'écran d'un logement, un correctif qui coûtait 255 px de hauteur de tableau
 * en mobile pendant que son commentaire affirmait que « rien ne bouge », et le
 * débordement latéral que ce script garde aujourd'hui.
 *
 * Ce fichier ouvre donc un VRAI navigateur sur le VRAI paquet construit.
 *
 * SUJET DE CETTE GARDE : ce que la page fait VRAIMENT une fois peinte.
 *
 * Cinq règles. Les deux premières regardent l'USAGE — les réglages restent
 * atteignables au clavier, aucun texte ne passe sous le seuil WCAG AA. Les
 * trois suivantes regardent la MISE EN PAGE, du signal le plus tôt au symptôme
 * le plus tard — la barre de la vitrine garde du jeu, aucune rangée d'en-tête
 * ne se replie là où la place existe, aucun écran ne défile latéralement.
 *
 * L'ordre est celui-là parce qu'une mesure de pixels ne voit ni une commande
 * retirée (la retirer fait de la place) ni un texte illisible (il occupe la
 * même boîte). Une barre parfaitement rangée peut être inutilisable.
 *
 * PIÈGES HONORÉS — chacun a été payé une fois :
 *
 *  1. Le débordement ne se mesure PAS par `documentElement.scrollWidth` : cette
 *     valeur compte la largeur de mise en page des descendants d'un conteneur à
 *     défilement, et signale donc un faux positif sur tout tableau large logé
 *     dans un `overflow-x-auto` — ce que le dépôt fait partout. Le seul critère
 *     fiable est de TENTER `window.scrollTo(400, 0)` et de vérifier que
 *     `window.scrollX` est resté à 0.
 *
 *  2. On attend la disparition d'`aria-busy`, JAMAIS un délai fixe. Un délai
 *     mesure les squelettes de chargement : un premier balayage l'a fait, a
 *     rendu « aucun défaut », et le second — en attendant la donnée — a trouvé
 *     159 formes dont le lien de 18 × 17 px.
 *
 *  3. Les deux langues, parce que le défaut fondateur de cette garde
 *     n'existait qu'en anglais : « Record a payment » est plus large que
 *     « Encaisser un paiement » ne l'est en hauteur de rangée.
 *
 *  4. On redimensionne au lieu de recharger : vingt chargements au lieu de
 *     deux cent vingt. Après chaque redimensionnement on réattend `aria-busy`,
 *     parce qu'un changement de largeur peut remonter une requête.
 *
 * COMMENT LE LIRE QUAND IL ROUGIT : il nomme l'écran, la largeur, la langue,
 * et les éléments dont le bord droit dépasse la fenêtre SANS qu'aucun ancêtre
 * ne défile — c'est-à-dire les vrais coupables, pas leurs parents.
 *
 * PRÉREQUIS D'INSTALLATION : `npx playwright install chromium` une fois par
 * machine. Le paquet `playwright` n'embarque pas le navigateur.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4183
const BASE = `http://127.0.0.1:${PORT}`

/**
 * Les largeurs mesurées.
 *
 * 320 est le plancher réel du marché visé. 700-900 est la bande qui a livré
 * les deux défauts fondateurs de cette garde, et c'est justement la bande que
 * personne ne regarde : ni téléphone, ni bureau. 1440 est le poste de travail
 * du gestionnaire.
 */
const LARGEURS = [320, 360, 375, 414, 700, 768, 800, 900, 1024, 1280, 1440]

/**
 * LES DEUX LANGUES, et aucune n'est « la large » partout.
 *
 * L'anglais l'est sur les écrans de l'application — le défaut fondateur de
 * cette garde n'existait qu'en anglais. Mais sur la barre de la vitrine c'est
 * l'inverse, mesuré : 12 px de jeu en français contre 123 en anglais, parce que
 * « Essayer gratuitement » coûte 172 px là où « Start free » en coûte 92. Un
 * balayage qui n'aurait regardé qu'une des deux aurait déclaré la barre saine.
 */
const LANGUES = ['en-US', 'fr-FR']

/**
 * Les adresses sont LUES dans `App.tsx`, jamais recopiées.
 *
 * Une liste recopiée se périme en silence : `appariements.test.ts` a surveillé
 * pendant des lots trois jetons de couleur que le graphe n'employait plus.
 * Ici, un écran neuf est mesuré le jour où sa route est écrite.
 */
function adressesDeLApplication() {
  const source = readFileSync(join(RACINE, 'src/App.tsx'), 'utf8')
  const chemins = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

  const publiques = chemins.filter((c) => c.startsWith('/') && !c.includes(':') && c !== '*')
  // Les écrans de l'application sont montés sous deux adresses ; `/demo` est
  // celle qui sert un parc complet sans authentification, donc la seule
  // mesurable ici. `index` n'apparaît pas comme `path` : c'est `/demo` nu.
  const internes = chemins
    .filter((c) => !c.startsWith('/') && !c.includes(':') && c !== '*')
    .map((c) => `/demo/${c}`)

  /*
    `KitchenSink` est écarté, et le dépôt a déjà rendu cet arbitrage.

    `scripts/check-i18n.mjs` l'exempte nommément — « ses libellés décrivent les
    composants eux-mêmes et ne sont pas du produit ». Le même raisonnement vaut
    ici : une page qui aligne tous les composants côte à côte n'a pas de mise en
    page à défendre, et personne ne l'ouvre. Elle déborde à toutes les largeurs,
    ce qui n'apprend rien, et le seul fait de dresser la liste de ses coupables
    coûtait six minutes sur les huit du balayage — pour garder ce que nul
    n'utilise.

    Une exclusion, pas une tolérance : `TOLERES` couvre un débordement de
    PRODUIT qu'on assume, et il meurt avec lui. Ici l'écran entier sort du
    champ, et c'est autre chose.
  */
  const HORS_PRODUIT = ['/kitchen-sink']

  /*
    L'ÉCRAN 404 EST AJOUTÉ À LA MAIN, et c'est la seule adresse qui ne se lit pas
    dans `App.tsx`.

    Sa route est `*`, écartée plus haut avec les chemins à paramètre — pour une
    bonne raison, `*` n'étant pas une adresse qu'on puisse visiter. Mais l'écran
    qu'elle rend, lui, se visite : il suffit de se tromper de lien. Il portait la
    même rangée de sélecteurs que les écrans d'authentification, le même
    débordement de 38 px à 320, et il l'a gardé plus longtemps qu'eux
    précisément parce que rien ne le regardait.

    N'importe quelle adresse inexistante le rend ; celle-ci le dit en toutes
    lettres, pour que le rapport d'échec se lise sans avoir à deviner.
  */
  const ADRESSE_404 = '/adresse-qui-n-existe-pas'

  const adresses = [
    ...new Set([...publiques.filter((c) => c !== '/demo'), '/demo', ...internes, ADRESSE_404]),
  ].filter((c) => !HORS_PRODUIT.includes(c))

  /*
    Garde du garde, et le plancher COLLE au réel plutôt que de flotter loin
    dessous.

    Il valait 20 pour 22 écrans : il n'attrapait qu'une lecture d'`App.tsx`
    entièrement cassée, et laissait retirer deux écrans du balayage en silence.
    Or c'est exactement ce qui a maintenu le 404 hors de toute mesure pendant
    des lots — un écran qu'aucun défaut ne pouvait plus atteindre parce que
    personne ne le regardait.

    Serré, il ne peut rougir que dans un sens : ajouter une route fait monter le
    compte et ne dérange personne, en retirer une le fait tomber et arrête tout.
    C'est la seule asymétrie qu'on veuille ici.
  */
  const ATTENDUES = 23

  if (adresses.length < ATTENDUES) {
    throw new Error(
      `mesure-ui : ${adresses.length} adresses balayées, moins que les ${ATTENDUES} attendues. ` +
        `Un écran est sorti du champ de la mesure — ce n'est pas une absence de défaut.`,
    )
  }
  return adresses
}

/**
 * LE CONTRASTE SE MESURE ICI PARCE QUE C'EST ICI QUE LE NAVIGATEUR EST OUVERT.
 *
 * `scripts/contrast-audit.js` sait trouver un texte sous le seuil WCAG AA
 * depuis des lots. Aucune porte ne le lançait : c'était un outil de console,
 * qu'il fallait penser à coller. Le commentaire de `TOLERES`, plus bas, le cite
 * déjà comme LA démonstration du dépôt qu'une garde hors de `check` ne
 * s'exécute jamais. Il avait raison, et il se citait lui-même : au premier
 * passage automatique, l'audit a trouvé le fanion « Démonstration » à 3,93 pour
 * 4,5 requis — une encre dont `tokens.css` certifiait « 4.98 sur --paper », et
 * que le fanion posait sur un tout autre fond.
 *
 * ON LIT LE FICHIER, ON NE LE RECOPIE PAS. Une copie dériverait en silence de
 * l'outil que la console emploie encore, et les deux se contrediraient sans que
 * personne l'apprenne. La forme du retour est le contrat, écrit là-bas.
 *
 * POURQUOI DEUX THÈMES. La moitié des jetons ne vivent qu'en sombre — `warn`
 * y vaut #e0b877 sur #54421f, aucun de ces deux-là n'existant en clair. Ne
 * mesurer qu'un thème, c'est ne mesurer qu'une palette sur deux.
 *
 * POURQUOI DEUX LARGEURS ET PAS ONZE. Le contraste ne dépend pas de la
 * géométrie : entre 360 et 375, aucune couleur ne change, et onze largeurs
 * porteraient la porte à un quart d'heure pour redire onze fois la même chose.
 * Mais il n'en faut pas qu'UNE : à 1280 la barre basse de l'espace connecté,
 * le panneau du menu et les variantes compactes ne sont pas rendus du tout, et
 * ce qui n'est pas rendu n'est pas mesuré. Une largeur de poche, une de bureau.
 */
const THEMES = ['light', 'dark']
const LARGEURS_CONTRASTE = [360, 1280]

/**
 * Contrastes TOLÉRÉS, même doctrine que `TOLERES` : nommés, motivés, mortels.
 *
 * Clé : le texte relevé, tronqué comme l'audit le tronque. AUCUNE ENTRÉE, et
 * c'est le but — la garde du garde plus bas fait rougir celle qui ne couvre
 * plus rien, donc aucune ne peut survivre au défaut qu'elle couvrait.
 */
const CONTRASTES_TOLERES = {
}

/**
 * Débordements TOLÉRÉS, avec leur raison écrite.
 *
 * Sur le modèle des `EXEMPTIONS` de `cibles.test.ts` : une dérogation se nomme,
 * se motive, et meurt avec le défaut qu'elle couvrait — la garde du garde plus
 * bas fait rougir toute entrée devenue orpheline.
 *
 * Clé : `adresse@largeur`, indépendante de la langue — un débordement qui
 * n'existe qu'en anglais reste le même défaut de mise en page.
 *
 * AUCUNE ENTRÉE, et c'est le but. Une dette datée s'écrit ici avec sa mesure et
 * le lot qui la lèvera ; il n'en reste plus. Chacune porte sa mesure
 * et le lot qui la lèvera ; la garde du garde plus bas fait rougir celle qui ne
 * couvre plus rien, donc aucune ne peut survivre à sa réparation. Elles sont
 * ici parce qu'une garde hors de `check` ne s'exécute jamais — l'audit en fait
 * la démonstration avec `contrast-audit.js`, qui savait trouver un contraste
 * sous le seuil et ne l'a jamais trouvé faute d'être lancé.
 */
const TOLERES = {
}

/**
 * Les attentes, et ce qu'elles coûtent quand elles échouent.
 *
 * Chaque `.catch(() => {})` avale un dépassement de délai : c'est voulu — un
 * écran qui ne se stabilise pas doit être MESURÉ tel quel, pas faire échouer le
 * balayage. Mais avalé en silence, un dépassement de quinze secondes se paie
 * douze fois par langue sur le même écran, et le balayage entier passe de
 * quelques minutes à une demi-heure sans qu'on sache pourquoi.
 *
 * On compte donc les dépassements et on les rend à la fin. Un écran dont
 * l'`aria-busy` ne s'éteint jamais est d'ailleurs un DÉFAUT en soi, que ce
 * compteur nomme au lieu de le laisser peser sur l'horloge.
 */
const lenteurs = new Map()

const attendre = async (page, ou) => {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => marquer(ou, 'réseau'))
  // `waitForFunction(fonction, ARGUMENT, options)` : le deuxième paramètre est
  // l'argument passé à la fonction, PAS les options. Écrit en deuxième position,
  // `{ timeout }` partait donc à une fonction qui n'attend rien, et le délai par
  // défaut de trente secondes s'appliquait — douze attentes par écran, six
  // minutes sur toute page qui ne se stabilise pas. Trois pages s'y sont
  // arrêtées au dixième de seconde près, ce qui a trahi le plafond ; sans le
  // `null`, ces délais ne sont pas des délais, ce sont des commentaires.
  await page
    .waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, {
      timeout: 5000,
    })
    .catch(() => marquer(ou, 'chargement'))
  await page
    .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 3000 })
    .catch(() => marquer(ou, 'polices'))
}

function marquer(ou, quoi) {
  const cle = `${ou} — ${quoi}`
  lenteurs.set(cle, (lenteurs.get(cle) ?? 0) + 1)
}

/**
 * La largeur À PARTIR DE LAQUELLE une barre d'en-tête ne doit plus se replier.
 *
 * 1280 px : c'est le plafond de la bande (`max-w-7xl`), donc la largeur au-delà
 * de laquelle élargir la fenêtre ne donne plus un pixel de plus au contenu. Si
 * la barre se replie là, elle se repliera à toutes les largeurs supérieures.
 */
const LARGEUR_SANS_REPLI = 1280

/*
  GARDE DU GARDE : le seuil doit tomber dans les largeurs balayées.

  Porté au-delà de la plus large, il viderait la règle sans que rien ne
  rougisse — la porte dirait « aucun en-tête replié » en n'ayant regardé aucune
  largeur. C'est la panne qu'`ATTENDUES` surveille déjà pour la liste des
  adresses, et pour la même raison : une absence de défaut et une absence de
  mesure se ressemblent trop dans un journal.
*/
if (!LARGEURS.some((l) => l >= LARGEUR_SANS_REPLI)) {
  console.error(
    `\n✗ mesure-ui : aucune largeur balayée n'atteint ${LARGEUR_SANS_REPLI} px.\n` +
      "   La règle du repli ne s'exécuterait jamais — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/**
 * LE JEU MINIMAL que la rangée de l'en-tête public doit garder.
 *
 * POURQUOI UN SEUIL, alors que deux règles gardent déjà cette rangée. Les deux
 * ne rougissent qu'une fois le défaut ARRIVÉ : le débordement quand la page
 * défile de côté, le repli quand la barre s'empile. Mesuré juste avant ce lot,
 * la rangée passait les deux au vert avec DOUZE pixels de jeu en français —
 * 1204 px occupés pour 1216 disponibles. Elle tenait parce que la porte l'y
 * obligeait, pas parce qu'elle avait de la place, et le prochain libellé
 * traduit un peu long la faisait basculer. Une porte verte jusqu'à la seconde
 * où elle casse ne dit rien de l'état du système ; elle dit seulement qu'on
 * n'a pas encore payé.
 *
 * D'OÙ VIENT 120. Après le retrait des trois sélecteurs, la mesure donne 498 px
 * de jeu en anglais et 362 en français — le français est la langue serrée ici,
 * ses deux boutons d'inscription coûtant 297 px contre 174 à l'anglais. Le plus
 * étroit des éléments que la barre porte encore est le bouton « Se connecter »,
 * 117 px. Le seuil dit donc : la barre garde toujours de quoi accueillir un
 * élément de la taille du plus petit qu'elle porte déjà. En dessous, elle est à
 * une traduction près du repli — l'état exact d'où ce lot la sort.
 *
 * SA CONTREPARTIE, et elle est réelle : un ajout LÉGITIME qui coûterait plus de
 * 242 px en français (362 − 120) fera rougir cette porte alors que rien ne se
 * replie. Un troisième bouton de la taille d'« Essayer gratuitement » (172 px
 * plus 12 de gouttière) passe encore, avec 178 px de reste ; deux ne passent
 * pas. Le seuil n'interdit pas d'ajouter : il interdit d'ajouter EN SILENCE. Le
 * relever se fait ici, avec la mesure du jour et la raison écrite — ce qui est
 * précisément la décision qui n'a jamais été prise quand la barre est descendue
 * à douze pixels.
 */
const JEU_MINIMAL = 120

/*
  GARDE DU GARDE : un seuil nul ou négatif est un seuil qui ne sert à rien.

  À zéro, la règle ne rougit qu'une fois la somme des enfants passée au-delà de
  la bande — c'est-à-dire au moment même où `MESURER_REPLI` rougit déjà. Elle
  aurait l'air d'une anticipation et n'en serait pas une : deux formulations du
  même constat tardif, dont l'une donne l'impression d'être couverte en amont.

  Le haut n'a pas besoin de garde symétrique : un seuil démesuré rend la porte
  PLUS stricte, il fait rougir immédiatement et bruyamment, et se corrige de
  lui-même. C'est le bas qui sait se taire, et c'est le silence qu'on garde.
*/
if (JEU_MINIMAL <= 0) {
  console.error(
    `\n✗ mesure-ui : le jeu minimal vaut ${JEU_MINIMAL}.\n` +
      "   À zéro ou moins, la règle ne devance plus le repli — elle le double.\n",
  )
  process.exit(1)
}

/**
 * Exécuté DANS la page : rend le jeu restant sur la rangée de l'en-tête public.
 *
 * LA RANGÉE SE DÉSIGNE, elle ne se devine pas. Un plancher en pixels n'a de
 * sens que sur une rangée BORNÉE PAR UNE BANDE — ici `max-w-7xl`, qui fige la
 * largeur utile à 1216 px dès 1280, donc le jeu y est une constante par langue.
 * Les rangées d'en-tête des écrans d'authentification, elles, sont en
 * `ml-auto … justify-end` : elles épousent leur contenu, et leur jeu vaut zéro
 * par construction — vérifié sur les 21 écrans qui les portent. Balayer « toute
 * rangée d'en-tête » ferait donc rougir vingt-et-un écrans qui n'ont jamais eu
 * de place à perdre. D'où le marqueur, posé dans `PublicHeader.tsx`.
 *
 * Rend `null` sur les écrans sans en-tête public : ce n'est pas un manque, la
 * plupart des adresses balayées sont des écrans de l'application. C'est le
 * compteur plus bas qui distingue « absent ici » de « disparu partout ».
 */
const MESURER_JEU = () => {
  const rangee = document.querySelector('[data-mesure="rangee-entete-vitrine"]')
  if (!rangee) return null

  const style = getComputedStyle(rangee)
  const boite = rangee.getBoundingClientRect()
  const dispo = boite.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
  const gouttiere = parseFloat(style.columnGap) || 0

  const enfants = [...rangee.children]
    .filter((e) => getComputedStyle(e).display !== 'none')
    .map((e) => ({
      largeur: Math.round(e.getBoundingClientRect().width),
      nom: e.tagName.toLowerCase(),
    }))
    .filter((e) => e.largeur > 0)
  if (enfants.length === 0) return null

  const occupe = enfants.reduce((a, e) => a + e.largeur, 0) + gouttiere * (enfants.length - 1)
  return {
    jeu: Math.round(dispo - occupe),
    dispo: Math.round(dispo),
    gouttieres: Math.round(gouttiere * (enfants.length - 1)),
    enfants,
  }
}

/**
 * Exécuté DANS la page : les réglages sont-ils atteignables AU CLAVIER ?
 *
 * C'est la dette que contracte le retrait des sélecteurs de la barre. Les
 * confier au menu n'est une simplification que tant que le menu s'ouvre ; le
 * bouton qui l'ouvre portait `xl:hidden`, et le laisser tel quel aurait rendu
 * langue et thème INATTEIGNABLES au-delà de 1280 px. Ce n'aurait pas été une
 * barre allégée, ç'aurait été des réglages perdus — et aucune des trois autres
 * règles de ce fichier ne sait voir une commande absente.
 *
 * AU CLAVIER et non par sélecteur CSS : `display: none` se lit dans le DOM,
 * mais un bouton visible qu'aucune tabulation n'atteint est le même défaut pour
 * qui n'a pas de souris. On part donc du début du document et on tabule.
 */
const PLAFOND_TABULATIONS = 24

/**
 * Rend le grief, ou `null` si les réglages sont atteints.
 *
 * ON NE DÉSIGNE PAS LE BOUTON DU MENU, on cherche ce qui OUVRE LES RÉGLAGES —
 * et la nuance a été payée. Une première version prenait le premier élément
 * focalisable de l'en-tête portant `aria-expanded` : elle est tombée sur le
 * sélecteur de devise, qui en porte un lui aussi, a déplié sa liste, et a
 * rapporté que le panneau des réglages n'existait pas. Un grief exact sur un
 * fait faux — le pire genre, celui qu'on croit.
 *
 * On essaie donc CHAQUE déclencheur rencontré et on retient celui qui rend les
 * réglages visibles, en refermant les autres derrière soi. C'est exactement ce
 * que fait quelqu'un qui cherche où régler sa langue.
 */
async function reglagesAtteignables(page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await attendre(page, '/ (clavier)')
  // Repartir du tout début : sans cela la tabulation continue d'où le
  // chargement a laissé le focus, et le compte de tabulations ne veut rien dire.
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )

  const ETAT = () => {
    const actif = document.activeElement
    const bloc = document.querySelector('[data-mesure="reglages-vitrine"]')
    const boite = bloc?.getBoundingClientRect()
    return {
      declencheur: !!(actif && actif.closest('header') && actif.hasAttribute('aria-expanded')),
      ouverts: !!(boite && boite.width > 0 && boite.height > 0),
      commandes: bloc ? bloc.querySelectorAll('button, select, a[href]').length : 0,
    }
  }

  let essayes = 0
  let etat = null
  for (let i = 0; i < PLAFOND_TABULATIONS; i++) {
    await page.keyboard.press('Tab')
    etat = await page.evaluate(ETAT)
    if (!etat.declencheur) continue

    essayes++
    await page.keyboard.press('Enter')
    etat = await page.evaluate(ETAT)
    if (etat.ouverts) break
    // Refermer ce qui vient de s'ouvrir — une liste déroulante laissée
    // dépliée capte les tabulations suivantes et fausse la suite du parcours.
    await page.keyboard.press('Escape')
    etat = null
  }

  if (!etat?.ouverts) {
    return (
      `réglages non ouverts après ${PLAFOND_TABULATIONS} tabulations depuis le début du document ` +
      `(${essayes} déclencheur(s) essayé(s))`
    )
  }
  if (etat.commandes < 3) {
    return `le bloc des réglages ne porte que ${etat.commandes} commande(s) sur les 3 attendues`
  }

  // Visible ne suffit pas : une commande qu'aucune tabulation n'atteint est
  // absente pour qui n'a pas de souris, et c'est tout le sujet de ce contrôle.
  let dedans = false
  for (let i = 0; i < PLAFOND_TABULATIONS && !dedans; i++) {
    await page.keyboard.press('Tab')
    dedans = await page.evaluate(
      () => !!document.activeElement?.closest('[data-mesure="reglages-vitrine"]'),
    )
  }
  if (!dedans) {
    return `réglages ouverts mais aucune de leurs commandes atteinte en ${PLAFOND_TABULATIONS} tabulations`
  }
  return null
}

/**
 * Exécuté DANS la page : rend la rangée d'en-tête repliée, ou `null`.
 *
 * POURQUOI UNE SECONDE MESURE. Celle du débordement ne pouvait pas voir ce
 * défaut-là, et l'a même masqué : `flex-wrap` a été posé sur la barre de la
 * vitrine pour supprimer un débordement à 1280, ce qu'il a fait — en empilant
 * la barre sur deux rangées. La porte est passée au vert pendant que l'en-tête
 * doublait de hauteur sur un portable ordinaire, mesuré à 131 px.
 *
 * Le repli reste le bon filet : il vaut mieux deux rangées qu'une page qui
 * défile de côté. Ce qu'on interdit, c'est qu'il se déclenche là où la place
 * existe, c'est-à-dire qu'on s'en serve pour ne pas faire entrer le contenu.
 *
 * Le nombre de rangées se lit par les BOÎTES, jamais par `flexWrap` : la classe
 * dit ce qui est permis, pas ce qui arrive. Un enfant dont le haut atteint le
 * bas d'un autre commence une rangée nouvelle — la tolérance d'un pixel écarte
 * les arrondis, et `items-center` suffit à décaler des enfants de hauteurs
 * différentes sans qu'ils changent de rangée pour autant.
 */
const MESURER_REPLI = () => {
  const replies = []
  for (const entete of document.querySelectorAll('header')) {
    for (const rangee of entete.querySelectorAll('*')) {
      const style = getComputedStyle(rangee)
      if (style.display !== 'flex' || style.flexWrap !== 'wrap') continue

      const boites = [...rangee.children]
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0)
      if (boites.length < 2) continue

      const empile = boites.some((a) => boites.some((b) => a.top >= b.bottom - 1))
      if (!empile) continue

      replies.push({
        classes: typeof rangee.className === 'string' ? rangee.className.slice(0, 110) : '',
        hauteur: Math.round(entete.getBoundingClientRect().height),
        enfants: boites.map((b) => Math.round(b.width)),
      })
    }
  }
  return replies.length > 0 ? replies : null
}

/** Exécuté DANS la page : rend les coupables, ou `null` si rien ne déborde. */
const MESURER = () => {
  const avant = window.scrollX
  window.scrollTo(400, 0)
  const decalage = window.scrollX
  window.scrollTo(avant, 0)
  if (!decalage) return null

  const largeurVue = document.documentElement.clientWidth
  const coupables = []
  for (const el of document.querySelectorAll('*')) {
    const boite = el.getBoundingClientRect()
    if (boite.width === 0) continue
    if (boite.right <= largeurVue + 1) continue

    // Un élément large À L'INTÉRIEUR d'un conteneur qui défile n'est pas un
    // coupable : c'est le motif normal des tableaux du dépôt.
    let ancetre = el.parentElement
    let contenu = false
    while (ancetre) {
      const debordement = getComputedStyle(ancetre).overflowX
      if (debordement === 'auto' || debordement === 'scroll' || debordement === 'hidden') {
        contenu = true
        break
      }
      ancetre = ancetre.parentElement
    }
    if (contenu) continue

    coupables.push({
      balise: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className.slice(0, 110) : '',
      largeur: Math.round(boite.width),
      bordDroit: Math.round(boite.right),
      texte: (el.textContent || '').trim().slice(0, 44),
    })
  }
  return { decalage, largeurVue, coupables: coupables.slice(0, 6) }
}

/** Construit le paquet : la garde mesure ce qui sera livré, pas les sources. */
function construire() {
  return new Promise((resolve, reject) => {
    const fils = spawn('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: RACINE })
    let erreur = ''
    fils.stderr.on('data', (d) => (erreur += d))
    fils.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build a échoué :\n${erreur}`)))) 
  })
}

/** Sert le paquet, et rend de quoi l'arrêter quoi qu'il arrive ensuite. */
async function servir() {
  const fils = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: RACINE,
    stdio: 'ignore',
  })
  for (let essai = 0; essai < 60; essai++) {
    try {
      const reponse = await fetch(BASE + '/')
      if (reponse.ok) return fils
    } catch {
      /* Le serveur n'écoute pas encore. */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  fils.kill()
  throw new Error(`mesure-ui : le serveur de prévisualisation n'a pas répondu sur ${BASE}`)
}

const adresses = adressesDeLApplication()

/*
  LU AU DÉMARRAGE, avant le build : si le fichier a disparu ou n'est plus
  lisible, on veut l'apprendre en une seconde et non après trois minutes de
  balayage. `readFileSync` jette de lui-même, et c'est le comportement voulu.
*/
const AUDIT_CONTRASTE = readFileSync(join(RACINE, 'scripts/contrast-audit.js'), 'utf8')

await construire()
const serveur = await servir()
const echecs = []
const reproches = []
const etroitesses = []
const inatteignables = []
// Compte les rangées d'en-tête public RÉELLEMENT mesurées. Le marqueur retiré,
// `MESURER_JEU` rendrait `null` partout et la porte dirait « aucune barre trop
// serrée » sans en avoir regardé une seule — la panne qu'`ATTENDUES` surveille
// déjà pour la liste des adresses, et la garde du garde plus bas pour le seuil.
let rangeesMesurees = 0
const tolerancesUtilisees = new Set()

const contrastes = new Map()
const contrastesTolerancesUtilisees = new Set()
// Même raison qu'`ATTENDUES` et que `rangeesMesurees` : « aucun texte sous le
// seuil » et « aucun texte regardé » s'écrivent pareil dans un journal.
let textesAudites = 0
// Le fond du corps par thème. Si les deux thèmes rendent la même chose, la
// moitié sombre du balayage n'est qu'un décor — voir la garde du garde.
const fondsParTheme = new Map()

try {
  const navigateur = await chromium.launch()
  for (const langue of LANGUES) {
    const contexte = await navigateur.newContext({
      viewport: { width: LARGEURS[0], height: 900 },
      locale: langue,
    })
    const page = await contexte.newPage()
    for (const adresse of adresses) {
      // Le balayage DIT où il en est. Sans cela il reste muet une demi-heure,
      // et rien ne distingue « il travaille » de « il est bloqué » — l'état
      // dans lequel on désactive une porte plutôt que de la lire.
      const depart = Date.now()
      process.stdout.write(`   ${langue}  ${adresse} … `)
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
      await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
      await attendre(page, adresse)
      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await attendre(page, adresse)
        if (largeur >= LARGEUR_SANS_REPLI) {
          const replis = await page.evaluate(MESURER_REPLI)
          if (replis) for (const r of replis) reproches.push({ adresse, largeur, langue, ...r })

          // Au-delà de la bande, la largeur utile ne bouge plus : c'est là, et
          // là seulement, qu'un plancher en pixels veut dire quelque chose. En
          // dessous, la bande suit la fenêtre et le jeu doit pouvoir fondre.
          const place = await page.evaluate(MESURER_JEU)
          if (place) {
            rangeesMesurees++
            if (place.jeu < JEU_MINIMAL) etroitesses.push({ adresse, largeur, langue, ...place })
          }
        }

        const resultat = await page.evaluate(MESURER)
        if (!resultat) continue
        const cle = `${adresse}@${largeur}`
        if (TOLERES[cle]) {
          tolerancesUtilisees.add(cle)
          continue
        }
        echecs.push({ adresse, largeur, langue, ...resultat })
      }
      process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
    }

    // Une fois par langue, et non par écran : la barre est la même partout, et
    // la tabulation coûte un aller-retour par touche.
    process.stdout.write(`   ${langue}  réglages au clavier à 1440 px … `)
    const manque = await reglagesAtteignables(page)
    process.stdout.write(manque ? 'ÉCHEC\n' : 'ok\n')
    if (manque) inatteignables.push({ langue, manque })

    await contexte.close()
  }

  /*
    PASSE SÉPARÉE, et non une règle de plus dans la boucle ci-dessus.

    Les deux passes n'ont pas les mêmes axes : la mise en page balaie onze
    largeurs et ignore le thème (les boîtes ne changent pas de taille selon la
    couleur) ; le contraste balaie deux thèmes et se contente de deux largeurs.
    Les fondre donnerait le produit des deux — 506 arrêts au lieu de 322 — pour
    mesurer partout des choses qui ne varient que quelque part.

    Ce qu'elles PARTAGENT est ce qui coûte cher, et c'est déjà mutualisé : un
    seul `vite build`, un seul serveur, un seul navigateur.
  */
  for (const langue of LANGUES) {
    for (const theme of THEMES) {
      const contexte = await navigateur.newContext({
        viewport: { width: LARGEURS_CONTRASTE[0], height: 900 },
        locale: langue,
        colorScheme: theme,
      })
      const page = await contexte.newPage()
      for (const adresse of adresses) {
        const depart = Date.now()
        process.stdout.write(`   ${langue}  ${theme}  ${adresse} … `)
        for (const largeur of LARGEURS_CONTRASTE) {
          await page.setViewportSize({ width: largeur, height: 900 })
          // On recharge à la première largeur seulement : le reste est un
          // redimensionnement, comme dans la passe de mise en page.
          if (largeur === LARGEURS_CONTRASTE[0]) {
            await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
          }
          await attendre(page, adresse)

          if (adresse === '/' && largeur === LARGEURS_CONTRASTE[0]) {
            fondsParTheme.set(
              theme,
              await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
            )
          }

          const audit = await page.evaluate(AUDIT_CONTRASTE)
          if (!audit || typeof audit.examines !== 'number') {
            throw new Error(
              "mesure-ui : `contrast-audit.js` n'a pas rendu `{ failures, items, examines }`. " +
                "Son expression doit rester une IIFE qui s'évalue en cet objet.",
            )
          }
          textesAudites += audit.examines

          for (const item of audit.items) {
            // Dédupliqué sur la FORME du défaut, pas sur l'endroit : le même
            // couple encre/fond rapporté vingt fois est un seul correctif, et
            // vingt lignes de rapport cachent le deuxième défaut.
            const cle = `${item.text}|${item.color}|${item.bg}`
            if (!contrastes.has(cle)) contrastes.set(cle, { ...item, ou: `${adresse} ${largeur}px ${langue} ${theme}` })
          }
        }
        process.stdout.write(`${((Date.now() - depart) / 1000).toFixed(1)}s\n`)
      }
      await contexte.close()
    }
  }

  await navigateur.close()
} finally {
  serveur.kill()
}

/*
  LE RAPPORT DE LENTEUR SORT EN PREMIER, avant tout `process.exit`.

  Écrit après les blocs d'échec, il ne s'imprimait jamais le jour où il compte :
  celui où la porte rougit. Or c'est précisément là qu'on veut savoir si le
  balayage a duré huit minutes parce qu'un écran ne se stabilise pas.
*/
if (lenteurs.size > 0) {
  console.warn(`\n⚠ ${lenteurs.size} attente(s) dépassée(s) — un écran qui ne se stabilise pas :`)
  for (const [cle, n] of [...lenteurs].sort((a, b) => b[1] - a[1])) console.warn(`   ${n}× ${cle}`)
}

// Garde du garde : une tolérance qui ne couvre plus rien doit mourir, sinon
// la liste devient un cimetière qui blanchit des défauts à venir.
const orphelines = Object.keys(TOLERES).filter((cle) => !tolerancesUtilisees.has(cle))
if (orphelines.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${orphelines.length} tolérance(s) ne couvrent plus aucun débordement.\n` +
      orphelines.map((cle) => `   ${cle} — à retirer de TOLERES`).join('\n'),
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : le marqueur de la rangée doit avoir été TROUVÉ.

  `MESURER_JEU` rend `null` sur les écrans sans en-tête public, ce qui est
  normal — la plupart des adresses balayées sont des écrans de l'application.
  Mais il rend aussi `null` si le marqueur disparaît de `PublicHeader.tsx`, et
  la porte dirait alors « aucune barre trop serrée » en n'en ayant regardé
  aucune. Compter les rangées vues sépare les deux : c'est le même raisonnement
  qu'`ATTENDUES` pour les adresses, et il s'est déjà payé une fois.
*/
if (rangeesMesurees === 0) {
  console.error(
    "\n✗ mesure-ui : la rangée de l'en-tête public n'a été mesurée nulle part.\n" +
      '   Le marqueur `data-mesure="rangee-entete-vitrine"` a disparu — la règle du jeu\n' +
      "   minimal ne s'exécuterait jamais, et ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : l'audit doit avoir REGARDÉ quelque chose.

  Zéro texte examiné se lit « aucun contraste sous le seuil » dans le journal
  final — c'est la panne exacte que ce fichier reproche déjà à `contrast-audit`
  d'avoir subie pendant des lots, à ceci près qu'elle serait désormais SILENCIEUSE
  au lieu d'être seulement oubliée. Le seuil est volontairement grossier : on
  n'estime pas le bon nombre de textes du produit, on distingue « il a travaillé »
  de « il n'a rien vu ».
*/
const TEXTES_ATTENDUS = 500

if (textesAudites < TEXTES_ATTENDUS) {
  console.error(
    `\n✗ mesure-ui : ${textesAudites} textes audités en contraste, moins que les ${TEXTES_ATTENDUS} attendus.\n` +
      "   L'audit ne regarde plus rien — ce n'est pas une absence de défaut.\n",
  )
  process.exit(1)
}

/*
  GARDE DU GARDE : les deux thèmes doivent rendre DEUX choses.

  `colorScheme` ne force pas un thème, il pose `prefers-color-scheme` — et
  l'application est libre de ne pas le suivre. Le jour où elle cesse de le
  suivre, ou le jour où `THEMES` se retrouve à deux entrées identiques, la
  moitié sombre du balayage devient un décor : même palette mesurée deux fois,
  rapportée comme deux thèmes vérifiés. Or c'est précisément en sombre que
  vivent les jetons qu'aucun oeil ne relit.

  Le fond du corps de la page d'accueil suffit à trancher : il vaut #efebe2 en
  clair et #100e0b en sombre.
*/
const fondsDistincts = new Set(fondsParTheme.values())
if (fondsDistincts.size < THEMES.length) {
  console.error(
    `\n✗ mesure-ui : les ${THEMES.length} thèmes balayés rendent ${fondsDistincts.size} fond(s) distinct(s).\n` +
      "   Une palette mesurée deux fois n'est pas deux palettes vérifiées.\n",
  )
  for (const [theme, fond] of fondsParTheme) console.error(`   ${theme} → ${fond}`)
  console.error('')
  process.exit(1)
}

/*
  LES RÉGLAGES SORTENT AVANT TOUT LE RESTE : une commande qu'on ne peut plus
  atteindre est pire qu'une barre serrée. Les trois autres règles de ce fichier
  regardent des pixels ; celle-ci regarde une absence, et aucune des trois ne
  sait la voir — retirer un bouton fait toujours de la place.
*/
if (inatteignables.length > 0) {
  console.error(
    `\n✗ mesure-ui : les réglages de la vitrine ne sont plus atteignables au clavier à 1440 px.\n` +
      "   La barre les a confiés au menu ; le menu doit donc s'ouvrir à TOUTE largeur.\n",
  )
  for (const i of inatteignables) console.error(`   ${i.langue}  →  ${i.manque}`)
  console.error('')
  process.exit(1)
}

/*
  PUIS LE CONTRASTE : après ce qu'on ne peut pas atteindre, ce qu'on ne peut pas
  lire. Les trois règles qui suivent regardent la mise en page ; ces deux-ci
  regardent l'usage, et une barre parfaitement rangée dont le texte est
  illisible n'est pas une barre qui va bien.
*/
const contrastesOrphelins = Object.keys(CONTRASTES_TOLERES).filter(
  (cle) => !contrastesTolerancesUtilisees.has(cle),
)
if (contrastesOrphelins.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${contrastesOrphelins.length} tolérance(s) de contraste ne couvrent plus rien.\n` +
      contrastesOrphelins.map((cle) => `   ${cle} — à retirer de CONTRASTES_TOLERES`).join('\n') +
      '\n',
  )
  process.exit(1)
}

const sousLeSeuil = [...contrastes.values()]
  .filter((c) => {
    if (!CONTRASTES_TOLERES[c.text]) return true
    contrastesTolerancesUtilisees.add(c.text)
    return false
  })
  .sort((a, b) => a.ratio - b.ratio)

if (sousLeSeuil.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${sousLeSeuil.length} forme(s) de texte sous le seuil WCAG AA, sur ${textesAudites} audités.\n` +
      '   Le ratio requis vaut 3 pour du grand texte, 4,5 sinon.\n',
  )
  for (const c of sousLeSeuil) {
    console.error(`   ${c.ratio} / ${c.required}   ${c.fontSize}px poids ${c.weight}   ${JSON.stringify(c.text)}`)
    console.error(`      ${c.color} sur ${c.bg}   vu à ${c.ou}`)
  }
  console.error('')
  process.exit(1)
}

/*
  L'ORDRE DES TROIS RÈGLES VA DU SIGNAL LE PLUS TÔT AU SYMPTÔME LE PLUS TARD :
  jeu trop faible, puis repli, puis débordement.

  C'est le même raisonnement que celui qui met déjà le repli avant le
  débordement, poussé d'un cran. Le jeu nomme la CAUSE — il rend la largeur de
  chaque enfant, donc où les pixels sont partis. Le repli ne dit que « la barre
  a doublé de hauteur », le débordement que « la page défile ». Quand les trois
  rougissent ensemble, c'est le premier qu'on veut lire.
*/
if (etroitesses.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${etroitesses.length} mesure(s) où la barre de la vitrine garde moins de ${JEU_MINIMAL} px de jeu.\n` +
      "   Rien ne se replie encore : c'est justement l'état d'avant, celui qu'on veut voir.\n",
  )
  for (const e of etroitesses) {
    console.error(`   ${e.adresse}  ${e.largeur}px  ${e.langue}  →  jeu=${e.jeu}px (seuil ${JEU_MINIMAL})`)
    console.error(
      `      bande=${e.dispo}  enfants=${e.enfants.map((x) => `${x.nom}:${x.largeur}`).join(' + ')}  gouttières=${e.gouttieres}`,
    )
  }
  console.error('')
  process.exit(1)
}

/*
  LE REPLI SORT AVANT LE DÉBORDEMENT, et ce n'est pas un détail d'ordre.

  Poser `flex-wrap` supprime un débordement en créant un repli. Rapporter le
  repli en premier évite de refaire l'échange qui a produit ce défaut : lire
  « débordement », poser un repli, voir le vert, et livrer une barre deux fois
  plus haute.
*/
if (reproches.length > 0) {
  console.error(
    `\n✗ mesure-ui : ${reproches.length} rangée(s) d'en-tête repliée(s) à ${LARGEUR_SANS_REPLI} px ou plus.\n` +
      "   La place existe : c'est le contenu qui doit entrer, pas la barre qui doit s'empiler.\n",
  )
  for (const r of reproches) {
    console.error(`   ${r.adresse}  ${r.largeur}px  ${r.langue}  →  en-tête de ${r.hauteur}px`)
    console.error(`      enfants=${r.enfants.join(' + ')}  class="${r.classes}"`)
  }
  console.error('')
  process.exit(1)
}

if (echecs.length > 0) {
  console.error(`\n✗ mesure-ui : ${echecs.length} débordement(s) latéral(aux).\n`)
  for (const e of echecs) {
    console.error(`   ${e.adresse}  ${e.largeur}px  ${e.langue}  →  scrollX=${e.decalage}`)
    for (const c of e.coupables) {
      console.error(`      <${c.balise}> largeur=${c.largeur} bordDroit=${c.bordDroit} (fenêtre ${e.largeurVue})`)
      console.error(`         class="${c.classes}"`)
      if (c.texte) console.error(`         texte=${JSON.stringify(c.texte)}`)
    }
  }
  console.error('')
  process.exit(1)
}

console.log(
  `\n✓ mesure-ui : ${adresses.length} écrans × ${LARGEURS.length} largeurs × ${LANGUES.length} langues, aucun débordement latéral ni en-tête replié.\n` +
    `  ${rangeesMesurees} mesures de la barre de la vitrine, toutes au-dessus de ${JEU_MINIMAL} px de jeu ; réglages atteints au clavier à 1440 px dans les deux langues.\n` +
    `  ${textesAudites} textes audités en contraste (${THEMES.join(' + ')}, ${LARGEURS_CONTRASTE.join(' et ')} px), aucun sous le seuil WCAG AA.`,
)
