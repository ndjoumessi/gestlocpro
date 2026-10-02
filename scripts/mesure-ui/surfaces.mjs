/**
 * LES SURFACES INTERACTIVES — ce qu'on OUVRE pour pouvoir le mesurer.
 *
 * Un menu replié, un panneau fermé, une action d'en-tête : autant de pixels que
 * personne ne mesure tant que personne ne les ouvre. Ce fichier dit comment les
 * atteindre, et les deux comptes écrits à la main — surfaces et déclencheurs —
 * font qu'en ajouter une oblige à toucher un nombre, visible dans le diff.
 *
 * Module PUR : l'importer n'exécute rien.
 */

import { attendre } from './attentes.mjs'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RACINE } from './contexte.mjs'

/**
 * LES SURFACES QUI N'EXISTENT QU'APRÈS UN GESTE.
 *
 * ── Le trou, et il est PROUVÉ, pas supposé ────────────────────────────────
 *
 * Deux mutations d'un lot précédent ont rendu le verdict inverse de l'attendu :
 * remettre l'encre fautive sur le chiffre hors-mois du calendrier, puis sur le
 * libellé d'une série masquée, laissait cette porte VERTE. Le calendrier ne
 * s'ouvre qu'au clic, la série ne se masque qu'au clic, et rien ici n'a jamais
 * cliqué. Treize mille textes audités, et pas une seule surface interactive :
 * ce que le premier rendu ne montre pas n'était mesuré par personne.
 *
 * ── Ce qu'on ouvre, et ce qu'on laisse ────────────────────────────────────
 *
 * SIX surfaces, et le nombre est un arbitrage assumé. La porte dure déjà une
 * dizaine de minutes, dont sept de navigateur ; chaque ouverture se paie. Mieux
 * vaut six surfaces ouvertes et prouvées qu'une porte que l'on cesse de lancer.
 * Les deux premières sont exigées par les mutations qui ont découvert le trou —
 * elles sont la démonstration que la garde voit désormais ce qu'elle ne voyait
 * pas. Les quatre autres sont les surfaces que l'utilisateur rencontre le plus.
 *
 * LE TROU DES MODALES EST FERMÉ, et par la voie que cet en-tête annonçait :
 * « les auditer là-bas exigerait d'en extraire les deux sondes, donc un module
 * partagé de plus ». Le module existe — `sondes-de-rendu.mjs` — et
 * `modales.mjs` audite depuis le contraste (deux thèmes, racine posée sur le
 * dialogue) et les cibles de chacune de ses ouvertures. Une seule modale reste
 * auditée ICI, et par nécessité : le calendrier vit dedans, et cette surface-là
 * l'ouvre au fil d'un parcours que `modales.mjs` ne rejoue pas.
 *
 * ── Les règles que ce périmètre s'impose ──────────────────────────────────
 *
 * AUCUN DÉLAI FIXE. On attend le TÉMOIN — un nœud qui n'existe qu'une fois la
 * surface ouverte — jamais un élément que le décor porte déjà, et jamais un
 * nombre de millisecondes. C'est la règle du lot « un test attend une donnée,
 * pas un décor », transposée au navigateur.
 *
 * UNE SURFACE QUI NE S'OUVRE PAS FAIT ROUGIR. Elle n'est pas sautée : « pas
 * ouverte » ne doit jamais s'écrire comme « sans défaut ». C'est la panne que
 * ce fichier reproche déjà à `contrast-audit.js`.
 *
 * UN SEUL THÈME DE PLUS, PAS UNE LANGUE DE PLUS. La couleur ne dépend pas de la
 * langue — « Fermer » et « Close » se peignent pareil —, donc on balaie les deux
 * thèmes et une seule langue. Même raisonnement que les deux largeurs de la
 * passe de contraste, qui ignore déjà les onze autres.
 */
/**
 * OUVRE UNE ACTION D'EN-TÊTE, QU'ELLE SOIT SOUS LES YEUX OU REPLIÉE.
 *
 * Depuis que la rangée d'actions ne montre plus que deux commandes, les autres
 * vivent derrière trois points. Une sonde qui cherche son bouton par son nom
 * échoue alors sur une action qui n'a pas disparu — elle s'est repliée, et
 * `mesure-ui` a rapporté « la surface ne s'est pas ouverte » pour quatre
 * modales parfaitement saines.
 *
 * Le geste reproduit celui de l'utilisateur : chercher l'action ; si elle n'est
 * pas là, ouvrir le menu de L'EN-TÊTE — pas le premier de la page, la coquille
 * en porte déjà un pour le compte.
 */
export async function ouvrirUneActionDEnTete(page, nom) {
  const direct = page.getByRole('button', { name: nom }).first()
  if (await direct.count().then((n) => n > 0).catch(() => false)) {
    if (await direct.isVisible().catch(() => false)) {
      await direct.click()
      return
    }
  }
  await page.locator('[data-en-tete-de-page] [aria-haspopup="menu"]').first().click()
  await page.getByRole('menuitem', { name: nom }).first().click()
  /*
    LE GESTE N'EST PAS FINI QUAND LE MENU EST CLIQUÉ : IL EST FINI QUAND LE MENU
    EST PARTI.

    Depuis que les panneaux ancrés SORTENT au lieu de disparaître, le menu reste
    dans le document 150 ms de plus, `inert` et `aria-hidden`, pendant que la
    modale s'ouvre. Les deux sondes partaient alors sur une page à deux états.
    MESURÉ le 2026-09-24 sur `prix-de-refacturation` : 150 textes et 6 cibles en
    clair, 157 et 10 en sombre — LA MÊME page, dans LA MÊME exécution, selon qui
    gagnait la course.

    On attend donc le détachement plutôt qu'une durée : une attente en
    millisecondes redeviendrait fausse au premier réglage de la sortie.
  */
  await page
    .locator('[role="menu"]')
    .first()
    .waitFor({ state: 'detached', timeout: 2000 })
    .catch(() => {})
}

export const SURFACES_INTERACTIVES = [
  /*
    LES GESTES VISENT LA SÉMANTIQUE, PAS LA TRADUCTION.

    `aria-haspopup` déclare, dans la source même, « ceci ouvre quelque chose » —
    et les cinq déclencheurs à panneau du produit le portent. Viser cet attribut
    plutôt qu'un libellé traduit fait survivre le recensement à une retraduction
    et le fait mourir à une refonte du vocabulaire ARIA, ce qui est le bon sens
    de la dépendance. Là où aucun attribut ne distingue le déclencheur — la
    légende, le tiroir — on retombe sur le rôle et le nom accessible, comme
    `modales.mjs`.
  */
  {
    nom: 'legende-serie-masquee',
    adresse: '/demo',
    largeur: 1280,
    /* LE TÉMOIN EST L'ÉTAT ARIA, PAS LA RATURE.
       Une entrée de légende expose son état par `aria-pressed` (`Charts.tsx`) :
       enfoncée = série visible, relâchée = série masquée. `aria-pressed="false"`
       est donc EXACTEMENT « une série est masquée », et c'est la donnée que le
       geste produit. La première rédaction visait `.line-through` — une classe
       utilitaire, donc un détail de style : le jour où le masquage se marque
       autrement, le témoin disparaîtrait et la garde du garde rougirait pour un
       non-défaut. Un état ARIA porte du sens, une classe porte une apparence. */
    temoin: '[aria-pressed="false"]',
    ouvrir: async (page) => {
      await page.locator('[aria-pressed="true"]').first().click()
    },
  },
  {
    nom: 'calendrier-dans-la-modale',
    adresse: '/demo/paiements',
    largeur: 1280,
    temoin: '[role="dialog"][aria-label="Calendar"], [role="dialog"][aria-label="Calendrier"]',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: /^Record a payment$|^Enregistrer un paiement$/ }).first().click()
      await page.locator('[role="dialog"]').first().waitFor({ state: 'visible' })
      /*
        PAR L'ÉTIQUETTE DU CHAMP, et deux erreurs successives l'ont imposé.

        La modale de paiement porte DEUX déclencheurs `aria-haspopup="dialog"` :
        la PÉRIODE (choix du mois) puis la DATE. Une première rédaction de ce
        commentaire les disait « sans nom accessible » parce que leur `aria-label`
        est vide. C'ÉTAIT FAUX, et mesuré depuis : `Field` leur passe un `id` et
        rend un `<label for>`, d'où « Période couverte (obligatoire) » et « Date
        du versement (obligatoire) » — accname de Playwright rend ces deux noms.
        L'`aria-label` n'est qu'une des sources d'un nom, jamais le nom.

        Ce qui manquait n'était donc pas un nom mais l'usage du nom : un
        `.first()` borné à la modale ouvre « Choix du mois »,
        pas le calendrier — la garde aurait audité une surface en en nommant une
        autre, ce qui est pire qu'un trou puisque le rapport aurait menti.
        Un `.nth(1)` marcherait aujourd'hui et se tairait le jour où l'ordre des
        champs change. On vise donc l'ÉTIQUETTE, qui est ce que l'utilisateur
        lit et ce que le lecteur d'écran annonce.
      */
      await page.getByLabel(/Date du versement|Payment date/).click()
    },
  },
  {
    /*
      LA CORRECTION DU PARC, ET POURQUOI ELLE ENTRE ICI PLUTÔT QU'AILLEURS.

      `scripts/modales.mjs` mesure la GÉOMÉTRIE des onze modales, mais en thème
      CLAIR seulement — son contexte est ouvert `colorScheme: 'light'`. Le
      contraste des modales, lui, ne se mesure que par cette liste-ci, et une
      seule y figurait : le calendrier. Une modale de saisie a pourtant quatre
      familles de couleur — champs, indications, bandeau d'avertissement, pied —
      et aucune n'avait jamais été relevée en sombre.

      Celle-ci est la bonne candidate : elle porte les quatre, plus un `Notice`
      de ton `warn` qui n'apparaît qu'au changement de devise, et elle vient
      d'être rendue atteignable en démonstration. Elle était, jusqu'à ce lot,
      la modale la moins mesurée du produit — ni géométrie, ni couleurs, ni
      clavier.
    */
    nom: 'prix-de-refacturation',
    adresse: '/demo/releves',
    largeur: 1280,
    temoin: '[role="dialog"] form#tarif',
    ouvrir: async (page) => {
      await ouvrirUneActionDEnTete(page, /^Prix de refacturation$|^Rebilling prices$/)
      /*
        LE FORMULAIRE PROUVE LE GESTE, L'HISTORIQUE PROUVE LA DONNÉE, et ce ne
        sont pas le même instant.

        Le témoin de cette surface est `form#tarif` : il naît avec la modale,
        donc il ne dit que « le geste a ouvert quelque chose ». Sous le
        formulaire vit l'historique des prix, nourri par une lecture réseau ;
        vide, il rend un seul `<p>` (« aucun prix posé »), rempli, une liste de
        lignes. La garde auditait donc l'un ou l'autre au hasard : douze passes
        ont rendu 149 ou 156 textes, et le clair et le sombre se sont
        CONTREDITS À L'INTÉRIEUR D'UNE MÊME passe — signature d'une course,
        jamais d'un changement. L'écart, toujours de 7 textes, est exactement
        le message vide contre la liste.

        On attend donc la PREMIÈRE LIGNE, sans `.catch()` et sans délai court :
        le parc de démonstration sert toujours des prix (`TARIFS_DEMO` pose
        l'eau et l'électricité). Si cette ligne n'arrive pas, l'audit ne mesure
        rien et la passe DOIT rougir bruyamment.
      */
      await page.locator('[role="dialog"] [data-mesure="historique-des-prix"] li').first().waitFor({ state: 'visible' })
    },
  },
  {
    /*
      LA SECONDE MODALE DE SAISIE, ET ELLE PORTE CE QUE L'AUTRE N'A PAS : une
      LISTE de données sous un formulaire. Le contraste d'une ligne d'historique
      — un libellé, une date en gris secondaire, un montant — n'était relevé
      dans aucune modale, et celle-ci est la seule du produit à en porter une.
    */
    nom: 'correction-du-parc',
    adresse: '/demo/parc',
    largeur: 1280,
    temoin: '[role="dialog"] form#correction-du-parc',
    ouvrir: async (page) => {
      await ouvrirUneActionDEnTete(page, /^Corriger le parc$|^Correct the park$/)
    },
  },
  {
    nom: 'tiroir-de-navigation',
    adresse: '/demo',
    largeur: 360,
    /* Le tiroir monte un `aside` en `role="dialog"` nommé « Navigation
       principale » — il n'existe pas tant que le tiroir est replié. Viser ce
       rôle plutôt que deux classes Tailwind : une classe utilitaire change au
       premier ajustement de mise en page, un rôle ARIA porte du sens. */
    temoin: '[role="dialog"][aria-modal="true"]',
    ouvrir: async (page) => {
      await page.getByRole('button', { name: /Open navigation|Ouvrir la navigation/ }).first().click()
    },
  },
  {
    nom: 'panneau-des-reglages',
    adresse: '/demo',
    largeur: 1280,
    temoin: '[role="dialog"]',
    ouvrir: async (page) => {
      await page.locator('[aria-haspopup="dialog"]').first().click()
    },
  },
  {
    /*
      LE MÊME PANNEAU, MAIS SUR L'ÉCRAN DE CONNEXION, ET CE N'EST PAS UN DOUBLON.

      Trois choses diffèrent de celui de `/demo`, et chacune suffirait :

      1. LE FOND. Dans la coquille applicative le panneau flotte au-dessus d'une
         page de travail ; ici il flotte au-dessus de la carte d'authentification,
         qui est peinte sur `surface-sunken`. Ce n'est pas la même paire, donc pas
         le même contraste, et le contraste est ce que cette liste mesure.

      2. LA LARGEUR. 360 délibérément : c'est à cette largeur que la rangée de
         réglages se repliait sur deux lignes et poussait le `<h1>` à 37 % de la
         fenêtre — le défaut qui a fait naître ce composant. L'auditer à 1280 le
         montrerait au large, c'est-à-dire là où il n'a jamais posé problème, et
         `max-w-[calc(100vw-2.5rem)]` ne serait jamais éprouvé.

      3. LE CHEMIN. `/connexion` n'est pas sous `/demo` : aucune des surfaces de
         cette liste n'y passait, et le balayage ordinaire ne rend pas non plus
         les écrans d'authentification en sombre.
    */
    nom: 'reglages-a-la-connexion',
    adresse: '/connexion',
    largeur: 360,
    temoin: '[data-mesure="reglages-authentification"]',
    ouvrir: async (page) => {
      await page.locator('[data-declencheur-reglages]').first().click()
    },
  },
  {
    /*
      LE MÊME PANNEAU SUR LE 404, et il entre pour la même raison que celui de la
      connexion : le FOND diffère.

      L'écran 404 n'a pas de carte — le panneau y flotte au-dessus de `bg-canvas`,
      sous un en-tête bordé, là où celui de l'authentification flotte au-dessus
      d'une carte peinte sur `surface-sunken`. Ce n'est pas la même paire.

      Il entre aussi parce que ce panneau vient d'y remplacer trois sélecteurs en
      ligne : l'en-tête passe de 193 à 69 px à 360, et le `<h1>` de 300 à 238 —
      de 33 % à 26 % de la fenêtre. Un geste qui déplace un tiers d'écran mérite
      d'être audité là où il agit, pas seulement là où il est né.
    */
    nom: 'reglages-sur-le-404',
    adresse: '/adresse-qui-n-existe-pas',
    largeur: 360,
    temoin: '[data-mesure="reglages-authentification"]',
    ouvrir: async (page) => {
      await page.locator('[data-declencheur-reglages]').first().click()
    },
  },
  {
    /*
      LA RANGÉE DE PHOTOS D'UNE RÉSERVE, ET LE GESTE VA JUSQU'À LA VIGNETTE.

      Ouvrir la modale ne suffirait pas. Tant qu'aucune photo n'est choisie, la
      rangée ne porte qu'un bouton d'ajout et un compte — le bouton de RETRAIT,
      lui, n'existe pas, et c'est la cible la plus exposée de toute
      l'interface : 44 px posés sur le coin d'une vignette, atteints au doigt.
      Une surface auditée sans lui aurait laissé passer exactement ce que cet
      audit existe pour voir.

      Le geste dépose donc la FIXTURE VERSIONNÉE dans l'entrée de fichier —
      celle-là même que `photo-transcodage.mjs` mesure. Elle est sous CC0, elle
      vit dans le dépôt, et elle traverse le vrai transcodage : la vignette
      auditée est le produit de la fonction réelle, pas une image posée là pour
      la garde.

      LARGEUR 360, délibérément. C'est au téléphone que la rangée est le plus à
      l'étroit et que la vignette pousse ses voisins ; l'auditer à 1280 la
      montrerait au large, c'est-à-dire là où elle ne pose pas de problème.
    */
    nom: 'photos-de-reserve',
    adresse: '/demo/etats-des-lieux',
    largeur: 360,
    temoin: '[role="dialog"] li img',
    ouvrir: async (page) => {
      await page
        .getByRole('button', { name: /^Record an inspection$|^Établir un état des lieux$/ })
        .first()
        .click()
      await page.locator('[role="dialog"]').first().waitFor({ state: 'visible' })
      /* UNE PHOTO APPARTIENT À UNE RÉSERVE, et la liste des réserves part vide
         depuis le 2026-09-11 : il n'y a plus de champ de fichier à l'ouverture.
         Cette surface l'a appris en ne s'ouvrant plus — son témoin
         « li img » ne trouvait aucun `li`. */
      await page
        .locator('[role="dialog"]')
        .getByRole('button', { name: /^Add a finding$|^Ajouter une réserve$/ })
        .click()
      await page
        .locator('[role="dialog"] input[type="file"]')
        .first()
        .setInputFiles(join(RACINE, 'server/src/stockage/fixtures/compteur-index.jpg'))
      await page.locator('[role="dialog"] li img').first().waitFor({ state: 'visible' })
    },
  },
  {
    /*
      LA RÉSERVE REPLIÉE EN CARTE, qu'aucun premier rendu ne montre.

      Elle n'existe qu'après une suite de gestes — ajouter, nommer la pièce,
      décrire, « Terminer ». Sa pastille « Dégradé » est le seul aplat `danger`
      de la modale, et sa ligne « Imputation · 1 photo » la seule mention en
      `text-label` sur `muted` : sans cette surface, ni l'une ni l'autre n'était
      regardée par une seule règle.

      SORTIE, DÉGRADÉ, UN MONTANT ET UNE PHOTO : la carte la plus chargée, donc
      celle dont les rangées se replient le plus. 360 px pour la même raison que
      la surface précédente.
    */
    nom: 'reserve-repliee',
    adresse: '/demo/etats-des-lieux',
    largeur: 360,
    temoin: '[role="dialog"] li [data-geste="modifier"]',
    ouvrir: async (page) => {
      await page
        .getByRole('button', { name: /^Record an inspection$|^Établir un état des lieux$/ })
        .first()
        .click()
      const modale = page.locator('[role="dialog"]').first()
      await modale.waitFor({ state: 'visible' })
      await modale.getByRole('button', { name: /^Move-out$|^Sortie$/ }).click()
      await modale.getByRole('button', { name: /^Add a finding$|^Ajouter une réserve$/ }).click()
      await modale.getByLabel(/^Room$|^Pièce$/).fill('Séjour')
      await modale
        .getByLabel(/^Finding$|^Constat$/)
        .fill('Mur défoncé sur un mètre, à hauteur de la prise')
      await modale.getByLabel(/^Charge$|^Imputation$/).fill('35000')
      await modale.getByRole('button', { name: /^Damaged$|^Dégradé$/ }).click()
      await modale
        .locator('input[type="file"]')
        .first()
        .setInputFiles(join(RACINE, 'server/src/stockage/fixtures/compteur-index.jpg'))
      await modale.locator('li img').first().waitFor({ state: 'visible' })
      await modale
        .getByRole('button', { name: /^Finish finding 1$|^Terminer la réserve n° 1$/ })
        .click()
    },
  },
  {
    /*
      LA COQUILLE DU LOCATAIRE, QUE RIEN N'AVAIT JAMAIS REGARDÉE.

      Ce n'est pas une barre BASSE : le locataire n'en a pas. Il a une barre
      HAUTE — logo, trois destinations, réglages — un composant entier
      (`BarreLocataire`) que le balayage ordinaire ne rend JAMAIS, parce que la
      démonstration démarre en propriétaire et que rien ne change de profil.
      Contraste, cibles de 44 px, noms accessibles : aucune des trois règles ne
      l'avait vue une seule fois.

      LE GESTE PASSE PAR 1280 PX, ET C'EST FORCÉ. Le sélecteur de profil vit
      dans la barre latérale, qui n'existe qu'au-dessus de `lg` ; la coquille du
      locataire, elle, est intéressante à 320, là où elle empile logo, nav et
      réglages sur trois rangées. On bascule donc au large, puis on redescend —
      le rôle est un état React, il survit au redimensionnement et ne survit PAS
      à une navigation, ce qui évite d'empoisonner la suite du balayage.

      320 PX, LA PLUS ÉTROITE. C'est là que cette barre est le plus contrainte,
      et la seule largeur où l'auditer apprend quelque chose.

      L'ADRESSE FINALE N'EST PAS `/demo`, ET C'EST VOULU : basculer en locataire
      redirige vers `/demo/mon-espace`, puisque l'index du tableau de bord ne
      lui est pas destiné. La coquille auditée est la même — c'est elle le
      sujet, pas l'écran qu'elle encadre.
    */
    nom: 'barre-du-locataire',
    adresse: '/demo',
    largeur: 320,
    temoin: '[data-mesure="barre-locataire"]',
    ouvrir: async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      /*
        ON CLIQUE L'ÉTIQUETTE, PAS LE BOUTON RADIO — mesuré, pas supposé.

        Le radio est masqué visuellement (`sr-only`), et `check()` attend
        l'actionnabilité : il expire au bout de trente secondes. `getByRole`
        ne le trouve pas davantage — les cas de ce dépôt le cherchent
        d'ailleurs avec `hidden: true`. L'étiquette, elle, est la vraie cible :
        c'est ce que le doigt touche.
      */
      await page.locator('label:has(input[value="tenant"])').click()
      await page.setViewportSize({ width: 320, height: 900 })
      /*
        ON ATTEND QUE LA PAGE SE POSE, et ce n'est pas une précaution de style.

        Basculer en locataire REDIRIGE vers `/demo/mon-espace` : le témoin
        apparaît dès que la coquille se monte, bien avant que l'écran qu'elle
        encadre n'ait ses données. Mesuré sans cette attente : 136 textes et
        42 cibles auditées en thème clair, 9 et 8 en sombre — le même geste, la
        même surface, un rapport qui varie du simple au quinzième selon qui
        gagne la course. Le témoin dit que la surface EXISTE ; il ne dit pas
        qu'elle est PRÊTE.
      */
      await attendre(page, 'barre-du-locataire')
    },
  },
  {
    /*
      LE GESTE DU LOCATAIRE, ET NON PLUS SEULEMENT SA COQUILLE.

      La surface `barre-du-locataire`, juste au-dessus, a fermé la COQUILLE du
      locataire. Elle n'a pas fermé ses ÉCRANS, et la nuance a coûté un trou
      entier : `Signaler.tsx` garde son formulaire derrière
      `peutDeclarer = role === 'tenant' && mesUnites[0]`, et le balayage
      ordinaire tourne en propriétaire.

      MESURÉ AVANT D'ÉCRIRE CETTE ENTRÉE, à 1280 px, en comptant les commandes
      dans `<main>` : propriétaire 430 caractères et ZÉRO commande, locataire
      684 et ONZE. Onze commandes — un champ de titre, un groupe de métiers en
      `radiogroup`, un groupe d'urgence, une zone de texte, l'envoi — que ni le
      contraste, ni la sonde des cibles, ni les noms accessibles n'avaient
      jamais vues. Le témoin de cette entrée l'a prouvé en rougissant d'abord :
      posée sur `/demo/signaler` SANS bascule de rôle, elle a rendu « la surface
      ne s'est pas ouverte » aux deux thèmes. C'est le rôle qui manquait, pas le
      sélecteur.

      LA NAVIGATION SE FAIT AU CLIC, ET C'EST OBLIGATOIRE. L'entrée du dessus
      l'écrit déjà : « le rôle est un état React, il survit au redimensionnement
      et ne survit PAS à une navigation ». Un `page.goto('/demo/signaler')`
      après la bascule rechargerait le document et retomberait en propriétaire —
      la surface s'ouvrirait sur la page NUE, et la porte auditerait 430
      caractères sans commande en croyant tenir le formulaire. Le témoin le
      refuserait, mais un témoin qui rattrape une erreur de geste vaut moins
      qu'un geste juste.

      1280 POUR LE GESTE, 360 POUR LA MESURE, comme la surface du dessus et pour
      la même raison : le sélecteur de profil vit dans la barre latérale, qui
      n'existe qu'au-dessus de `lg`. La mesure, elle, se fait à la largeur où ces
      onze commandes sont le plus contraintes — c'est celle du marché visé, pas
      celle du bureau.
    */
    nom: 'declaration-du-locataire',
    adresse: '/demo',
    largeur: 360,
    temoin: '[data-mesure="declaration-du-locataire"]',
    ouvrir: async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      /* L'ÉTIQUETTE, PAS LE BOUTON RADIO — le radio est `sr-only`, et `check()`
         attend l'actionnabilité : il expire. Voir `barre-du-locataire`. */
      await page.locator('label:has(input[value="tenant"])').click()
      /* La bascule REDIRIGE vers `/demo/mon-espace`. On attend que cet écran se
         pose avant de viser son lien : le témoin dit qu'une surface existe, pas
         qu'elle est prête, et la coquille se monte bien avant ses données. */
      await attendre(page, 'declaration-du-locataire')
      await page
        .getByRole('link', { name: /^Signaler$|^Report$/ })
        .first()
        .click()
      await page.setViewportSize({ width: 360, height: 900 })
      await attendre(page, 'declaration-du-locataire')
    },
  },
]

/**
 * LE RECENSEMENT SE DÉDUIT, il ne se recopie pas.
 *
 * Une liste de surfaces écrite à la main se périme au premier renommage, et
 * son silence ressemble à un acquittement. On compte donc, DANS LA SOURCE, les
 * déclencheurs à panneau — `aria-haspopup`, que le produit pose sur chacun — et
 * l'on exige que ce nombre reste celui qu'un humain a arbitré. En ajouter un
 * sans toucher ce fichier fait rougir : l'auteur doit alors dire s'il entre dans
 * le périmètre audité ou s'il en est écarté, et pourquoi.
 *
 * CE QUE LE COMPTE NE VOIT PAS, et il faut le dire : `Combobox` n'annonce PAS
 * `aria-haspopup` — il se déclare par `aria-expanded` et un `role="listbox"`.
 * Il échappe donc à ce recensement comme il échappe au périmètre. C'est une
 * incohérence du produit, nommée ici et laissée : la corriger touche l'ARIA
 * d'un composant, ce qui est un autre sujet que mesurer des surfaces.
 */
export function declencheursDePanneau() {
  const trouves = []
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name)
      if (entree.isDirectory()) parcourir(chemin)
      /* `src/test/` EST ÉCARTÉ, et ce n'est pas un élargissement commode : le
         harnais y CHERCHE des déclencheurs pour les ouvrir — « le geste de
         l'utilisateur : chercher l'action, et ouvrir le menu si elle n'est pas
         là ». Deux occurrences de la CHAÎNE qui ne posent aucun panneau. Les
         compter ferait dire au recensement qu'il y a deux surfaces de plus à
         auditer, et l'audit irait les chercher dans le produit, où elles ne
         sont pas. */
      else if (
        /\.tsx$/.test(entree.name) &&
        !entree.name.includes('.test.') &&
        !chemin.includes('/src/test/')
      ) {
        const source = readFileSync(chemin, 'utf8')
        const n = [...source.matchAll(/aria-haspopup/g)].length
        if (n > 0) trouves.push({ fichier: chemin.replace(RACINE + '/', ''), n })
      }
    }
  }
  parcourir(join(RACINE, 'src'))
  return trouves
}

/* 7 = deux dans la coquille (réglages, menu du compte), deux dans le sélecteur
   de date (jour et mois), un dans le sélecteur de devise, un sixième depuis
   que les écrans d'AUTHENTIFICATION replient leurs trois réglages derrière un
   déclencheur (`PanneauDeReglages`) — il entre dans le périmètre audité sous le
   nom `reglages-a-la-connexion`, et la ligne qui le décrit dit pourquoi il ne
   fait pas doublon avec celui de la coquille.

   LE SEPTIÈME EST LE MENU DE DÉBORDEMENT DES EN-TÊTES DE PAGE. Une seule
   occurrence dans la source pour QUATRE écrans — paiements, locataires, parc,
   relevés —, parce que c'est une primitive et non un panneau recopié : c'est
   précisément ce que les six premiers n'étaient pas, et la raison pour laquelle
   ce recensement existe. Il monte de un, pas de quatre. */
export const DECLENCHEURS_ATTENDUS = 7


/*
  ATTENDU ÉCRIT, JAMAIS CALCULÉ — même piège que celui de `modales.mjs`.

  `SURFACES_INTERACTIVES.length * THEMES.length` rendrait la garde d'accord avec
  elle-même : vider la table, et l'on comparerait 0 à 0 avant de se déclarer
  vert. Le nombre est donc écrit, et l'ajout d'une surface oblige à le toucher.

  24 = 12 surfaces × 2 thèmes.
*/
export const SURFACES_ATTENDUES = 24









/*
  ═══ TROIS TOLÉRANCES RETIRÉES, ET POURQUOI LE JUGEMENT A CHANGÉ ═══

  Trois entrées vivaient ici, chacune exacte et chacune raisonnable :

    span.block text-body                   3 px  « Contrat de bail signé »,
      « 185 px avant le bord de la carte […] C'est la plus petite chose que cette
      règle sache voir, et elle ne se voit pas. »
    p.numeric mt-2 text-title-l …         18 px  « 447 000 FCFA »,
      « mange les 20 px de rembourrage, s'arrête 3 px avant la bordure. Rien
      n'est coupé ; le montant est collé au bord. »
    p.numeric mt-2 text-kpi …             10 px  « 950 000 FCFA »,
      « 7 px hors de sa boîte, et 89 px de marge avant le bord. Invisible. »

  LES TROIS MOTIFS DISAIENT VRAI, et les trois verdicts se tenaient : ces
  dépassements ne se voient pas. Ce qu'aucun ne disait — parce que cette règle-ci
  ne le mesure pas — c'est ce que la boîte OFFRAIT : 46 px pour un libellé dont
  le premier mot en réclame 49 ; 111 px pour un montant qui en veut 129 ; 160 px
  pour un montant qui en veut 170.

  Le défaut n'était donc pas le dépassement, c'était la colonne. Et il ne se
  jugeait pas au pixel qui sort, mais à la place qui reste. `MESURER_DEBORDEMENT_-
  DE_MOT` rapporte les DEUX chiffres — le manque ET l'offert —, et c'est le
  second qui a changé la lecture des trois. Deux règles ont vu les mêmes pixels ;
  celle qui disait combien de place il restait a fait poser la bonne question.

  Les entrées partent parce que les défauts sont réparés, non parce qu'on les a
  réévalués. La garde du garde l'a exigé dès que la sonde a cessé de les voir.
*/
