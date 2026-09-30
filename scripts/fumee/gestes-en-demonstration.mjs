/**
 * CE QU'UN VISITEUR PEUT OUVRIR SUR L'HÔTE VIVANT, SANS COMPTE.
 *
 * ═══ LE TROU QUE CE MODULE FERME ═══
 *
 * La fumée mesurait sept choses publiques — la vitrine, un lien profond,
 * l'écran de connexion — puis, SI un compte de sonde est posé dans
 * l'environnement, ce que voit ce compte. Sans identifiants, elle ne voyait
 * RIEN du produit. Or le produit monte ses vingt écrans de gestion sous `/demo`
 * AUSSI, sur un parc de démonstration, sans authentification : c'est la seule
 * surface de production qu'une machine puisse ouvrir sans secret.
 *
 * Mesuré le 2026-09-30 : huit lots venaient d'être déployés, et rien ne
 * répondait à « sont-ils atteignables ? » sans se connecter à la main.
 *
 * ═══ UN CODE HTTP NE PROUVE RIEN ICI, ET C'EST LE POINT ═══
 *
 * Le produit est une page unique : TOUT chemin rend `index.html` avec un 200.
 * `/demo/adresse-inventee` répond 200 comme les autres. Sonder des codes
 * reviendrait à écrire la même erreur que le `401` de `/api/parks/*`, qui
 * semblait prouver qu'une route existait et que l'authentification rendait
 * avant tout routage.
 *
 * LE DISCRIMINANT EST L'ABSENCE DE L'ÉCRAN « INTROUVABLE ». Une adresse
 * déclarée par le routeur que l'hôte ne saurait plus rendre — parce qu'il sert
 * un paquet plus ancien, parce qu'un écran a disparu — tomberait sur la route
 * `*` et peindrait « Cette page n'existe pas » ou « Écran introuvable ». C'est
 * ce texte qu'on cherche, et son témoin est une adresse inventée qui DOIT le
 * rendre. Sans ce témoin, une sonde qui ne trouve jamais le 404 ne se distingue
 * pas d'une sonde qui ne sait pas le lire.
 *
 * ═══ AUCUNE LISTE N'EST ÉCRITE ICI, ET C'EST DÉLIBÉRÉ ═══
 *
 * Les adresses viennent d'`inventaireDesRoutes()`, les modales de
 * `modales/registre.mjs`. Une liste recopiée ici — « les huit lots du
 * 30 septembre » — serait un instantané, pas une porte : elle ne dirait plus
 * rien au neuvième lot, et son silence ressemblerait exactement à « aucun
 * défaut ». Les deux registres sont déjà tenus par des gardes qui rougissent
 * quand ils vieillissent ; ce module les lit, il n'en fabrique pas un troisième.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * IL N'ACHÈVE AUCUN GESTE. Il OUVRE les modales et lit ce qu'elles peignent ;
 * il ne confirme rien, ne supprime rien, n'envoie rien. La démonstration ne
 * tient d'ailleurs aucun registre — ses données vivent dans le paquet, pas dans
 * la base — mais la règle vaut d'abord pour ce que ce module promet.
 *
 * IL NE MESURE AUCUNE GÉOMÉTRIE. Les plafonds de défilement appartiennent à
 * `modales.mjs`, qui les mesure en local sur une machine connue. Un plafond
 * relevé à travers un réseau serait un plafond dont on ne sait pas de quelle
 * machine il vient. Voir `police-large-locale-diverge-du-ci`.
 *
 * ET IL NE VOIT PAS TOUT DU PRODUIT : un lot dont la surface est conditionnée à
 * un vrai parc n'apparaît pas en démonstration. `ReceiptModal` en est le cas —
 * sa pièce jointe est gardée par `parkId`, absent ici. Ce module ne peut donc
 * pas prétendre couvrir tout ce qui est déployé, et son verdict ne le dit pas.
 */
import { SANS_AGENT_DE_SERVICE } from '../mesure-sans-agent.mjs'
import { inventaireDesRoutes, exigerUnInventairePlein } from '../inventaire/routes.mjs'
import { MODALES } from '../modales/registre.mjs'

/**
 * LES DEUX ÉCRANS DE REFUS, lus dans `src/i18n/fr.ts` (`notFound.title` et
 * `notFound.appTitle`). Recopiés ici parce qu'ils sont la CIBLE de la mesure :
 * les lire depuis le produit ferait qu'un renommage des deux côtés passerait
 * sans bruit. Le témoin ci-dessous les tient à jour — il rougit le jour où ces
 * phrases changent, ce qui est exactement quand il faut le savoir.
 */
const TEXTES_DE_REFUS = ['Cette page n’existe pas', 'Écran introuvable']

/** Une adresse que le routeur ne déclare pas, et ne déclarera jamais. */
const ADRESSE_INVENTEE = '/demo/annonces-qui-n-existent-pas'
/** Un geste que le produit n'offre nulle part. */
const GESTE_INVENTE = /^Ouvrir une sous-location trimestrielle$/

const JETON = /\{[A-Za-z][\w.]*\}/g

/**
 * LA BOÎTE A DEUX RÔLES, ET LE SECOND EST CELUI QUI COMPTE LE PLUS.
 *
 * Les confirmations destructrices du produit portent `role="alertdialog"` —
 * retirer un locataire, révoquer un accès, mettre en demeure. `getByRole('dialog')`
 * ne les trouve PAS : les deux rôles sont distincts pour Playwright. Quatre
 * modales ont été déclarées « ouvertes sans rien peindre » pour cette seule
 * raison, et c'étaient précisément les quatre qu'on tient le plus à voir
 * s'ouvrir. `modales.mjs` cite les deux rôles partout ; ce module fait pareil.
 */
const SELECTEUR_DE_BOITE = '[role="dialog"],[role="alertdialog"]'

/** Le texte que l'écran peint, une fois qu'il a quelque chose à peindre. */
async function corpsPeint(page, delai = 20000) {
  const t0 = Date.now()
  let texte = ''
  while (Date.now() - t0 < delai) {
    texte = await page.evaluate(
      () => document.querySelector('main')?.innerText ?? document.body.innerText,
    )
    if (texte.trim().length >= 20) return texte
    await page.waitForTimeout(250)
  }
  return texte
}

/**
 * LE GESTE, MÊME REPLIÉ DERRIÈRE TROIS POINTS.
 *
 * Même chemin que `modales.mjs` : on ouvre le menu de L'EN-TÊTE, jamais le
 * premier de la page — la coquille en porte un pour le compte, et l'ouvrir
 * mènerait à la déconnexion.
 *
 * C'EST UNE COPIE, ET ELLE PEUT DIVERGER. Le registre, lui, a été SORTI de
 * `modales.mjs` pour cette raison même. Ce bloc-ci ne l'a pas suivi parce que
 * les deux versions ne sont pas identiques : celle de `modales.mjs` ne reboucle
 * pas — elle interroge un serveur local où tout est immédiat — et lui imposer
 * l'attente d'ici changerait la durée d'une porte de quinze minutes sans que
 * personne l'ait demandé. Le risque retenu est donc qu'un changement de
 * structure des menus soit appliqué d'un seul côté ; il est écrit ici plutôt
 * que découvert dans six mois. `check-sondes-recopiees` ne le voit PAS : il ne
 * tient que les blocs bornés par ses marques, et ceux-ci sont des sondes
 * sérialisées dans la page, ce que ce bloc n'est pas.
 *
 * ON REBOUCLE, et c'est une correction payée : compter les déclencheurs UNE
 * fois juste après la navigation les trouve absents, parce que la démonstration
 * n'a pas fini de charger. Quatre modales ont été déclarées introuvables pour
 * un geste qui apparaissait une seconde plus tard.
 */
async function trouverLeGeste(page, motif, delai) {
  const direct = page.getByRole('button', { name: motif })
  const item = page.getByRole('menuitem', { name: motif })
  const t0 = Date.now()
  do {
    if ((await direct.count()) > 0) return direct.first()
    if ((await item.count()) > 0) return item.first()
    for (const trois of await page
      .locator('[data-en-tete-de-page] [aria-haspopup="menu"], main [aria-haspopup="menu"]')
      .all()) {
      await trois.click().catch(() => {})
      await page.waitForTimeout(200)
      if ((await item.count()) > 0) return item.first()
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(400)
  } while (Date.now() - t0 < delai)
  return null
}

/**
 * @returns {Promise<{controles: number, ecrans: number, modales: number, temoins: number}>}
 */
export async function balayerLaDemonstration({ navigateur, HOTE, plaintes }) {
  /* UN CONTEXTE NEUF : la passe publique a visité l'écran de connexion, et
     hériter de son état ferait mesurer autre chose que ce que voit un arrivant. */
  const contexte = await navigateur.newContext({
    ...SANS_AGENT_DE_SERVICE,
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
  })
  const page = await contexte.newPage()

  let controles = 0
  let ecrans = 0
  let modales = 0
  let temoins = 0

  /*
    L'INVENTAIRE EST EXIGÉ PLEIN AVANT D'ÊTRE FILTRÉ.

    Sans cela, une lecture du routeur qui casserait rendrait zéro adresse, la
    boucle ne tournerait pas, et ce module conclurait au vert — « aucune
    plainte » et « rien de balayé » s'écrivent pareil. `exigerUnInventairePlein`
    LÈVE plutôt que de se plaindre, et c'est juste : une liste vide ne fait pas
    un rapport incomplet, elle fait un rapport qui ne veut rien dire.

    ET LE COMPTE DES MODALES EST GARDÉ DE MÊME, plus bas : un registre vidé par
    accident passerait aussi silencieusement.
  */
  const adresses = exigerUnInventairePlein(inventaireDesRoutes())
    .map((r) => r.adresse)
    .filter((a) => a === '/demo' || a.startsWith('/demo/'))
  if (adresses.length < 15) {
    throw new Error(
      `fumée/démonstration : ${adresses.length} adresse(s) sous /demo, c'est trop peu pour être vrai. ` +
        `Le filtre ou la lecture du routeur est cassé, et ce n'est pas « aucun défaut ».`,
    )
  }
  if (MODALES.length < 30) {
    throw new Error(
      `fumée/démonstration : ${MODALES.length} modale(s) au registre, c'est trop peu pour être vrai.`,
    )
  }

  /* ═══ LES ÉCRANS QUE LE ROUTEUR DÉCLARE ═══ */
  for (const adresse of adresses) {
    controles++
    ecrans++
    try {
      const reponse = await page.goto(`${HOTE}${adresse}`, { waitUntil: 'networkidle' })
      const statut = reponse?.status() ?? 0
      if (statut >= 400) {
        plaintes.push(`démonstration ${adresse} : ${statut}.`)
        continue
      }
      const texte = await corpsPeint(page)
      if (texte.trim().length < 20) {
        plaintes.push(
          `démonstration ${adresse} : peint moins de vingt caractères.\n` +
            `   Le routeur déclare cet écran et l'hôte ne le montre pas.`,
        )
        continue
      }
      const refus = TEXTES_DE_REFUS.find((r) => texte.includes(r))
      if (refus) {
        plaintes.push(
          `démonstration ${adresse} : l'hôte rend « ${refus} ».\n` +
            `   Le routeur DÉCLARE cette adresse. L'hôte sert donc autre chose que cet arbre.`,
        )
        continue
      }
      const jetons = [...new Set([...texte.matchAll(JETON)].map((m) => m[0]))]
      if (jetons.length > 0) {
        plaintes.push(
          `démonstration ${adresse} : jeton(s) survivant(s) — ${jetons.join(', ')}.`,
        )
      }
    } catch (erreur) {
      plaintes.push(`démonstration ${adresse} : ${String(erreur).split('\n')[0]}`)
    }
  }

  /* ═══ LE TÉMOIN DES ÉCRANS ═══
     Sans lui, « aucun écran ne rend le refus » ne se distingue pas de « je ne
     sais pas lire le refus ». */
  controles++
  try {
    await page.goto(`${HOTE}${ADRESSE_INVENTEE}`, { waitUntil: 'networkidle' })
    const texte = await corpsPeint(page)
    if (TEXTES_DE_REFUS.some((r) => texte.includes(r))) {
      temoins++
    } else {
      plaintes.push(
        `TÉMOIN : ${ADRESSE_INVENTEE} ne rend AUCUN des deux écrans de refus.\n` +
          `   Ou le produit les a renommés, ou cette sonde ne sait pas les lire — et\n` +
          `   dans les deux cas tout ce qu'elle vient de déclarer vert est sans valeur.`,
      )
    }
  } catch (erreur) {
    plaintes.push(`TÉMOIN d'adresse : ${String(erreur).split('\n')[0]}`)
  }

  /* ═══ LES MODALES QUE LE REGISTRE DÉCLARE ═══ */
  for (const modale of MODALES) {
    controles++
    try {
      await page.goto(`${HOTE}${modale.adresse}`, { waitUntil: 'networkidle' })
      await corpsPeint(page)
      /* LE PROFIL, quand le registre en déclare un : une modale du locataire
         n'existe pas pour le propriétaire, et la chercher sans basculer serait
         l'accuser d'être absente alors qu'on regarde le mauvais écran. Même
         geste que `modales.mjs` — le radio est `sr-only`, donc le clic est
         FORCÉ : à la souris c'est l'étiquette qu'on vise, et elle est visible. */
      if (modale.profil) {
        const tiroir = page
          .getByRole('button', { name: /Ouvrir la navigation|Open navigation/ })
          .first()
        if ((await tiroir.count()) > 0 && (await tiroir.isVisible())) {
          await tiroir.click()
          await page.waitForTimeout(400)
        }
        const radio = page.getByRole('radio', { name: modale.profil }).first()
        if ((await radio.count()) === 0) {
          plaintes.push(
            `modale ${modale.nom} : le sélecteur de profil est introuvable sur l'hôte.`,
          )
          continue
        }
        await radio.click({ force: true })
        await page.waitForTimeout(500)
        const fermer = page.getByRole('button', { name: /Fermer|Close/ }).first()
        if ((await fermer.count()) > 0 && (await fermer.isVisible())) {
          await fermer.click()
          await page.waitForTimeout(400)
        }
      }
      if (modale.prealable) await modale.prealable(page)

      const geste = await trouverLeGeste(page, modale.bouton, 15000)
      if (!geste) {
        plaintes.push(
          `modale ${modale.nom} : le geste qui l'ouvre est introuvable sur ${modale.adresse}.\n` +
            `   « Pas ouverte » ne doit jamais s'écrire comme « sans défaut ».`,
        )
        continue
      }
      await geste.click()
      const boite = page.locator(SELECTEUR_DE_BOITE).first()
      await boite.waitFor({ timeout: 10000 })
      if (modale.apres) await modale.apres(page)

      const texte = await boite.innerText()
      if (texte.trim().length < 20) {
        plaintes.push(`modale ${modale.nom} : s'ouvre et ne peint rien.`)
        continue
      }
      /* LA NOTE CONDITIONNELLE, quand le registre en déclare une : c'est ce que
         le produit DIT au moment où l'on choisit, et son absence est un écran
         qui laisse croire que le choix est sans conséquence. */
      if (modale.note && !modale.note.test(texte)) {
        plaintes.push(
          `modale ${modale.nom} : sa note conditionnelle ne paraît pas après le geste.`,
        )
        continue
      }
      const jetons = [...new Set([...texte.matchAll(JETON)].map((m) => m[0]))]
      if (jetons.length > 0) {
        plaintes.push(`modale ${modale.nom} : jeton(s) survivant(s) — ${jetons.join(', ')}.`)
        continue
      }
      modales++
      await page.keyboard.press('Escape').catch(() => {})
    } catch (erreur) {
      plaintes.push(`modale ${modale.nom} : ${String(erreur).split('\n')[0]}`)
    }
  }

  /* ═══ LE TÉMOIN DES MODALES ═══
     Une recherche de geste qui trouve toujours ne prouve rien. Sur un écran
     RÉEL et peint, un geste inventé doit rester introuvable. */
  controles++
  try {
    await page.goto(`${HOTE}/demo/vacance`, { waitUntil: 'networkidle' })
    await corpsPeint(page)
    if ((await trouverLeGeste(page, GESTE_INVENTE, 3000)) === null) {
      temoins++
    } else {
      plaintes.push(
        'TÉMOIN : un geste inventé a été TROUVÉ sur /demo/vacance.\n' +
          "   La recherche de geste ne sait pas refuser ; les modales déclarées\n" +
          '   ouvertes ci-dessus ne prouvent donc rien.',
      )
    }
  } catch (erreur) {
    plaintes.push(`TÉMOIN de geste : ${String(erreur).split('\n')[0]}`)
  }

  await contexte.close()

  /* GARDE DU GARDE : « aucune plainte » et « rien de balayé » s'écrivent pareil. */
  if (ecrans !== adresses.length) {
    plaintes.push(`${ecrans} écran(s) balayé(s) pour ${adresses.length} déclaré(s).`)
  }
  if (modales === 0) {
    plaintes.push("aucune modale n'a été ouverte sur l'hôte, et rien ne s'en est plaint.")
  }
  if (temoins !== 2) {
    plaintes.push(`${temoins} témoin(s) sur 2 ont abouti : la sonde n'est pas prouvée capable de refuser.`)
  }

  return { controles, ecrans, modales, temoins }
}
