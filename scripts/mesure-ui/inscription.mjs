/**
 * LE PARCOURS D'INSCRIPTION, MARCHE PAR MARCHE.
 *
 * Les écrans intérieurs de l'inscription ne s'atteignent pas par une adresse :
 * il faut REMPLIR pour avancer. Sans ce parcours, la porte mesurerait la
 * première étape et déclarerait les suivantes saines — la famille des écrans
 * inatteignables, qui cachent du code autant que des pixels.
 *
 * `marchesRatees` est LOCAL à ce parcours et remonte dans son résultat : une
 * marche manquée doit se dire, sinon « pas mesuré » s'écrit « sans défaut ».
 *
 * Module PUR : l'importer n'exécute rien.
 */

import { MESURER, MESURER_DEBORD_LOCAL, MESURER_VALEUR_ROGNEE } from './mesures-navigateur.mjs'

import { BASE, LARGEURS } from './contexte.mjs'
import { attendre, poserLArbre } from './attentes.mjs'

/**
 * ═══ LES TROIS ÉTAPES INTÉRIEURES DE L'INSCRIPTION ═══
 *
 * Le balayage visite des ADRESSES. `/inscription` en est une, et elle rend
 * l'étape 1 — le choix du rôle. Les trois suivantes — identité, contexte,
 * récapitulatif — vivent dans l'état d'un composant : aucune adresse ne les
 * atteint, aucune porte ne les avait jamais regardées. Trois écrans du parcours
 * le plus exposé du produit, celui par lequel tout le monde entre, et dont on
 * ne savait rien.
 *
 * LE LOT PRÉCÉDENT LE DISAIT DÉJÀ, en réserve : la sonde du rognage « couvre ce
 * que le produit affiche de lui-même, pas ce qui apparaît après une saisie ».
 * C'était vrai de cette sonde-là, et de toutes les autres de ce fichier.
 *
 * ─── CE QU'ELLE MESURE, ET CE QU'ELLE A TROUVÉ ────────────────────────────
 *
 * Trois règles, sur les 198 points du parcours (3 rôles × 3 étapes × 11
 * largeurs × 2 langues) : le rognage d'une valeur dans son champ, le
 * débordement de la page, le débordement local. Zéro défaut. La garde naît
 * VERTE, et c'est la mutation qui prouve qu'elle mord — voir la note en pied.
 *
 * ─── LES SONDES QU'ON A ESSAYÉES ET QU'ON NE BRANCHE PAS ──────────────────
 *
 * Les cinq autres sondes de la boucle principale ont tourné ici avant d'écrire
 * ce bloc — coupures de libellé, troncatures aux deux tailles de police,
 * gestes atteignables, débordement de mot, blanc imposé. Quatre n'ont rien
 * rapporté sur les 198 points. La cinquième, le blanc imposé, en rapporte
 * partout : 207 à 296 px sous la colonne de marque sombre, à 1024 et 1280.
 *
 * ON NE LA BRANCHE PAS, et ce n'est pas un renoncement. Ce blanc est celui de
 * la colonne d'ARGUMENTAIRE, qui est plus courte que le formulaire et le sera
 * toujours ; il est déjà relevé sur `/inscription` par la boucle principale,
 * déjà arbitré, et il grandit ici mécaniquement — de 223 à 296 px — parce que
 * le formulaire grandit d'une étape à l'autre. Brancher la sonde reviendrait à
 * remonter un plafond de 73 px pour redire ce que la première étape dit déjà.
 * Le jour où l'on voudra ce blanc-là, c'est la colonne qu'il faudra changer,
 * pas la mesure.
 *
 * ─── LE TÉMOIN DU PARCOURS : LE FIL D'ÉTAPES ──────────────────────────────
 *
 * Un parcours qui n'avance pas mesurerait trois fois l'étape 2 et rendrait
 * « trois étapes couvertes ». C'est la panne exacte que ce fichier a déjà payée
 * ailleurs — une garde qui passe à vide ressemble à une garde qui passe. Avant
 * chaque relevé, on lit donc le rang que le fil d'étapes DÉCLARE
 * (`aria-current="step"`), et il doit valoir celui qu'on croit mesurer. Ce
 * témoin est indépendant du clic qui l'a produit : il vient du composant, pas
 * de nous. Une marche ratée arrête le parcours de ce rôle plutôt que de le
 * poursuivre sur un écran qu'on nommerait mal.
 */
export const ROLES_DE_L_INSCRIPTION = [
  /* Chaque rôle a son champ propre à l'étape 3, et sans lui on n'atteint pas la
     4 : `validateStep('context')` les exige nommément. */
  { slug: 'proprietaire', champ: 'parkName', valeur: 'Résidence Bonanjo' },
  { slug: 'gestionnaire', champ: 'ownerCode', valeur: 'GES-4A7B-92CD' },
  { slug: 'locataire', champ: 'inviteCode', valeur: 'LOC-4A7B-92CD' },
]

/**
 * LES TROIS ÉTAPES, et le rang que le fil doit annoncer sur chacune.
 *
 * On entre par `/inscription/:role`, qui saute l'étape 1 — c'est le produit qui
 * l'offre, pour la landing, et non un raccourci inventé ici. Le rang commence
 * donc à 2.
 */
export const ETAPES_INTERIEURES = [
  { rang: 2, nom: 'identité' },
  { rang: 3, nom: 'contexte' },
  { rang: 4, nom: 'récapitulatif' },
]

/**
 * LES VALEURS SAISIES, choisies pour PASSER la validation, pas pour la sonder.
 *
 * Ce n'est pas une garde de validation — il y en a une, en test unitaire, et
 * elle est mieux placée. Ici la saisie n'est qu'un péage : sans elle, l'étape
 * suivante n'existe pas. On prend donc des valeurs justes du premier coup, et
 * plutôt celles du marché que sert la démonstration.
 */
export async function remplirLIdentite(page) {
  await page.fill('input[name="name"]', 'Amina Fotso Ngassa')
  await page.fill('input[name="email"]', 'amina.fotso@example.cm')
  await page.fill('input[name="phone"]', '699 00 00 00')
  await page.fill('input[name="password"]', 'Kribi-Douala-2026!')
}

/**
 * LE PAYS SE CHOISIT COMME ON LE CHOISIT — au clavier, dans le champ cherchable.
 *
 * `input[name="country"]` est un champ CACHÉ : le combobox le porte pour que le
 * navigateur remplisse et que le formulaire envoie le code ISO. Le remplir
 * directement ne réglerait rien à l'écran, et la sonde du rognage mesurerait un
 * champ resté vide — un vert obtenu en ne montrant rien.
 *
 * On tape les quatre premières lettres du Cameroun, qui filtrent dans les deux
 * langues (« Cameroun », « Cameroon »), et on valide. Le témoin est le champ
 * caché : s'il reste vide, le choix n'a pas pris.
 */
export async function choisirLePays(page) {
  await page.locator('input[role="combobox"]').first().click()
  await page.keyboard.type('Came')
  await page.waitForFunction(
    () => document.querySelectorAll('[role="option"]').length > 0,
    null,
    { timeout: 3000 },
  )
  await page.keyboard.press('Enter')
  return page.evaluate(() => document.querySelector('input[name="country"]')?.value ?? '')
}

/**
 * Parcourt l'assistant pour les trois rôles et relève à chaque étape.
 *
 * UNE NAVIGATION PAR RÔLE, et le reste au redimensionnement — la règle de ce
 * fichier depuis le lot qui a fusionné deux passes : ce qui coûte, c'est le
 * chargement. L'état de l'assistant vit dans le composant, donc il SURVIT au
 * redimensionnement ; recharger à chaque largeur voudrait dire refaire les
 * quatre saisies onze fois par rôle.
 */
export async function etapesDeLInscription(page) {
  const rognages = []
  const debordsDePage = []
  const debordsLocaux = []
  const marchesRatees = []
  let points = 0
  let champsMesures = 0

  /*
    CINQ SECONDES, ET NON TRENTE. Ce parcours est le seul de ce fichier à
    DÉSIGNER des champs par leur `name` ; le jour où l'un d'eux est renommé,
    Playwright attend son délai par défaut sur chacun — trois minutes par
    langue, pour finir sur une trace de pile là où il faut une phrase. Cinq
    secondes suffisent largement à une page déjà chargée et stabilisée, et
    l'échec arrive assez tôt pour être RACONTÉ.

    Le contexte se ferme juste après cette passe : le réglage ne survit à rien.
  */
  page.setDefaultTimeout(5000)

  for (const role of ROLES_DE_L_INSCRIPTION) {
    const adresse = `/inscription/${role.slug}`
    try {
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
    await page.goto(BASE + adresse, { waitUntil: 'domcontentloaded' })
    await attendre(page, adresse)
    await remplirLIdentite(page)

    for (const etape of ETAPES_INTERIEURES) {
      if (etape.rang > 2) {
        await page.locator('form button[type="submit"]').click()
        await attendre(page, `${adresse} (étape ${etape.rang})`)
      }

      const rang = await page.evaluate(() => {
        const pastille = document.querySelector('[aria-current="step"]')
        return pastille ? pastille.textContent.trim() : ''
      })
      if (rang !== String(etape.rang)) {
        marchesRatees.push({ adresse, attendu: etape.rang, lu: rang || '(aucun fil)' })
        break
      }

      if (etape.rang === 3) {
        const pays = await choisirLePays(page)
        if (!pays) {
          marchesRatees.push({ adresse, attendu: 'un pays choisi', lu: '(champ vide)' })
          break
        }
        await page.fill(`input[name="${role.champ}"]`, role.valeur)
      }

      for (const largeur of LARGEURS) {
        await page.setViewportSize({ width: largeur, height: 900 })
        await attendre(page, `${adresse} (étape ${etape.rang})`)
        /* Le redimensionnement rend la main avant que l'arbre l'ait suivi —
           voir `POSER_L_ARBRE`. Sans cela, ces trois sondes mesurent parfois la
           largeur précédente. */
        await poserLArbre(page, `${adresse} · étape ${etape.rang} · ${largeur}px`)
        points += 1
        const ou = `${adresse} · étape ${etape.rang} (${etape.nom}) ${largeur}px`

        const valeurs = await page.evaluate(MESURER_VALEUR_ROGNEE)
        champsMesures += valeurs.mesures
        for (const d of valeurs.defauts) rognages.push({ ...d, ou })

        const page_ = await page.evaluate(MESURER)
        if (page_) debordsDePage.push({ ...page_, ou })

        const local = await page.evaluate(MESURER_DEBORD_LOCAL)
        for (const c of local.coupables) debordsLocaux.push({ ...c, ou })
      }
      await page.setViewportSize({ width: LARGEURS[0], height: 900 })
      }
    } catch (erreur) {
      /* UN GESTE QUI ÉCHOUE EST UNE MARCHE RATÉE, pas une panne de la porte.
         Un champ renommé, un bouton qui change de forme, une liste qui ne
         s'ouvre plus : tout cela retire de la couverture, et c'est ce qu'il
         faut lire — la trace de pile, elle, ne dit pas quels écrans ont cessé
         d'être mesurés. */
      marchesRatees.push({
        adresse,
        attendu: 'un parcours complet',
        lu: String(erreur.message ?? erreur).split('\n')[0].slice(0, 120),
      })
    }
  }

  return { points, champsMesures, rognages, debordsDePage, debordsLocaux, marchesRatees }
}
