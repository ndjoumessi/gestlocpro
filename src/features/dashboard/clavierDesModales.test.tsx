import { describe, expect, it } from 'vitest'
import {
  attendreLeChargement,
  renderApp,
  screen,
  switchRole,
  userEvent,
  waitFor,
  within,
} from '@/test/render'
import type { Role } from '@/features/auth/signupState'

/**
 * TOUTE MODALE S'OUVRE, SE TIENT ET SE REND AU CLAVIER.
 *
 * Quatre propriétés, et il les faut toutes : ouvrir depuis le clavier, ne pas
 * pouvoir sortir du dialogue à la tabulation, fermer à Échap, retrouver le
 * focus sur le bouton qui a ouvert. Trois sur quatre ne font pas une modale
 * utilisable — c'est l'état dans lequel se trouvaient les deux panneaux de la
 * barre avant ce lot, et il a fallu les mesurer au navigateur pour le voir.
 *
 * POURQUOI CE FICHIER N'EXISTAIT PAS, ET POURQUOI IL N'AURAIT RIEN PROUVÉ.
 * `Modal` portait son piège depuis l'origine et `modalFocus.test.tsx` passait —
 * mais le prédicat de visibilité du piège était `offsetParent !== null`, et
 * `offsetParent` vaut TOUJOURS `null` sous jsdom, faute de mise en page. La
 * liste des focalisables était donc vide, le gestionnaire de Tab sortait par
 * son `length === 0`, et le piège ne s'exécutait pas. Un cas écrit avant la
 * correction du prédicat aurait été vert sans rien exercer.
 *
 * Le même prédicat écartait, dans un VRAI navigateur, tout focalisable
 * `position: fixed` — pour lequel `offsetParent` vaut également `null`. Le trou
 * était donc réel des deux côtés.
 */

interface Modale {
  nom: string
  /**
   * Le FICHIER qui rend cette modale, relatif à `src/`.
   *
   * Il ne sert pas à ouvrir la modale — `adresse` et `bouton` s'en chargent —
   * mais à RELIER ce registre au disque. Sans lui, une modale neuve n'entrait
   * dans aucun des deux registres du dépôt et rien ne rougissait : c'est ce que
   * les cas de complétude, en bas de ce fichier, ferment.
   */
  fichier: string
  adresse: string
  bouton: RegExp
  /**
   * Le rang du bouton quand le geste se RÉPÈTE par ligne.
   *
   * Absent, le bouton doit être UNIQUE et la garde le vérifie : viser
   * silencieusement le premier d'une liste laisserait un geste devenu ambigu
   * passer pour un geste précis. Mesuré : « Quittance » rend dix boutons sur
   * l'écran des encaissements, « Répondre » quatre sur celui des travaux — un
   * par ligne, ce qui est juste et n'a pas à être corrigé.
   */
  rang?: number
  /** Le profil sous lequel l'écran rend ce geste. Par défaut, celui du montage. */
  profil?: Role
  /**
   * CE QUE LA MODALE EST, et ce n'est pas une commodité de test.
   *
   * `saisie` : un formulaire. Ses champs doivent tous porter un libellé visible
   * relié — c'est le second cas de ce fichier.
   *
   * `lecture` : une pièce qu'on CONSULTE. La quittance n'a aucun champ, et
   * exiger qu'elle en porte ferait rougir un montage correct. Le déclarer
   * plutôt que sauter la vérification quand la liste est vide : ainsi un
   * formulaire qui perdrait ses champs rougit, au lieu d'être silencieusement
   * traité comme une pièce à lire.
   */
  forme: 'saisie' | 'lecture'
}

/**
 * LES CHAMPS QU'UN LIBELLÉ VISIBLE NE SERT PAS, ET POURQUOI.
 *
 * La règle du dessous est juste et reste entière : « on exige un `<label for>`
 * porteur de TEXTE ; `aria-label` reste toléré EN PLUS, jamais À LA PLACE ».
 * Elle vaut pour un champ qui se remplit seul.
 *
 * Elle ne vaut pas pour un SOUS-CONTRÔLE d'un champ COMPOSÉ, dont le libellé
 * visible couvre déjà le groupe et dont la valeur se lit elle-même. Poser un
 * second libellé au-dessus ajouterait une ligne à un formulaire de téléphone sur
 * un écran de 360 px — le marché de ce produit — pour ne rien apprendre à
 * personne : « Téléphone » est écrit dessus, et le contrôle affiche « +237 ».
 *
 * LA DISPENSE PORTE SUR UN CHAMP, PAS SUR UNE MODALE. Un second contrôle sans
 * libellé dans la même boîte devra s'inscrire ici à son tour, avec son motif —
 * c'est la différence entre une exception et une porte ouverte.
 */
const CHAMPS_SANS_LIBELLE_VISIBLE: { modale: string; nom: string; motif: string }[] = [
  {
    modale: 'Créer une fiche locataire',
    nom: 'Indicatif téléphonique',
    motif:
      'Sous-contrôle du champ COMPOSÉ « Téléphone » : le libellé visible du groupe le ' +
      'couvre, et le contrôle fermé affiche l’indicatif lui-même — « +237 » se lit sans ' +
      'qu’on le nomme. Un second libellé coûterait une ligne à 360 px et n’apprendrait ' +
      'rien. Trouvé par les cas de clavier le jour où cette modale y est entrée.',
  },
]

/** Où chaque modale s'ouvre, et par quel bouton. Une ligne par modale. */
const MODALES: Modale[] = [
  { nom: 'Ajouter un immeuble', fichier: 'features/dashboard/AddBuildingModal.tsx', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$/, forme: 'saisie' },
  { nom: 'Ajouter un logement', fichier: 'features/dashboard/AddUnitModal.tsx', adresse: '/demo/parc', bouton: /^Ajouter un logement$/, forme: 'saisie' },
  /* LES DEUX CORRECTIONS DU PARC, entrées avec le lot qui les crée. Elles ne
     s'inscrivent PAS toutes seules : ce registre est écrit à la main, et rien
     ne rougit quand une modale neuve l'oublie. Deux modales hors clavier
     seraient exactement l'angle mort que ce fichier existe pour fermer.

     Le nom du bouton porte sa cible — « Corriger le logement A1 » — parce que le
     geste se répète PAR LIGNE : sans cela il faudrait un `rang`, et viser
     silencieusement le premier d'une liste est ce que ce fichier refuse. */
  { nom: 'Corriger un immeuble', fichier: 'features/dashboard/EditBuildingModal.tsx', adresse: '/demo/parc', bouton: /^Corriger l’immeuble Résidence Bonamoussadi$/, forme: 'saisie' },
  { nom: 'Corriger un logement', fichier: 'features/dashboard/EditUnitModal.tsx', adresse: '/demo/parc', bouton: /^Corriger le logement A1$/, forme: 'saisie' },
  /* LA SAISIE D'UN RELEVÉ, entrée avec le lot qui la crée. Ce registre est écrit
     à la main et rien ne rougit quand une modale neuve l'oublie. */
  { nom: 'Saisir un relevé', fichier: 'features/dashboard/RecordReadingModal.tsx', adresse: '/demo/releves', bouton: /^Saisir un relevé$/, forme: 'saisie' },
  { nom: 'Ouvrir un chantier', fichier: 'features/dashboard/OpenWorkModal.tsx', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$/, forme: 'saisie' },
  { nom: 'Enregistrer un paiement', fichier: 'features/dashboard/RecordPaymentModal.tsx', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$/, forme: 'saisie' },
  /*
    CINQUIÈME, ET ELLE ÉTAIT INATTEIGNABLE. Le bouton de « Corriger le parc »
    était gardé par `adhesionActive`, c'est-à-dire par un COMPTE RÉEL : la
    démonstration n'en porte pas, donc il n'était pas rendu, donc ni ce fichier
    ni `scripts/modales.mjs` ne pouvaient l'ouvrir. Sa géométrie, ses couleurs
    et son clavier n'étaient vérifiés par personne. La garde suit désormais le
    rôle ACTIF, qui est connu en démonstration comme sur un vrai compte.
  */
  { nom: 'Corriger le parc', fichier: 'features/dashboard/ParkSettingsModal.tsx', adresse: '/demo/parc', bouton: /^Corriger le parc$/, forme: 'saisie' },
  /* Sixième, et dernière des deux qui étaient inatteignables — même garde, même
     confusion, même remède. Voir l'en-tête de `scripts/modales.mjs`. */
  { nom: 'Prix de refacturation', fichier: 'features/dashboard/TariffsModal.tsx', adresse: '/demo/releves', bouton: /^Prix de refacturation$/, forme: 'saisie' },
  /*
    ═══ LES SIX DERNIÈRES, ET POURQUOI ELLES ARRIVENT EN DERNIER ═══

    Ce fichier en jouait quatre, puis six. Les six qui manquaient n'étaient pas
    inatteignables — `scripts/modales.mjs` les ouvre depuis toujours — elles
    étaient simplement HORS DE CE FICHIER, et la ligne de succès de la porte
    l'annonçait à chaque passage. Leur clavier n'était vérifié nulle part : ni
    l'entrée du focus, ni le piège, ni Échap, ni le retour au bouton.

    Trois d'entre elles demandent plus qu'un clic sur un libellé, et c'est ce
    qui les avait laissées de côté :

      · « Quittance » et « Répondre » se répètent PAR LIGNE — dix et quatre
        boutons mesurés. Elles déclarent leur `rang` ;
      · « Signaler un problème » n'existe que pour le LOCATAIRE : l'écran des
        travaux ne le rend pas au bailleur. Elle déclare son `profil`.

    La quittance est la seule `lecture` des douze : une pièce qu'on consulte,
    sans un champ à remplir.
  */
  { nom: 'Quittance', fichier: 'features/dashboard/ReceiptModal.tsx', adresse: '/demo/paiements', bouton: /^Quittance$/, rang: 0, forme: 'lecture' },
  { nom: 'Établir un état des lieux', fichier: 'features/dashboard/InspectionModal.tsx', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$/, forme: 'saisie' },
  { nom: 'Inviter par code', fichier: 'features/dashboard/InviteModal.tsx', adresse: '/demo/locataires', bouton: /^Inviter par code$/, forme: 'saisie' },
  { nom: 'Prévenir les locataires', fichier: 'features/dashboard/AnnounceModal.tsx', adresse: '/demo/locataires', bouton: /^Prévenir les locataires$/, forme: 'saisie' },
  { nom: 'Répondre', fichier: 'features/dashboard/ReplyModal.tsx', adresse: '/demo/travaux', bouton: /^Répondre$/, rang: 0, forme: 'saisie' },
  { nom: 'Signaler un problème', fichier: 'features/dashboard/ReportModal.tsx', adresse: '/demo/travaux', bouton: /^Signaler un problème$/, profil: 'tenant', forme: 'saisie' },
  /*
    ═══ LES CONFIRMATIONS, ET C'ÉTAIT LE PLUS GRAND TROU ═══

    Douze modales étaient jouées : celles qu'un bouton ouvre du premier coup.
    Les CONFIRMATIONS ne s'ouvrent qu'après un premier geste — arbitrer une
    caution, retirer une fiche, retirer un accès, relancer les retards — et
    aucune garde ne les atteignait, ni celle-ci ni `scripts/modales.mjs`.

    Or ce sont celles où le clavier compte LE PLUS : on y décide d'un geste
    irréversible, et Échap y est la sortie de secours. Un piège de focus qui
    fuit sur un `alertdialog` de suppression laisse la tabulation derrière la
    boîte, sur l'écran qu'on est en train de modifier.

    TROIS SONT DES `lecture` : elles n'ont pas un champ, seulement une phrase et
    deux boutons. L'arbitrage, lui, est un formulaire — montant retenu et
    justification — donc ses champs doivent porter leur libellé.

    Elles se répètent PAR LIGNE, comme la quittance : d'où leur `rang`.
  */
  { nom: 'Arbitrer', fichier: 'features/dashboard/Deposits.tsx', adresse: '/demo/cautions', bouton: /^Arbitrer$/, rang: 0, forme: 'saisie' },
  { nom: 'Retirer une fiche', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Retirer$/, rang: 0, forme: 'lecture' },
  /* LES QUATRE DETTES QUE LA GARDE DE COMPLÉTUDE A RENDUES VISIBLES.

     Elles étaient déclarées `HORS_CLAVIER` le temps d'un lot — « une dette que
     ces cas viennent de rendre visible » — et ce lot-ci la paie. Ce sont des
     gestes ORDINAIRES du produit : corriger une fiche, en créer une, confier
     des immeubles, relier un membre à sa fiche.

     `rang: 0` sur « Corriger » parce que le geste se répète PAR LIGNE et que son
     nom accessible ne porte pas sa cible — contrairement à celui du parc, où
     « Corriger le logement A1 » désigne sa rangée. C'est une faiblesse réelle de
     cet écran-ci, nommée et non corrigée : elle appartient au sujet des NOMS
     ACCESSIBLES, pas à celui du clavier. */
  { nom: 'Corriger une fiche', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Corriger$/, rang: 0, forme: 'saisie' },
  { nom: 'Créer une fiche locataire', fichier: 'features/dashboard/Tenants.tsx', adresse: '/demo/locataires', bouton: /^Créer une fiche locataire$/, forme: 'saisie' },
  { nom: 'Confier des immeubles', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Confier des immeubles$/, rang: 0, forme: 'saisie' },
  { nom: 'Relier à une fiche', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Relier à une fiche$/, rang: 0, forme: 'saisie' },

  { nom: 'Retirer un accès', fichier: 'features/dashboard/Access.tsx', adresse: '/demo/acces', bouton: /^Retirer l’accès$/, rang: 0, forme: 'lecture' },
  { nom: 'Relancer les retards', fichier: 'features/dashboard/Payments.tsx', adresse: '/demo/paiements', bouton: /^Relancer les retards$/, forme: 'lecture' },
  /* La cinquième confirmation, entrée quand la démonstration a cessé de masquer
     le geste. `saisie` : elle porte un motif, qui est tout l'acte. */
  { nom: 'Mettre en demeure', fichier: 'features/dashboard/Payments.tsx', adresse: '/demo/paiements', bouton: /^Mettre en demeure$/, rang: 0, forme: 'saisie' },
]

/**
 * LA BOÎTE, QUEL QUE SOIT SON RÔLE.
 *
 * Ce fichier ne cherchait que `role="dialog"`. Les CONFIRMATIONS portent
 * `role="alertdialog"` — c'est le rôle juste, « pour les confirmations
 * destructives » dit `Modal` — si bien qu'aucune n'était trouvable ici. Le jour
 * où on a voulu les jouer, elles ont rougi sur « boîte introuvable », ce qui ne
 * disait rien de leur clavier.
 *
 * `waitFor` et non `findByRole` : ce dernier ne prend qu'un rôle, et enchaîner
 * deux attentes ferait payer le délai de la première à chaque confirmation.
 */
async function trouverLaBoite(): Promise<HTMLElement> {
  return await waitFor(() => {
    const boite = document.querySelector('[role="dialog"],[role="alertdialog"]')
    if (!boite) throw new Error('aucune boîte de dialogue ouverte')
    return boite as HTMLElement
  })
}

/**
 * Monte l'écran, pose le profil s'il en faut un, et rend le bouton d'ouverture.
 *
 * Le montage est partagé par les deux cas de ce fichier : ils ouvraient la même
 * modale par deux chemins écrits séparément, et l'un des deux aurait pu cesser
 * de l'ouvrir sans que l'autre le dise.
 */
async function ouvrirLEcran(modale: Modale): Promise<HTMLElement> {
  await renderApp(modale.adresse)
  await attendreLeChargement()
  if (modale.profil) {
    await switchRole(modale.profil)
    await attendreLeChargement()
  }

  /*
    LE MENU DE DÉBORDEMENT EST OUVERT D'ABORD, s'il y en a un.

    Trois de ces douze modales s'ouvrent depuis une action qui s'est repliée
    derrière trois points — corriger le parc, poser un prix, prévenir les
    locataires. Le cas continue de mesurer ce qui l'intéresse : l'entrée du
    focus, le piège, Échap, et le retour au bouton qui a ouvert. Ce bouton vit
    simplement une porte plus loin.
  */
  if (screen.queryAllByRole('button', { name: modale.bouton }).length === 0) {
    /* L'en-tête D'ABORD, la zone principale ensuite : deux niveaux replient —
       la rangée d'actions de la page, et les cartes d'intervention. La coquille
       porte le même attribut tout en haut pour son menu de compte ; l'ouvrir
       mènerait à la déconnexion, elle est donc hors du champ des deux
       sélecteurs. */
    const user = userEvent.setup()
    const candidats = [
      ...Array.from(
        document.querySelectorAll('[data-en-tete-de-page] [aria-haspopup="menu"]'),
      ),
      ...Array.from(document.querySelectorAll('main [aria-haspopup="menu"]')),
    ]
    for (const d of candidats) {
      await user.click(d as HTMLElement)
      if (screen.queryAllByRole('menuitem', { name: modale.bouton }).length > 0) break
      await user.keyboard('{Escape}')
    }
  }

  /* Une entrée de menu porte `menuitem` et non `button` : un `menu` n'admet que
     des `menuitem` parmi ses descendants signifiants, sans quoi il cesse
     d'annoncer « 2 sur 3 ». Les deux rôles sont donc cherchés. */
  const boutons = [
    ...screen.queryAllByRole('button', { name: modale.bouton }),
    ...screen.queryAllByRole('menuitem', { name: modale.bouton }),
  ]
  if (modale.rang === undefined) {
    /* Sans `rang` déclaré, le geste doit être UNIQUE : prendre le premier d'une
       liste reviendrait à choisir sans le dire, et le jour où un écran répète un
       bouton la garde doit le signaler plutôt que viser au hasard. */
    expect(boutons, `« ${modale.nom} » n’est pas unique sur son écran`).toHaveLength(1)
    return boutons[0]!
  }
  expect(
    boutons.length,
    `« ${modale.nom} » : rang ${modale.rang} demandé, ${boutons.length} bouton(s) rendus`,
  ).toBeGreaterThan(modale.rang)
  return boutons[modale.rang]!
}

async function parcoursClavier(modale: Modale) {
  const user = userEvent.setup()
  const ouvreur = await ouvrirLEcran(modale)
  ouvreur.focus()
  expect(document.activeElement).toBe(ouvreur)

  /* Ouvert au CLAVIER, pas à la souris : c'est le chemin qu'on garde. */
  await user.keyboard('{Enter}')
  const dialogue = await trouverLaBoite()

  /* LE FOCUS EST ENTRÉ. Une modale qui s'ouvre en laissant le focus derrière
     elle oblige à tabuler à travers toute la page pour l'atteindre. */
  expect(dialogue.contains(document.activeElement)).toBe(true)

  /* LE PIÈGE. Vingt tabulations : plus que la plus fournie de ces modales n'a
     de commandes, donc le tour est bouclé. On compte TOUTES les évasions pour
     que l'échec dise combien, et non seulement qu'il y en a eu. */
  const evasions: string[] = []
  for (let i = 0; i < 20; i++) {
    await user.tab()
    if (!dialogue.contains(document.activeElement)) {
      evasions.push((document.activeElement as HTMLElement)?.tagName ?? '?')
    }
  }
  expect(evasions, 'le focus est sorti de la modale ouverte').toEqual([])

  await user.keyboard('{Escape}')
  expect(document.querySelector('[role="dialog"],[role="alertdialog"]')).toBeNull()
  /*
    LE FOCUS REVIENT LÀ OÙ L'ON PEUT ENCORE ALLER.

    Pour neuf de ces douze modales, c'est le bouton qui a ouvert. Pour les trois
    qui vivent derrière trois points, ce bouton N'EXISTE PLUS : le menu s'est
    refermé en même temps qu'il agissait, et son entrée avec lui. Le focus
    remonte alors au déclencheur du menu — c'est-à-dire à l'endroit d'où
    l'utilisateur est parti, et le seul qui soit encore là pour le recevoir.

    Mesuré, et non prévu : la chaîne tient parce que le piège du MENU rend le
    focus à son déclencheur avant que celui de la MODALE ne note qui l'avait.
  */
  if (ouvreur.isConnected) {
    expect(document.activeElement, 'le focus n’est pas revenu au bouton d’ouverture').toBe(ouvreur)
  } else {
    /* Le geste vivait dans un menu, qui s'est refermé en agissant : son entrée
       n'existe plus. Le focus doit alors se poser sur LE DÉCLENCHEUR de ce
       menu — l'endroit d'où l'on est parti, et le seul encore là pour le
       recevoir. On ne nomme pas lequel : trois points d'en-tête ou trois points
       de carte, la règle est la même. */
    expect(
      (document.activeElement as HTMLElement)?.getAttribute('aria-haspopup'),
      'le focus n’est pas revenu au menu qui a ouvert',
    ).toBe('menu')
  }
}

describe('le clavier des modales', () => {
  for (const modale of MODALES) {
    it(`« ${modale.nom} » : ouverture, piège, Échap, retour du focus`, async () => {
      await parcoursClavier(modale)
    })
  }

  /**
   * CHAQUE CHAMP PORTE UN NOM, ET C'EST LE LIEN LIBELLÉ↔CHAMP QUI LE DONNE.
   *
   * Ce cas existe parce qu'une mutation l'a exigé et qu'AUCUNE garde ne la
   * voyait : couper le `htmlFor` de `Field` — donc séparer chaque libellé de son
   * contrôle — laissait la porte entièrement verte. Les cas de clavier
   * passaient (le focus circule très bien entre des champs anonymes), la mesure
   * des modales passait (la géométrie ne change pas), et `mesure-ui` aussi.
   *
   * Ce que la coupure détruit est invisible à l'œil et total au lecteur
   * d'écran : « zone de saisie, vide » à la place de « Montant, obligatoire,
   * zone de saisie ». C'est exactement l'interdit du sujet — ne jamais séparer
   * un libellé de son champ — et il se vérifie par le NOM ACCESSIBLE, qui est
   * la conséquence directe du lien.
   *
   * On interroge par `getAllByRole` puis `toHaveAccessibleName` plutôt que par
   * `getByLabelText` : le second passerait aussi sur un `aria-label` posé à la
   * main, ce qui est un autre montage — juste, mais qui ne prouve pas que le
   * libellé VISIBLE est relié.
   */
  for (const modale of MODALES) {
    it(`« ${modale.nom} » : chaque champ porte le nom de son libellé`, async () => {
      const ouvreur = await ouvrirLEcran(modale)
      await userEvent.click(ouvreur)
      const dialogue = await trouverLaBoite()

      /* `type="hidden"` EXCLU, et c'est mesuré, pas supposé : `DatePicker` et
         `MonthPicker` posent chacun un champ caché qui porte la valeur pour la
         soumission native du formulaire. Il n'a ni libellé ni focus — il n'est
         pas un champ pour l'utilisateur, c'est le fil qui relie le sélecteur au
         `<form>`. Les exiger nommés ferait rougir sur deux montages corrects. */
      /* `Array.from` et non un étalement : `DOM.Iterable` n'est pas dans les
         `lib` du projet applicatif, et un `NodeList` étalé ne compile pas. */
      const controles = Array.from(
        dialogue.querySelectorAll<HTMLElement>(
          'input:not([type="radio"]):not([type="hidden"]), select, textarea',
        ),
      ).filter((el) => !el.classList.contains('sr-only'))

      if (modale.forme === 'lecture') {
        /* Une pièce qu'on CONSULTE n'a rien à faire remplir. On ne saute pas la
           vérification : on exige l'inverse, sans quoi une modale de saisie qui
           perdrait ses champs passerait pour une pièce à lire. */
        expect(controles.map((el) => el.tagName.toLowerCase())).toEqual([])
        return
      }

      /* Une modale de saisie sans champ ne prouverait rien : on exige qu'il y en ait. */
      expect(controles.length, 'aucun champ à vérifier dans cette modale').toBeGreaterThan(0)
      /*
        UN LIBELLÉ VISIBLE, ET NON UN `aria-label` SEUL — c'est l'extension.

        La première rédaction acceptait l'un OU l'autre : un champ portant
        `aria-label="Montant"` sans rien à l'écran la satisfaisait. Or un
        libellé invisible ne sert QUE le lecteur d'écran ; le voyant qui revient
        sur un formulaire à moitié rempli n'a plus rien pour savoir ce qu'il
        remplit, et un `placeholder` disparaît à la première frappe. La règle du
        sujet est explicite : jamais un texte indicatif seul comme libellé.

        On exige donc un `<label for>` porteur de TEXTE. `aria-label` reste
        toléré EN PLUS, jamais À LA PLACE.
      */
      /*
        « VISIBLE » SE VÉRIFIE PAR LA CLASSE, ET C'EST UNE LIMITE ASSUMÉE.

        jsdom n'applique aucune feuille de style : `getBoundingClientRect` rend
        zéro pour tout, et rien n'y distingue un libellé peint d'un libellé
        masqué. La seule chose observable est donc la classe d'escamotage
        elle-même — celle qui écrête un pavé d'un pixel pour le laisser au
        lecteur d'écran et le retirer de l'écran.

        Le nom de la classe est assemblé par FRAGMENTS : ce fichier est balayé
        par le générateur d'utilitaires, et l'écrire en entier la produirait
        réellement dans la feuille livrée.

        CE QUE CELA NE VOIT PAS : un libellé masqué autrement — `hidden`, une
        couleur transparente, une hauteur nulle posée à la main, un parent
        escamoté. La vérification de VISIBILITÉ RÉELLE demanderait un vrai
        navigateur, et elle n'existe pas : c'est une dette, elle est nommée ici.
      */
      const escamote = 'sr' + '-' + 'only'
      /* Les dispenses se reconnaissent au NOM ACCESSIBLE du contrôle, seule
         chose stable ici : l'identifiant est engendré à chaque rendu. */
      const dispenses = new Set(
        CHAMPS_SANS_LIBELLE_VISIBLE.filter((c) => c.modale === modale.nom).map((c) => c.nom),
      )
      const sansLibelleVisible = controles
        .filter((el) => !dispenses.has(el.getAttribute('aria-label') ?? ''))
        .filter((el) => {
          const lab = el.id ? document.querySelector(`label[for="${el.id}"]`) : null
          if (!lab || !(lab.textContent ?? '').trim()) return true
          return lab.classList.contains(escamote)
        })
        .map((el) => `${el.tagName.toLowerCase()}#${el.id || '(sans id)'}`)
      expect(sansLibelleVisible, 'champ(s) sans libellé VISIBLE relié').toEqual([])
    })
  }

  /**
   * UNE SOUMISSION INVALIDE, ET L'ERREUR APPARAÎT AU CHAMP.
   *
   * Le lot précédent affirmait « l'erreur s'affiche au champ » pour l'avoir LU
   * dans `Field`. Personne ne l'avait déclenchée. Ce cas soumet « Ouvrir un
   * chantier » avec un intitulé vide — la borne est écrite dans la modale
   * comme sur le serveur, trois caractères — et vérifie trois choses :
   *   — un message apparaît ;
   *   — il est RATTACHÉ au champ par `aria-describedby`, donc annoncé quand on
   *     revient dessus, et pas seulement posé quelque part dans la boîte ;
   *   — le champ est marqué `aria-invalid`.
   * Un message en tête de modale satisferait la première condition et aucune
   * des deux autres : c'est précisément ce que le sujet interdit.
   */
  it('« Ouvrir un chantier » : une soumission invalide affiche l’erreur AU CHAMP', async () => {
    const user = userEvent.setup()
    await renderApp('/demo/travaux')
    await attendreLeChargement()
    await user.click(screen.getByRole('button', { name: /^Ouvrir un chantier$/ }))
    const dialogue = await trouverLaBoite()

    const champ = screen.getByRole('textbox', { name: /Que faut-il faire/ })
    expect(champ).not.toHaveAttribute('aria-invalid', 'true')

    await user.click(within(dialogue).getByRole('button', { name: /^Ouvrir le chantier$/ }))

    expect(champ, 'le champ n’est pas marqué invalide').toHaveAttribute('aria-invalid', 'true')
    const decritPar = (champ.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    expect(decritPar.length, 'le champ ne cite aucune description').toBeGreaterThan(0)
    const textes = decritPar.map((id) => document.getElementById(id)?.textContent ?? '')
    expect(
      textes.some((x) => x.trim().length > 0),
      'aucun des éléments cités par aria-describedby ne porte de texte',
    ).toBe(true)
    /* Le message est DANS la modale, et rattaché : les deux, pas l'un ou
       l'autre. Un message hors du dialogue serait une bannière. */
    expect(decritPar.some((id) => dialogue.contains(document.getElementById(id)))).toBe(true)
  })

  /**
   * LA GARDE DU GARDE, ET ELLE COMPTE CE QU'ELLE A JOUÉ.
   *
   * Une liste vidée par mégarde ferait passer ce fichier au vert avec zéro cas
   * exécuté — « aucun défaut » et « rien regardé » s'écriraient pareil. Le
   * nombre est ÉCRIT ici, jamais dérivé de `MODALES.length` : le dériver
   * rendrait la garde d'accord avec elle-même, piège trouvé par la même
   * mutation trois lots de suite.
   */
  it('ne dispense de libellé visible QUE des champs qui existent', () => {
    /* Une dispense qui ne décrit plus rien vaut une règle affaiblie, avec
       l'autorité d'un registre — les deux sens, comme partout ici. */
    const noms = new Set(MODALES.map((m) => m.nom))
    const mortes = CHAMPS_SANS_LIBELLE_VISIBLE.filter((c) => !noms.has(c.modale)).map(
      (c) => `${c.modale} · ${c.nom}`,
    )
    expect(mortes, `ces dispenses nomment une modale absente :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  it('donne un MOTIF à chaque champ dispensé', () => {
    const creuses = CHAMPS_SANS_LIBELLE_VISIBLE.filter((c) => c.motif.trim().length < 120).map(
      (c) => c.nom,
    )
    expect(creuses, 's’inscrire est un geste ; le motif est ce qui le rend relisible').toEqual([])
  })

  it('a bien joué les vingt-quatre modales déclarées', () => {
    expect(MODALES.length).toBe(24)
    expect(new Set(MODALES.map((m) => m.nom)).size).toBe(24)
    /* LES `lecture` SONT NOMMÉES, et l'écrire ici les protège : passer une
       modale de saisie en `lecture` pour faire taire un champ mal libellé est
       le contournement le plus facile de ce fichier. Il ferait rougir.

       Trois des quatre confirmations en sont : une phrase et deux boutons, pas
       un champ. L'arbitrage n'y est pas — il en porte deux. */
    expect(MODALES.filter((m) => m.forme === 'lecture').map((m) => m.nom)).toEqual([
      'Quittance',
      'Retirer une fiche',
      'Retirer un accès',
      'Relancer les retards',
    ])
  })
})
