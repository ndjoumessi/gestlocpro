import { describe, expect, it } from 'vitest'
import { attendreLeChargement, renderApp, screen, switchRole, userEvent, within } from '@/test/render'
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

/** Où chaque modale s'ouvre, et par quel bouton. Une ligne par modale. */
const MODALES: Modale[] = [
  { nom: 'Ajouter un immeuble', adresse: '/demo/parc', bouton: /^Ajouter un immeuble$/, forme: 'saisie' },
  { nom: 'Ajouter un logement', adresse: '/demo/parc', bouton: /^Ajouter un logement$/, forme: 'saisie' },
  { nom: 'Ouvrir un chantier', adresse: '/demo/travaux', bouton: /^Ouvrir un chantier$/, forme: 'saisie' },
  { nom: 'Enregistrer un paiement', adresse: '/demo/paiements', bouton: /^Enregistrer un paiement$/, forme: 'saisie' },
  /*
    CINQUIÈME, ET ELLE ÉTAIT INATTEIGNABLE. Le bouton de « Corriger le parc »
    était gardé par `adhesionActive`, c'est-à-dire par un COMPTE RÉEL : la
    démonstration n'en porte pas, donc il n'était pas rendu, donc ni ce fichier
    ni `scripts/modales.mjs` ne pouvaient l'ouvrir. Sa géométrie, ses couleurs
    et son clavier n'étaient vérifiés par personne. La garde suit désormais le
    rôle ACTIF, qui est connu en démonstration comme sur un vrai compte.
  */
  { nom: 'Corriger le parc', adresse: '/demo/parc', bouton: /^Corriger le parc$/, forme: 'saisie' },
  /* Sixième, et dernière des deux qui étaient inatteignables — même garde, même
     confusion, même remède. Voir l'en-tête de `scripts/modales.mjs`. */
  { nom: 'Prix de refacturation', adresse: '/demo/releves', bouton: /^Prix de refacturation$/, forme: 'saisie' },
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
  { nom: 'Quittance', adresse: '/demo/paiements', bouton: /^Quittance$/, rang: 0, forme: 'lecture' },
  { nom: 'Établir un état des lieux', adresse: '/demo/etats-des-lieux', bouton: /^Établir un état des lieux$/, forme: 'saisie' },
  { nom: 'Inviter par code', adresse: '/demo/locataires', bouton: /^Inviter par code$/, forme: 'saisie' },
  { nom: 'Prévenir les locataires', adresse: '/demo/locataires', bouton: /^Prévenir les locataires$/, forme: 'saisie' },
  { nom: 'Répondre', adresse: '/demo/travaux', bouton: /^Répondre$/, rang: 0, forme: 'saisie' },
  { nom: 'Signaler un problème', adresse: '/demo/travaux', bouton: /^Signaler un problème$/, profil: 'tenant', forme: 'saisie' },
]

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

  const boutons = screen.getAllByRole('button', { name: modale.bouton })
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
  const dialogue = await screen.findByRole('dialog')

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
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement, 'le focus n’est pas revenu au bouton d’ouverture').toBe(ouvreur)
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
      const dialogue = await screen.findByRole('dialog')

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
      const sansLibelleVisible = controles
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
    const dialogue = await screen.findByRole('dialog')

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
  it('a bien joué les douze modales déclarées', () => {
    expect(MODALES.length).toBe(12)
    expect(new Set(MODALES.map((m) => m.nom)).size).toBe(12)
    /* UNE SEULE `lecture`, et l'écrire ici la protège : passer une modale de
       saisie en `lecture` pour faire taire un champ mal libellé est le
       contournement le plus facile de ce fichier. Il ferait rougir. */
    expect(MODALES.filter((m) => m.forme === 'lecture').map((m) => m.nom)).toEqual(['Quittance'])
  })
})
