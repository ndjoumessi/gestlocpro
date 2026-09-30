#!/usr/bin/env node
/**
 * LES NOTES CONDITIONNELLES SONT DÉCLARÉES, ET CELLES QU'ON DIT MESURABLES
 * SONT ATTEINTES POUR DE VRAI.
 *
 * ═══ L'ANGLE MORT, ET IL A COÛTÉ TROIS LOTS D'AFFILÉE ═══
 *
 * `mesure-ui`, `couleur-non-seule`, `plafond-coquille` et `modales` ne mesurent
 * RIEN DERRIÈRE UNE SESSION. Ce qu'ils voient est donc exactement ce que la
 * démonstration PRODUIT — et une explication qui n'apparaît que sous une
 * condition que la démonstration ne remplit jamais n'est vue par personne. Ni
 * sa géométrie, ni son contraste, ni son débordement.
 *
 * CETTE PHRASE DISAIT « ne visitent QUE /demo », ET C'ÉTAIT FAUX — relevé le
 * 2026-09-03. `couleur-non-seule` et `modales` s'en tiennent bien à `/demo`,
 * mais `mesure-ui` ouvre aussi `/connexion` et `/inscription`, et
 * `plafond-coquille` DEMANDE les vingt-quatre routes de l'inventaire, `/app`
 * comprise.
 *
 * Ce qui ne change rien au raisonnement, et le rend même plus net : sans
 * session, une requête vers `/app` est redirigée vers `/connexion`, et c'est
 * l'écran de connexion qui se fait mesurer. La porte croyait voir l'espace
 * connecté ; elle voyait la porte d'entrée. Ce défaut-là a été réparé le même
 * jour dans `plafond-coquille` en coupant `/api/**`.
 *
 * `espace-connecte`, lui, ouvre bien `/app` derrière une VRAIE session. L'angle
 * mort qui subsiste est donc plus étroit qu'écrit ici : une explication que ni
 * la démonstration ni AUCUN des parcs de sonde ne produit.
 *
 * Ce n'est pas une hypothèse. Sur la journée du 2026-08-31, trois `<Notice>`
 * ont été ajoutées coup sur coup — le périmètre du gestionnaire, le logement
 * déjà pris par un code, le locataire sans compte. Les portes sont passées au
 * vert sur les trois. Deux n'avaient JAMAIS été rendues dans un navigateur, et
 * la troisième portait un défaut que seul le navigateur pouvait voir : son
 * message était écrit en ICU imbriqué, que `t()` ne sait pas lire, et il
 * s'affichait TEL QUEL sur l'écran des locataires, accolades comprises. Le cas
 * jsdom cherchait une sous-chaîne — laquelle existe aussi dans le message
 * cassé. Il était vert.
 *
 * ═══ CE QUE CE SCRIPT REFUSE ═══
 *
 *  1. UNE NOTE NON DÉCLARÉE. Toute clé portée par un `<Notice>` doit figurer au
 *     registre ci-dessous. Ajouter une explication conditionnelle sans dire où
 *     elle se voit devient impossible — c'est la moitié qui empêche l'angle
 *     mort de se rouvrir au prochain lot.
 *  2. UNE DÉCLARATION PÉRIMÉE. Une entrée du registre dont plus aucun `<Notice>`
 *     ne porte la clé est une garde qui vérifie un écran disparu.
 *  3. UNE NOTE DITE MESURABLE ET INTROUVABLE. On ouvre l'adresse, on fait le
 *     geste déclaré, et le texte du dictionnaire doit être à l'écran.
 *  4. UN GABARIT NON INTERPRÉTÉ. Aucun jeton `{…}` du message ne doit survivre
 *     à l'écran. C'est le défaut du jour, et il ne se voit qu'ici.
 *  5. UN AVEU SANS MOTIF. Une note déclarée non mesurable doit dire POURQUOI,
 *     en une phrase écrite. Le registre porte les aveux ; il ne les cache pas.
 *
 * ═══ CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE ═══
 *
 *  — LA GÉOMÉTRIE. Il constate qu'une note est à l'écran, jamais qu'elle y
 *    tient. C'est le travail de `mesure-ui` et de `modales` — et le rendre
 *    possible est justement ce que ce script obtient : une note produite par la
 *    démonstration est une note que les autres gardes rencontrent enfin.
 *  — LES AUTRES PORTEURS D'EXPLICATION. `EmptyState`, `Field.hint`, les
 *    pastilles. `Notice` est le porteur de l'explication CONDITIONNELLE, celui
 *    qui n'apparaît que sous garde — c'est la famille où l'angle mort vit.
 *    L'étendre est un lot, pas une ligne.
 *  — L'ANGLAIS. Le registre résout le dictionnaire FRANÇAIS. Une note dont
 *    seule la version anglaise manquerait passerait ici ; `parity.test.ts` la
 *    tient déjà par ailleurs.
 *
 * ═══ IL LIT LE PAQUET CONSTRUIT, ET NE LE CONSTRUIT PAS ═══
 *
 * Comme `series-lisibles` et `couleur-non-seule`, il sert `dist/` par
 * `vite preview` et compte sur `mesure-ui`, lancé avant lui dans `check`, pour
 * l'avoir bâti. Lancé seul sur un `dist/` périmé, il mesure l'avant-dernier
 * état du produit — et le dira en rougissant sur une note qu'on vient d'ajouter.
 *
 *   npx vite build && node scripts/notes-conditionnelles.mjs
 *
 * PIÈGE TAILWIND v4 : `scripts/` est balayé comme source. Aucun nom
 * d'utilitaire n'est écrit ici.
 */
import { chromium } from 'playwright'
import { exigerUnPaquetAJour } from './paquet-a-jour.mjs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exit } from 'node:process'
import { SANS_AGENT_DE_SERVICE } from './mesure-sans-agent.mjs'
import { dictionnaireAPlat } from './check-i18n.mjs'
import { servirLaPrevisualisation } from './serveur-de-previsualisation.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4196
const BASE = `http://127.0.0.1:${PORT}`
const SRC = join(RACINE, 'src')

/* ══════════════════════════ LES GESTES ══════════════════════════ */

/** Le sélecteur de profil de la démonstration vit dans la barre latérale. */
async function choisirLeProfil(page, nom) {
  const tiroir = page.getByRole('button', { name: /Ouvrir la navigation/ }).first()
  if ((await tiroir.count()) > 0 && (await tiroir.isVisible())) {
    await tiroir.click()
    await page.waitForTimeout(300)
  }
  /* Clic FORCÉ : le radio est `sr-only`. À la souris c'est l'étiquette qu'on
     vise, et elle est bien visible — le forçage est ici la vérité du geste. */
  await page.getByRole('radio', { name: nom }).first().click({ force: true })
  await page.waitForTimeout(400)
}

/**
 * Le panneau du bail, derrière le menu de débordement du dossier d'un logement.
 *
 * DEUX CLICS, parce que l'entrée s'est repliée : la quittance est le geste
 * primaire d'un dossier, pas le congé. Le menu porte son nom accessible en
 * français comme en anglais, d'où l'alternative.
 */
/**
 * LE CANAL WHATSAPP : la modale de correction du parc, puis sa liste déroulante.
 *
 * `select[name]` et non un rôle : c'est une VRAIE liste déroulante, comme la
 * devise de la même boîte, et `selectOption` déclenche l'événement que React
 * écoute. Le `Combobox` du dépôt aurait demandé d'ouvrir un panneau.
 */
async function ouvrirLeCanalWhatsApp(page) {
  /* DERRIÈRE LE MENU DE DÉBORDEMENT, comme le bail : « Corriger le parc » n'est
     pas une action primaire de l'écran du parc, et le chercher au premier
     niveau expire au bout de trente secondes sans rien dire de plus. */
  await page.getByRole('button', { name: /^Autres actions$|^More actions$/ }).first().click()
  await page.waitForTimeout(250)
  await page
    .getByRole('menuitem', { name: /^Corriger le parc$|^Correct the park$/ })
    .first()
    .click()
  await page.waitForTimeout(250)
  await page.locator('select[name="reminderChannel"]').selectOption('whatsapp')
  await page.waitForTimeout(250)
}

/** Le plan d'apurement : le panneau du bail, puis sa quatrième section. */
async function ouvrirLePlan(page) {
  await ouvrirLeBail(page)
  await page
    .getByRole('button', { name: /^Plan d’apurement$|^Settlement plan$/ })
    .first()
    .click()
  await page.waitForTimeout(250)
}

async function ouvrirLeBail(page) {
  await page.getByRole('button', { name: /^Autres actions$|^More actions$/ }).first().click()
  await page.waitForTimeout(250)
  await page
    .getByRole('menuitem', { name: /^Bail et sûretés$|^Lease and sureties$/ })
    .first()
    .click()
  await page.waitForTimeout(350)
}

async function ouvrirLInvitation(page) {
  await page.getByRole('button', { name: /^Inviter par code$/ }).first().click()
  await page.waitForTimeout(350)
}

/** L'export de ses données : sans parc réel, le geste rend la note de démonstration. */
async function preparerLExport(page) {
  await page.getByRole('button', { name: /^Préparer mon export$/ }).first().click()
  await page.waitForTimeout(350)
}

/**
 * « Relier à une fiche » vit sur la rangée d'un membre sans fiche.
 *
 * L'ANCRE EST UN PRÉFIXE, ET CE N'EST PLUS UN RELÂCHEMENT. Le nom accessible de
 * ce bouton porte désormais la PERSONNE — « Relier à une fiche — Diane Fotso » —
 * parce que quatre boutons homonymes se suivaient sur cette liste. WCAG 2.5.3
 * exige que ce nom CONTIENNE le libellé visible, donc le libellé est toujours le
 * début du nom : un préfixe est l'ancre exacte de cette règle, quand `$` ancrait
 * sur l'absence de tout complément.
 *
 * ELLE A ÉTÉ TROUVÉE EN ROUGE, et c'est ce qui la fait écrire ici : le lot qui a
 * renommé ces gestes a jugé cette porte hors de sa portée. Elle ne l'était pas.
 */
async function ouvrirLaLiaison(page) {
  await page.getByRole('button', { name: /^Relier à une fiche/ }).first().click()
  await page.waitForTimeout(350)
}

async function ouvrirLeParitageDImmeubles(page) {
  await page.getByRole('button', { name: /^Confier des immeubles$/ }).first().click()
  await page.waitForTimeout(350)
}

/**
 * « Corriger » sur la rangée d'un logement OCCUPÉ.
 *
 * A1 nommément, et pas `.first()` : la note du loyer de référence ne paraît que
 * sur un logement qui porte un bail, et la première rangée du tableau dépend du
 * tri. Charles Ngassa occupe A1 dans le jeu de démonstration.
 */
async function ouvrirLaCorrectionDUnLogementOccupe(page) {
  /* LE MENU D'ABORD. Les deux gestes de ligne se sont repliés derrière trois
     points : à plat, ils allumaient vingt-six commandes en permanence sur cet
     écran. Le déclencheur porte le NUMÉRO du logement — il se répète par ligne,
     et un motif large en trouverait douze. */
  await page.getByRole('button', { name: /^Actions du logement A1$/ }).first().click()
  await page.waitForTimeout(150)
  await page.getByRole('menuitem', { name: /^Corriger le logement A1$/ }).first().click()
  await page.waitForTimeout(350)
}

/**
 * « Corriger » sur la rangée d'un relevé de la démonstration.
 *
 * A1 nommément et pas `.first()` : le nom accessible porte le logement, et
 * l'ordre des rangées dépend du tri. La démonstration porte de FAUX identifiants
 * de relevé — elle n'écrit rien au serveur — et c'est ce qui fait apparaître le
 * geste ici, donc ce qui rend cette note atteignable.
 */
/* « MODIFIER » DEPUIS LE 2026-09-27, et c'est le nom accessible qui a bougé, pas
   le geste : il valait « Corriger les relevés — A1 » alors que le bouton AFFICHE
   « Modifier ». Un `aria-label` écrase le contenu, donc le mot lisible
   disparaissait du nom (WCAG 2.5.3, onze cas). Le logement reste dans le nom pour
   la raison écrite juste au-dessus. */
async function ouvrirLaCorrectionDUnReleve(page) {
  await page.getByRole('button', { name: /^Modifier les relevés — A1$/ }).first().click()
  await page.waitForTimeout(350)
}

async function ouvrirLInvitationEnRecrutant(page) {
  await ouvrirLInvitation(page)
  await page.getByRole('combobox', { name: /Rôle invité/ }).selectOption('manager')
  await page.waitForTimeout(250)
}

/* ══════════════════════════ LE REGISTRE ══════════════════════════ */

/**
 * Chaque note conditionnelle du produit, et comment on la voit.
 *
 * `adresse` + `profil?` + `geste?` : la note est MESURABLE, et ce script la
 * trouve à l'écran. `nonMesurable` : elle ne l'est pas, et la phrase dit
 * pourquoi — comme les motifs gravés des plafonds de `poids-ecrans`, un aveu
 * écrit vaut infiniment mieux qu'un silence.
 */
const REGISTRE = {
  /* ── Ce que la démonstration montre déjà, ou montre depuis ce lot ── */
  'app.tenants.noAccountNotice': { adresse: '/demo/locataires' },
  'app.invite.unitTakenNotice': { adresse: '/demo/locataires', geste: ouvrirLInvitation },
  'app.invite.managerScope': {
    adresse: '/demo/locataires',
    geste: ouvrirLInvitationEnRecrutant,
  },
  'app.invite.managerNotice': {
    adresse: '/demo/locataires',
    profil: /Gestionnaire/,
    geste: ouvrirLInvitation,
  },
  'app.access.managerNotice': { adresse: '/demo/acces', profil: /Gestionnaire/ },
  /* LA NOTE QUI DIT POURQUOI LE TABLEAU NE SOMME PAS AU TOTAL. Sans geste :
     elle est INCONDITIONNELLE, et c'est exactement ce que ce caractère achète —
     un mois sans chantier est celui où l'on croirait le tableau complet, donc
     celui où la note doit être là. Aucun geste à jouer, elle est rendue dès que
     l'écran l'est. */
  'app.expenses.worksApart': { adresse: '/demo/depenses' },
  /* LA NOTE QUI DIT CE QUE L'ÉCRAN NE SAIT PAS CHIFFRER. Sans geste, et pour la
     même raison que sa voisine : elle est INCONDITIONNELLE. Le produit sait ce
     qu'un logement A rapporté, jamais ce qu'il AURAIT rapporté ; un parc sans
     logement vide est précisément celui où l'on croirait l'écran complet.

     C'EST AUSSI LA SEULE GARDE QU'ELLE AIT. Son inconditionnalité n'est pas
     mesurable depuis la démonstration — qui a toujours des logements vides, donc
     rend vraie toute condition qu'on lui accrocherait —, et `vacanceDuParc`
     l'écrit noir sur blanc. Ce registre-ci ne garde que sa PRÉSENCE et sa
     géométrie ; le caractère inconditionnel vit dans le code, sous les yeux. */
  'app.vacancy.scopeNote': { adresse: '/demo/vacance' },
  /* LA NOTE DE SÛRETÉ du rapprochement des noms. Mesurable depuis que la
     démonstration porte un locataire entré sans fiche — voir `ACCES_DEMO`. */
  'app.access.linkMismatch': { adresse: '/demo/acces', geste: ouvrirLaLiaison },
  /* MESURABLE parce que la démonstration porte un gestionnaire BORNÉ — Diane
     Fotso, deux immeubles sur trois. Sans elle, le geste ne s'afficherait sur
     aucune rangée et cette note serait un aveu de plus. */
  'app.access.scopeEmptyMeansAll': {
    adresse: '/demo/acces',
    geste: ouvrirLeParitageDImmeubles,
  },
  'app.deposits.managerNotice': { adresse: '/demo/cautions', profil: /Gestionnaire/ },
  'app.works.managerNotice': { adresse: '/demo/travaux', profil: /Gestionnaire/ },
  'app.system.offlineTitle': { adresse: '/demo/systeme' },
  'app.system.offlineNotice': { adresse: '/demo/systeme' },
  'app.system.errorTitle': { adresse: '/demo/systeme' },
  'app.meters.missingCount': { adresse: '/demo/releves' },
  /* UN RELEVÉ SERT DEUX MOIS. Mesurable parce que la démonstration porte des
     relevés avec leur identifiant : le geste de correction paraît, et la note
     avec lui. */
  'app.readings.correctionSpread': {
    adresse: '/demo/releves',
    geste: ouvrirLaCorrectionDUnReleve,
  },
  /* LE LOYER DE RÉFÉRENCE NE RÉÉCRIT PAS LE PASSÉ. Mesurable parce que la
     démonstration porte des logements OCCUPÉS — A1 en tête —, et la note ne
     paraît que là : sur un logement vacant, il n'y a ni bail ni échéance dont
     parler. */
  'app.portfolio.editUnitRentNote': {
    adresse: '/demo/parc',
    geste: ouvrirLaCorrectionDUnLogementOccupe,
  },
  'app.tenant.privacyNote': { adresse: '/demo/mon-espace', profil: /Locataire/ },
  /* Sans jeton dans l'adresse : c'est l'état « ce lien ne vaut plus rien », et
     il se rencontre en ouvrant la page nue. */
  'auth.reset.invalidBody': { adresse: '/reinitialiser' },

  /* MES DONNÉES — la note de démonstration est MESURABLE : sous `/demo`, aucun
     parc réel n'existe, et c'est exactement ce que le geste déclenche. */
  'app.data.demo': { adresse: '/demo/mes-donnees', geste: preparerLExport },

  /* LA SECTION DU CONGÉ SANS CONGÉ — mesurable, et c'est l'état par défaut du
     panneau : la démonstration n'a pas de parc réel, donc pas de congé, donc la
     note nomme l'absence. C'est précisément l'état qu'on voulait ne pas laisser
     muet. */
  'app.lease.noticeNone': { adresse: '/demo/parc/A1', geste: ouvrirLeBail },

  /* L'ABSENCE D'ACCORD D'APUREMENT — mesurable, et c'est l'état par défaut :
     sans parc réel il n'y a pas de plan, et la note nomme l'état où l'on propose
     d'en convenir un plutôt que de laisser la section muette. */
  'app.lease.planNone': { adresse: '/demo/parc/A1', geste: ouvrirLePlan },

  /* ── Les aveux, et leur motif ── */
  'app.lease.noticeTitle': {
    nonMesurable:
      'Elle ne paraît QU’AVEC UN CONGÉ ENREGISTRÉ, et la démonstration n’en porte ' +
      'aucun : le panneau lit le serveur, et sans parc réel il rend l’état « aucun ' +
      'congé donné » — dont la note, elle, EST mesurée juste au-dessus. En fabriquer ' +
      'un demanderait de poser quatre colonnes de congé dans le jeu de démonstration ' +
      'du client, qui ne porte aucun bail au sens du serveur. CE QUI LA RENDRAIT ' +
      'MESURABLE EST NOMMÉ : un bail de démonstration muni d’un congé, dans le même ' +
      'générateur que les baux. Tenue en jsdom par `bailEtSuretes.test.tsx`, qui ' +
      'vérifie que l’état sans congé n’offre pas le retrait.',
  },
  'app.fees.noFee': {
    nonMesurable:
      'Elle ne paraît QUE SOUS UNE VRAIE SESSION : sans parc, le relevé n’est pas ' +
      'demandé au serveur, et la boîte rend un paragraphe d’explication à la place du ' +
      'bloc de sommes qui la porte. La démonstration ne peut pas lire un relevé — il ' +
      'somme des paiements et des dépenses que seul le serveur connaît. CE QUI LA ' +
      'RENDRAIT MESURABLE EST NOMMÉ : un relevé de démonstration calculé côté client, ' +
      'ce qui reviendrait à écrire une seconde fois le calcul du serveur. Tenue en ' +
      'jsdom par `honorairesDuMandat.test.tsx`.',
  },
  'app.fees.netNegative': {
    nonMesurable:
      'Elle ne paraît QUE SI LE NET EST NÉGATIF — dépenses et chantiers du mois ' +
      'dépassant l’encaissé —, donc sous une vraie session ET sur un parc dont le mois ' +
      'est déficitaire. Deux conditions dont aucune n’existe en démonstration. La ' +
      'fabriquer demanderait un relevé calculé côté client, puis un jeu de dépenses ' +
      'taillé pour le rendre négatif : on mesurerait un décor, pas le produit. Tenue ' +
      'côté serveur par `honorairesDeGestion.test.ts`, dont un cas exige que le net ' +
      'sorte négatif plutôt que ramené à zéro.',
  },

  'app.meters.gapCount': {
    nonMesurable:
      'Elle ne paraît QU’AVEC UN ÉCART, et la démonstration n’en porte aucun : son ' +
      'profil saisonnier plafonne à 1,20 quand la règle demande le double. Lui en ' +
      'fabriquer un demanderait de truquer à la fois `READING_HISTORY_DEMO` et le semis ' +
      'du serveur — deux générateurs qui doivent rester d’accord —, ce qui est un lot à ' +
      'soi seul. CE QUI LA RENDRAIT MESURABLE EST NOMMÉ : une fuite semée sur un ' +
      'logement du parc de démonstration, dans les deux générateurs à la fois. Tenue ' +
      'en jsdom par `ecartAuPropreMois.test.tsx`, qui monte deux logements dont un seul ' +
      'a doublé.',
  },
  'app.data.closeFailed': {
    nonMesurable:
      'Elle dit une PANNE de la route de fermeture, et le bloc qui la porte n’existe ' +
      'qu’après un dossier préparé — donc sous une vraie session. La provoquer ' +
      'demanderait de casser la route le temps d’une mesure : on mesurerait la panne, ' +
      'pas le produit. Tenue en jsdom par `mesDonnees.test.tsx`.',
  },
  'auth.login.closureNotice': {
    nonMesurable:
      'Elle ne paraît qu’avec un ÉTAT DE NAVIGATION — la date d’effacement, portée ' +
      'depuis « Mes données » jusqu’à l’écran de connexion. Une porte qui ouvre une ' +
      'adresse n’en pose aucun, et l’inventer ici peindrait une phrase que le produit ' +
      'n’a pas rendue. Le chemin entier est tenu en jsdom par `mesDonnees.test.tsx`, ' +
      'qui ferme un compte et lit la date sur l’écran de connexion.',
  },
  'app.data.ready': {
    nonMesurable:
      'Elle ne paraît qu’avec un DOSSIER rendu par le serveur — donc sous une vraie ' +
      'session, que `mesure-ui` et ses voisines n’ouvrent pas. La démonstration ne peut ' +
      'pas la peindre sans fabriquer un dossier fictif, c’est-à-dire sans faire croire à ' +
      'un export que personne n’a produit. CE QUI LA RENDRAIT MESURABLE EST NOMMÉ : ' +
      '`espace-connecte` monte déjà sept sessions réelles derrière le vrai serveur ; ' +
      'ouvrir `/app/mes-donnees` et cliquer le geste y peindrait la note pour de vrai.',
  },
  'app.data.failed': {
    nonMesurable:
      'Elle dit une PANNE du serveur d’export. La provoquer demanderait de casser la ' +
      'route exprès le temps d’une mesure — ce qui mesurerait la panne, pas le produit. ' +
      'Elle est tenue en jsdom par `mesDonnees.test.tsx`, qui vérifie qu’un 500 rend ' +
      'cette phrase et AUCUN tableau ; ce que personne n’a vu, c’est sa géométrie.',
  },

  'app.readings.chargeNotCalled': {
    nonMesurable:
      'Elle ne paraît qu’APRÈS un relevé ENREGISTRÉ dont l’échéance du mois n’a pas ' +
      'encore été appelée. La démonstration n’écrit rien — `recordReading` y rend un ' +
      'refus, et le lui faire simuler peindrait une conséquence qui n’a pas eu lieu, ' +
      'ce que `check-i18n` refuse par ailleurs sous le nom d’aveu de simulation. ' +
      'CE QUI LA RENDRAIT MESURABLE EST NOMMÉ : `espace-connecte` monte déjà un parc ' +
      'réel avec son immeuble, son logement et son locataire ; poser un relevé par ' +
      'l’écran et déclarer la note dans sa table `NOTES_SOUS_APP` la peindrait pour de ' +
      'vrai. C’est le geste suivant, et il appartient au lot d’après.',
  },
  'app.readings.chargeAlreadyPaid': {
    nonMesurable:
      'Même empêchement que la note voisine, et un cran plus loin : elle demande une ' +
      'échéance APPELÉE puis un versement REÇU avant le relevé — trois écritures que ' +
      'seule une vraie session produit. Elle est tenue en jsdom par le cas serveur ' +
      '`refacturationReelle.test.ts`, qui vérifie que l’échéance ne bouge pas et que la ' +
      'réponse porte `already_paid` ; ce que personne n’a encore vu, c’est la PHRASE à ' +
      'l’écran. Même remède que ci-dessus.',
  },

  'app.tenant.accessEnds': {
    nonMesurable:
      'Elle ne paraît qu’à un locataire dont TOUS les baux sont terminés, dans la ' +
      'fenêtre d’accès du parc — un état que la démonstration ne produit pas, ' +
      'faute de bail terminé dans le jeu. ' +
      'CE N’EST PLUS UN AVEU, C’EST UN RENVOI : le septième profil annoncé ici a ' +
      'été écrit. `espace-connecte` monte un locataire dont le bail est daté à ' +
      'trente jours dans le passé — la date se pose EN BASE, aucune route ne ' +
      'terminant un bail au passé —, déclare la note dans sa table ' +
      '`NOTES_SOUS_APP`, et REFUSE si elle n’est pas peinte sur `/app/mon-espace`. ' +
      '`finDAcces.test.tsx` la tient toujours en jsdom pour la date et pour ' +
      'l’absence tant qu’un bail court.',
  },
  'app.dashboard.scopedNotice': {
    nonMesurable:
      'Elle ne paraît qu’à un gestionnaire dont l’adhésion porte un PÉRIMÈTRE ' +
      'd’immeubles, lu sur le portefeuille du serveur. La démonstration n’a ni ' +
      'adhésion ni serveur — `scoped` y vaut faux par construction, et le forcer ' +
      'à vrai peindrait un avertissement de restriction sur un parc entier, ce ' +
      'qui est l’exact contraire de ce que la note dit. ' +
      'ELLE EST GARDÉE AILLEURS, ET NOMMÉMENT : `espace-connecte` la déclare dans ' +
      'sa table `NOTES_SOUS_APP` et REFUSE si elle n’est pas peinte sur `/app` pour ' +
      'le gestionnaire borné. Ce n’est donc plus un aveu d’absence, c’est un ' +
      'renvoi : ce script-ci ne peut pas l’atteindre, une autre porte le fait.',
  },
  'app.dashboard.scopedNoticeNothing': {
    nonMesurable:
      'La jumelle de `scopedNotice`, et elle est MOINS couverte qu’elle — ce qui ' +
      'se dit plutôt que de se ranger sous le même motif. Elle ne paraît qu’à un ' +
      'gestionnaire borné À QUI RIEN N’EST CONFIÉ. La démonstration n’a ni ' +
      'adhésion ni serveur, donc pas plus qu’à sa voisine. ' +
      'ET `espace-connecte` NE LA PEINT PAS NON PLUS : son gestionnaire de sonde ' +
      'est borné à un immeuble sur deux, ce qui est précisément l’AUTRE branche. ' +
      'Lui donner un quatrième profil — un gestionnaire sans rien — est un lot à ' +
      'part, nommé ici et non fait. ' +
      'CE QUI LA GARDE AUJOURD’HUI : `rienNeLuiEstConfie.test.tsx`, sous jsdom, ' +
      'sur les deux branches et leurs non-régressions. C’est une garde de rendu, ' +
      'pas une mesure au navigateur, et l’écart est réel.',
  },
  'app.onboarding.delegationOffNotice': {
    nonMesurable:
      'DEUX CONDITIONS À LA FOIS : un parc réglé sur `delegation: solo` — que la ' +
      'démonstration ne peut pas porter, faute d’adhésion — ET l’ouverture de la ' +
      'modale d’invitation, car malgré son nom elle vit dans `InviteModal`. ' +
      'CE N’EST PLUS UN AVEU, C’EST UN RENVOI : `espace-connecte` ouvre désormais ' +
      'des modales, et son parc VIDE est déjà en `solo`. Il y ouvre l’invitation ' +
      'et REFUSE si la note n’y paraît pas — témoin : le parc repassé en ' +
      '`delegate` la fait rougir. ' +
      'MESURÉ en tentant de la garder : `espace-connecte` a été réglé sur `solo` ' +
      'et a cherché la note sur `/app/prise-en-main` — elle n’y était pas, et ne ' +
      'pouvait pas y être. Aucune des deux portes ne peut donc l’atteindre : ' +
      'celle-ci n’a pas d’adhésion, celle des modales balaie `/demo`, et celle de ' +
      'l’espace connecté n’ouvre aucune modale. ' +
      'LA TENTATIVE N’A PAS ÉTÉ PERDUE : le parc de sonde est resté en `solo`, et ' +
      'cet état-là a révélé un contraste de 2,46 sur « Gestionnaire délégué · non ' +
      'activé », sous le seuil dans les deux thèmes.',
  },
  'app.tenants.noVacantNotice': {
    nonMesurable:
      'Elle paraît quand le parc n’a PLUS AUCUN logement vacant. La démonstration ' +
      'en garde deux — B4 et C3 —, et ils sont ce qui rend mesurables la création ' +
      'de fiche et l’ajout de logement. Vider le parc pour voir cette note-ci en ' +
      'rendrait deux autres invisibles : l’échange est perdant. ' +
      'ELLE EST GARDÉE AILLEURS : `espace-connecte` monte un parc VIDE, qui n’a ' +
      'aucun logement donc aucun vacant, et refuse si la note n’y paraît pas. Le ' +
      'parc vide y existe pour d’autres raisons — il ne coûte rien de plus ici.',
  },
  'app.decisions.failed': {
    nonMesurable:
      'C’est un état d’ÉCHEC de lecture : il demande que le serveur refuse le ' +
      'registre. La démonstration sert le sien depuis le client et n’appelle ' +
      'personne. ' +
      'CE N’EST PLUS UN AVEU, C’EST UN RENVOI : `espace-connecte` parle à un VRAI ' +
      'serveur et peut donc lui faire dire non. Il INTERCEPTE la seule adresse du ' +
      'registre — 500, pas 404 : un registre absent et un registre illisible ne ' +
      'sont pas la même chose — et refuse si l’écran ne le dit pas. Casser le ' +
      'serveur pour de bon rendrait tous les autres écrans faux en même temps.',
  },
  'app.announce.delivered': {
    nonMesurable:
      'Elle ne paraît qu’APRÈS un envoi réussi, dans une modale que `modales` ' +
      'mesure fermée sur son état d’ouverture. La rendre visible ici demanderait ' +
      'd’envoyer une annonce à chaque passage de porte, donc d’écrire dans la ' +
      'démonstration à seule fin de la mesurer.',
  },
  'app.parkSettings.reminderChannelWhatsAppWarning': {
    adresse: '/demo/parc',
    geste: ouvrirLeCanalWhatsApp,
  },
  'app.parkSettings.currencyWarning': {
    nonMesurable:
      'Elle ne paraît qu’après avoir CHANGÉ la devise dans la modale de correction ' +
      'du parc. ' +
      'CE N’EST PLUS UN AVEU, C’EST UN RENVOI : le geste appartenait à `modales`, ' +
      'et il y a été écrit. `ParkSettings·devise` est un ÉTAT de plus de la même ' +
      'boîte — l’avertissement est purement client, donc la démonstration ' +
      'l’atteint — et ce script EXIGE désormais que la note paraisse après le ' +
      'geste : sans quoi c’est l’état d’ouverture qui serait mesuré deux fois, en ' +
      'silence. Le défilement passe de 48 à 205 px à 360, prix d’un avertissement ' +
      'qu’on ne veut pas raccourcir.',
  },
  'auth.forgot.sentBody': {
    nonMesurable:
      'Elle suit un ENVOI accepté par le serveur, et ce script tourne sur le ' +
      'paquet construit, sans serveur d’API. ' +
      'L’AVEU PRÉCÉDENT DÉSIGNAIT LE MAUVAIS HÔTE : il renvoyait à ' +
      '`politique-de-securite`, dont le serveur part sur un `DATABASE_URL` ' +
      'volontairement injoignable — il mesure des en-têtes, pas des parcours. ' +
      'C’EST UN RENVOI VERS `espace-connecte`, le seul à tenir un serveur ET une ' +
      'base : il demande le lien sur un compte dont le balayage est terminé et ' +
      'refuse si la note ne paraît pas.',
  },
  'auth.reset.successBody': {
    nonMesurable:
      'Elle suit une réinitialisation RÉUSSIE, donc un jeton valide. ' +
      'LE JETON EST INATTEIGNABLE PAR CONCEPTION, et c’est la vraie raison — ' +
      'mesurée en essayant, pas supposée. `PasswordReset` ne stocke que ' +
      '`tokenHash`, jamais le jeton, même règle que les sessions ; et ' +
      '`MessagerieJournal` n’imprime ni le corps ni le lien, « les journaux étant ' +
      'plus nombreux que ceux qui lisent la base ». Le jeton ne vit donc que dans ' +
      'un courriel qui n’est pas envoyé. L’atteindre demanderait d’injecter une ' +
      'messagerie de sonde DANS le serveur lancé — `espace-connecte` le lance ' +
      'dans un autre processus — ou d’affaiblir le journal. Ni l’un ni l’autre ne ' +
      'vaut cette note.',
  },
}

/* ══════════════════════════ LA MOITIÉ STATIQUE ══════════════════════════ */

/** Les fichiers de produit qui peuvent porter une note. */
async function sources(dossier) {
  const trouves = []
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) trouves.push(...(await sources(chemin)))
    else if (/\.tsx$/.test(entree.name) && !/\.test\.tsx$/.test(entree.name)) trouves.push(chemin)
  }
  return trouves
}

/**
 * La clé de chaque `<Notice>` — UNE PAR NOTE, et c'est la première.
 *
 * On part de chaque `<Notice`, on avance jusqu'à `</Notice>` quand il existe —
 * une note peut contenir un bouton, comme celles de ce jour —, sinon jusqu'à la
 * fin de la balise autofermante.
 *
 * SEULE LA PREMIÈRE CLÉ EST RETENUE, et ce n'est pas une approximation : une
 * note est UN état conditionnel, pas une collection. Le libellé du bouton
 * qu'elle porte — « Voir les codes en attente », « Modifier dans les réglages
 * du parc » — paraît au même instant, sous la même condition, au même endroit.
 * Le déclarer à part demanderait deux entrées pour une seule apparition et
 * ferait grossir le registre de lignes qui ne décident de rien.
 */
function clesDesNotes(code) {
  const cles = new Set()
  let i = code.indexOf('<Notice')
  while (i !== -1) {
    const ferme = code.indexOf('</Notice>', i)
    const auto = code.indexOf('/>', i)
    const fin = ferme !== -1 && (auto === -1 || ferme < auto) ? ferme : auto === -1 ? i + 400 : auto
    const premiere = code.slice(i, fin).match(/\bt\('([\w.]+)'/)
    if (premiere) cles.add(premiere[1])
    i = code.indexOf('<Notice', i + 1)
  }
  return cles
}

const plaintes = []
const fichiers = [
  ...(await sources(join(SRC, 'features'))),
  ...(await sources(join(SRC, 'routes'))),
]
const portees = new Map()
for (const fichier of fichiers) {
  const code = await readFile(fichier, 'utf8')
  for (const cle of clesDesNotes(code)) {
    if (!portees.has(cle)) portees.set(cle, [])
    portees.get(cle).push(relative(RACINE, fichier))
  }
}

for (const [cle, ou] of portees) {
  if (!(cle in REGISTRE)) {
    plaintes.push(
      `NON DÉCLARÉE — « ${cle} », portée par ${ou.join(', ')}.\n` +
        '   Une note conditionnelle que le registre ignore n’est rendue par aucune\n' +
        '   garde de navigateur : ni géométrie, ni contraste, ni débordement.\n' +
        '   Déclarez-la mesurable (adresse + geste) ou avouez-la, avec son motif.',
    )
  }
}
for (const cle of Object.keys(REGISTRE)) {
  if (!portees.has(cle)) {
    plaintes.push(
      `DÉCLARATION PÉRIMÉE — « ${cle} » n’est portée par aucun <Notice>.\n` +
        '   Une garde qui vérifie un écran disparu achète de la confiance sans la mériter.',
    )
  }
}
for (const [cle, entree] of Object.entries(REGISTRE)) {
  if (entree.nonMesurable && entree.nonMesurable.trim().length < 80) {
    plaintes.push(
      `AVEU SANS MOTIF — « ${cle} » se déclare non mesurable en moins de 80 signes.\n` +
        '   Un aveu qui n’explique rien est un silence avec une case cochée.',
    )
  }
}

/* ══════════════════════════ LA MOITIÉ AU NAVIGATEUR ══════════════════════════ */

/* LE PAQUET AVANT TOUT LE RESTE : ce script mesure `dist/`, jamais les
   sources. Un paquet périmé rendrait un verdict sur le code d'AVANT, en
   silence — voir `paquet-a-jour.mjs`, qui porte les trois cas mesurés. */
exigerUnPaquetAJour()


const fr = dictionnaireAPlat(await readFile(join(SRC, 'i18n/fr.ts'), 'utf8'))
const mesurables = Object.entries(REGISTRE).filter(([, e]) => !e.nonMesurable)
const releve = []
const serveur = await servirLaPrevisualisation('notes-conditionnelles', PORT)

try {
  const navigateur = await chromium.launch()
  for (const [cle, entree] of mesurables) {
    /**
     * TOUTES LES VARIANTES D'ACCORD, et pas la seule clé de base.
     *
     * La convention du dépôt porte l'accord sur des clés sœurs — `x`, `x_one`,
     * `x_many` — et `Intl.PluralRules` choisit. La note du locataire sans compte
     * l'a montré à la première exécution : le registre résolvait la forme
     * PLURIELLE, l'écran rendait la SINGULIÈRE, et la garde criait « absente »
     * sur une note parfaitement à l'écran. Une garde qui rougit à tort se
     * désarme aussi sûrement qu'une garde qui ne rougit jamais.
     */
    const variantes = [cle, `${cle}_one`, `${cle}_many`, `${cle}_few`, `${cle}_other`]
      .map((k) => fr.get(k))
      .filter((v) => v !== undefined)
    if (variantes.length === 0) {
      plaintes.push(`${cle} : introuvable dans le dictionnaire français.`)
      continue
    }
    const contexte = await navigateur.newContext({
      ...SANS_AGENT_DE_SERVICE,
      viewport: { width: 1280, height: 900 },
      locale: 'fr-FR',
      colorScheme: 'light',
    })
    const page = await contexte.newPage()
    try {
      await page.goto(BASE + entree.adresse, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(500)
      if (entree.profil) await choisirLeProfil(page, entree.profil)
      if (entree.geste) await entree.geste(page)
      await page.waitForTimeout(250)

      const texte = await page.evaluate(() => document.body.innerText)

      /*
        LE TEXTE EST CHERCHÉ PAR SES FRAGMENTS LITTÉRAUX.
        Un gabarit porte des jetons — « {count} locataires n'ont pas… » — dont
        la valeur n'est connue qu'à l'exécution. On coupe donc sur les jetons et
        l'on exige le plus long morceau de prose qui reste : c'est ce qui
        identifie la note sans dépendre de la donnée du jour.
      */
      const reperes = variantes
        .map(
          (modele) =>
            modele
              .split(/\{[^}]*\}/g)
              .map((m) => m.replace(/\\'/g, '’').trim())
              .filter((m) => m.length >= 12)
              .sort((a, b) => b.length - a.length)[0],
        )
        .filter(Boolean)
      const repere = reperes.find((r) => texte.includes(r)) ?? reperes[0]
      if (!repere) {
        plaintes.push(`${cle} : message trop court pour être cherché à l’écran.`)
      } else if (!texte.includes(repere)) {
        plaintes.push(
          `INTROUVABLE — « ${cle} » déclarée mesurable sur ${entree.adresse}, absente de l’écran.\n` +
            `   Cherché : « ${repere.slice(0, 60)}… »\n` +
            '   Soit le geste ne l’atteint plus, soit la démonstration ne produit plus\n' +
            '   l’état. Dans les deux cas, plus aucune garde de navigateur ne la voit.',
        )
      } else {
        /*
          LE GABARIT DOIT ÊTRE INTERPRÉTÉ. Défaut du 2026-08-31, invisible en
          jsdom : un message écrit en ICU imbriqué — que `t()` ne sait pas lire —
          s'affichait tel quel, accolades comprises, et le cas cherchait une
          sous-chaîne qui existe aussi dans le message cassé.
        */
        const jetons = variantes.flatMap((m) => [...m.matchAll(/\{[^}]*\}/g)].map((j) => j[0]))
        const survivants = jetons.filter((j) => texte.includes(j))
        if (survivants.length > 0) {
          plaintes.push(
            `GABARIT NON INTERPRÉTÉ — « ${cle} » laisse ${survivants.join(', ')} à l’écran.\n` +
              '   Le message s’affiche tel quel, accolades comprises. Vérifiez la\n' +
              '   convention d’accord du dépôt — `x` et `x_one` —, l’ICU n’est pas lu.',
          )
        } else {
          releve.push(
            `${cle}  ·  ${entree.adresse}` +
              (entree.profil ? ` (profil ${String(entree.profil).replace(/[/]/g, '')})` : ''),
          )
        }
      }
    } catch (erreur) {
      plaintes.push(`${cle} : le geste a échoué — ${String(erreur).split('\n')[0]}`)
    }
    await contexte.close()
  }
  await navigateur.close()
} finally {
  serveur.kill()
}

const avoues = Object.values(REGISTRE).filter((e) => e.nonMesurable).length

if (plaintes.length > 0) {
  console.error('\n✗ notes-conditionnelles\n')
  for (const p of plaintes) console.error('  · ' + p + '\n')
  exit(1)
}

console.log(
  `✓ notes-conditionnelles : ${releve.length} note(s) conditionnelle(s) atteintes au navigateur,\n` +
    `  ${avoues} avouée(s) non mesurable(s) avec leur motif, sur ${portees.size} déclarée(s).\n` +
    '  Ce script ne dit RIEN de la GÉOMÉTRIE d’une note — voir son en-tête.',
)
for (const r of releve) console.log('   ' + r)
