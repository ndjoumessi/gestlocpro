import {
  Children,
  createContext,
  useContext,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { usePiegeDeFocus } from './piegeDeFocus'
import { useSortieDifferee } from '@/lib/useSortieDifferee'

/* React 18 ne connaît pas `inert` comme propriété JSX : `inert={vrai}` y vaut un
   avertissement et l'attribut n'est PAS posé. En JSX, la forme équivalente est
   un étalement conditionnel de cet objet. Déclaré ici plutôt qu'importé
   d'`AppShell` : une primitive ne dépend pas d'une coquille d'application —
   c'est le raisonnement de `Modal.tsx:14`, et la même ligne. */
const INERTE = { inert: '' } as unknown as { inert?: string }

/** Durée de la sortie, en miroir de `surface-pop-sortie` (`--duration-fast`). */
const SORTIE_MS = 150

/**
 * LE MENU DE DÉBORDEMENT — trois points, un panneau, et rien d'autre.
 *
 * ═══ POURQUOI IL N'EXISTAIT PAS, ET POURQUOI IL FALLAIT L'ÉCRIRE ═══
 *
 * Le dépôt porte quatre panneaux ancrés — le menu de compte, le panneau des
 * réglages, le sélecteur de date, la liste cherchable — et pas une primitive
 * commune. Chacun refait le même ancrage, la même altitude, le même piège de
 * focus. Le cinquième aurait été le cinquième doublon.
 *
 * Ce qui est PARTAGÉ vient donc de `usePiegeDeFocus`, écrit une fois pour les
 * deux panneaux de la coquille : Échap, clic extérieur, retour du focus au
 * déclencheur, et la boucle de tabulation. Ce fichier n'ajoute que la géométrie
 * et le rôle.
 *
 * ═══ IL NE S'OUVRE QUE S'IL A QUELQUE CHOSE À DIRE ═══
 *
 * `enfants` vide rend `null`. C'est la règle que la coquille énonce à propos de
 * sa cloche de notifications absente — « un bouton qui n'ouvre rien est le
 * défaut » — et elle vaut d'autant plus ici : trois points sont une PROMESSE
 * qu'il y a autre chose. Un déclencheur qui ouvre le vide est pire qu'un espace
 * blanc, parce qu'on l'a cliqué pour le savoir.
 *
 * ═══ `role="menu"`, ET CE QUE ÇA ENGAGE ═══
 *
 * Un `menu` n'admet que des `menuitem` parmi ses descendants signifiants, et il
 * annonce « 2 sur 3 ». C'est ce que `MenuElement`, plus bas, garantit : les
 * appelants passent des éléments de menu, pas des boutons quelconques. Un
 * `<Button>` posé là porterait `role="button"` et casserait le décompte — le
 * dépôt s'est déjà fait avoir une fois avec un `listbox` dont les options
 * vivaient dans des `div`.
 *
 * ═══ CE QU'IL NE FAIT PAS ═══
 *
 * Pas de navigation aux flèches. `usePiegeDeFocus` boucle déjà la TABULATION
 * dans le panneau, ce qui rend chaque entrée atteignable au clavier ; les
 * flèches seraient un second système à tenir, et `ongletsAuClavier` existe déjà
 * pour les rangées d'onglets, qui ont, elles, un point d'entrée unique. Le jour
 * où un menu portera dix entrées, la question se posera pour de bon.
 *
 * Pas de repositionnement automatique non plus : le panneau s'ancre à droite de
 * son déclencheur, qui vit au bout d'une rangée alignée à droite. Un menu qui
 * s'ouvrirait vers la droite sortirait de la fenêtre — c'est le même
 * raisonnement, et la même valeur, que le panneau des réglages.
 */
/**
 * LA FERMETURE, PASSÉE PAR CONTEXTE PLUTÔT QUE PAR PROPRIÉTÉ.
 *
 * Une entrée de menu doit refermer le panneau en même temps qu'elle agit : un
 * menu resté ouvert au-dessus de l'écran qu'on vient de changer laisse croire
 * que rien n'a eu lieu. L'appelant, lui, ne connaît que son action — lui faire
 * porter `onClose` en plus reviendrait à lui confier une mécanique qui n'est pas
 * la sienne, et le premier oubli passerait sans bruit.
 */
const FermerLeMenu = createContext<() => void>(() => {})

export function MenuDeDebordement({
  libelle,
  children,
  className,
  /**
   * Le déclencheur s'efface tant qu'on ne le vise pas.
   *
   * À demander sur une LISTE de cartes, où le même bouton se répète ; jamais
   * sur un en-tête, où il est seul et doit se lire comme une commande.
   */
  discret = false,
  echappe = false,
  sujet,
}: {
  /** Nom accessible du déclencheur — trois points ne se prononcent pas. */
  libelle: string
  children?: ReactNode
  className?: string
  discret?: boolean
  /**
   * CE SUR QUOI LE MENU AGIT, ÉCRIT EN TÊTE DU PANNEAU.
   *
   * À demander quand le panneau RECOUVRE ce qu'il désigne. Mesuré le
   * 2026-09-29 sur `/demo/parc` : le menu d'une fiche de logement en couvre
   * 71 %, et ce qui disparaît dessous est le locataire, la typologie et le
   * loyer — tout ce qui dit QUEL logement on retire, au moment précis où le
   * panneau propose de le retirer.
   *
   * LE SUJET EXISTAIT DÉJÀ, ET POUR PERSONNE. Chaque entrée porte son
   * `nomAccessible` complet — « Retirer le logement B1 » —, donc une synthèse
   * vocale a toujours su. C'est le même défaut que ce fichier a déjà nommé pour
   * la raison d'un refus : « LA RAISON SE LIT, au lieu de n'exister que pour la
   * synthèse vocale ». La règle vaut aussi pour le sujet.
   *
   * PAS SUR LES MENUS QUI NE COUVRENT RIEN. Celui d'un en-tête d'immeuble
   * recouvre 3 % de sa rangée, mesuré : un titre de plus y serait du bruit, et
   * `menu-qui-couvre.mjs` ne l'exige qu'au-delà de la moitié.
   */
  sujet?: string
  /**
   * Le panneau se pose en `position: fixed`, hors de toute boîte qui le
   * rognerait.
   *
   * À demander quand le menu vit DANS un conteneur à défilement — le rail des
   * logements est le premier. Ailleurs, l'ancrage absolu reste le bon : il suit
   * la page sans un écouteur.
   */
  echappe?: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)
  const declencheur = useRef<HTMLButtonElement>(null)
  const panneau = useRef<HTMLDivElement>(null)

  /* Le panneau reste PEINT le temps de sa sortie, puis se démonte. `monte`
     commande la présence dans l'arbre, `ouvert` commande tout le reste — le
     piège de focus et la mesure de renversement plus bas gardent `ouvert`, et
     la raison est écrite à chacun des deux. */
  const { monte, sortant } = useSortieDifferee(ouvert, SORTIE_MS)
  /**
   * LE PANNEAU SE RENVERSE QUAND IL N'A PAS LA PLACE DE TOMBER.
   *
   * ═══ CE QU'IL FAISAIT, MESURÉ ═══
   *
   * Il tombait toujours vers le bas. Sur un téléphone, le dernier menu d'une
   * longue liste s'ouvrait DERRIÈRE la barre de navigation basse, qui est
   * `fixed inset-x-0 bottom-0` : le panneau était rendu, visible dans le DOM, et
   * physiquement intouchable — la barre intercepte le doigt.
   *
   * Relevé le 2026-09-06 sur `/demo/parc` à 360 px, dix-septième déclencheur de
   * la page : « subtree intercepts pointer events », la barre basse au-dessus de
   * l'entrée « Supprimer l'immeuble ». Ce n'est pas un défaut de mesure — un
   * utilisateur n'y arrive pas non plus.
   *
   * ET C'ÉTAIT LE PIRE ENDROIT POSSIBLE. Le parc range les immeubles SANS
   * LOGEMENT en fin de liste : le dernier menu de la page est celui du seul
   * immeuble qu'on ait le droit de supprimer.
   *
   * ═══ LA MESURE, ET POURQUOI ELLE LIT LA BARRE ═══
   *
   * On compare le bas du panneau au bas UTILE de la fenêtre — sa hauteur moins
   * ce que la barre recouvre. Se contenter de `innerHeight` laisserait passer
   * exactement le cas trouvé : un panneau qui « tient dans la fenêtre » et se
   * pose quand même sous la barre.
   *
   * `useLayoutEffect` et non `useEffect` : le panneau ne doit jamais être PEINT
   * du mauvais côté, fût-ce une image. La mesure a lieu après le calcul de mise
   * en page et avant le rendu.
   */
  /**
   * ═══ `echappe` : LE PANNEAU SORT DE LA BOÎTE QUI LE ROGNE ═══
   *
   * Depuis que les logements d'un immeuble défilent dans un rail, leurs fiches
   * vivent DANS une boîte de défilement — et une boîte de défilement rogne les
   * DEUX axes : `overflow-x: auto` force le navigateur à calculer
   * `overflow-y: auto`, donc à couper ce qui dépasse en hauteur. Le menu d'une
   * fiche, qui se renverse vers le haut en bas de fenêtre, se retrouvait coupé
   * net par le bord du rail : mesuré, il n'en restait qu'une bande de trois
   * pixels.
   *
   * `position: fixed` ÉCHAPPE À CE ROGNAGE — un élément fixe n'est pas rogné
   * par les ancêtres à défilement, seulement par un ancêtre transformé, et il
   * n'y en a aucun ici. C'est le même résultat qu'un portail, SANS quitter
   * l'arbre : le piège de focus, la fermeture au clic extérieur et la
   * tabulation continuent de voir le panneau dans le conteneur, et n'ont pas à
   * connaître son existence.
   *
   * LE PRIX EST NOMMÉ : un panneau fixe ne suit plus la page. On ferme donc au
   * moindre défilement — celui du rail comme celui du document. C'est le
   * comportement qu'on attend d'un menu de toute façon : on ne fait pas défiler
   * la page en gardant un menu ouvert.
   */
  const [ancre, setAncre] = useState<{ top: number; right: number } | null>(null)
  const [versLeHaut, setVersLeHaut] = useState(false)
  useLayoutEffect(() => {
    /*
      LA REMISE À ZÉRO SUIT LE DÉMONTAGE, PAS LA FERMETURE.

      Écrite sur `!ouvert`, elle retournait le panneau PENDANT sa sortie : à
      l'image où on le ferme, il sautait de `bottom-full` à `top-full` — donc
      d'au-dessus du déclencheur à en dessous — puis s'effaçait depuis le
      mauvais bord. Sur `!monte`, elle a lieu quand il n'y a plus rien à
      peindre, et l'ouverture suivante repart bien de la position par défaut que
      la mesure ci-dessous corrige aussitôt.
    */
    if (!monte) {
      setVersLeHaut(false)
      return
    }
    if (!ouvert) return
    const p = panneau.current
    if (!p) return
    const barre = document.querySelector('[data-barre-basse]')
    const recouvert = barre ? barre.getBoundingClientRect().height : 0
    setVersLeHaut(p.getBoundingClientRect().bottom > window.innerHeight - recouvert)

    /* L'ANCRE FIXE SE PREND SUR LE DÉCLENCHEUR, pas sur le panneau : c'est lui
       qui est à sa place, le panneau n'étant encore qu'au repos par défaut. */
    if (echappe && declencheur.current) {
      const d = declencheur.current.getBoundingClientRect()
      setAncre({ top: d.bottom, right: window.innerWidth - d.right })
    }
  }, [ouvert, monte, echappe])

  /*
    UN PANNEAU FIXE NE SUIT PAS LA PAGE — IL SE REPLACE, IL NE SE FERME PAS.

    Premier jet : on fermait au moindre défilement. Logique en apparence, et
    refusé par la porte des modales — « le bouton qui l'ouvre est introuvable »,
    deux fois. La raison est que TOUT outil qui vise un élément le fait d'abord
    défiler dans le champ : la sonde ouvrait le menu, le navigateur faisait
    glisser le rail pour atteindre l'entrée, et la fermeture emportait l'entrée
    qu'on venait viser. Un lecteur d'écran fait exactement la même chose, et un
    doigt qui frôle le rail aussi.

    On recalcule donc l'ancre. `capture` : le rail qui porte la fiche défile
    lui-même, et un écouteur posé sur `window` sans capture ne voit jamais le
    défilement d'un descendant — c'est pourtant le seul qui compte ici.
  */
  const replacerLAncre = useCallback(() => {
    const d = declencheur.current
    if (!d) return
    const boite = d.getBoundingClientRect()
    setAncre({ top: boite.bottom, right: window.innerWidth - boite.right })
  }, [])

  useEffect(() => {
    if (!ouvert || !echappe) return
    window.addEventListener('scroll', replacerLAncre, true)
    window.addEventListener('resize', replacerLAncre)
    return () => {
      window.removeEventListener('scroll', replacerLAncre, true)
      window.removeEventListener('resize', replacerLAncre)
    }
  }, [ouvert, echappe, replacerLAncre])

  /*
    ═══ LE TROISIÈME CAS : LE DÉCLENCHEUR BOUGE, ET RIEN NE LE DIT ═══

    Les deux écouteurs ci-dessus couvrent le défilement et le redimensionnement.
    Il manquait le cas où la FICHE se déplace : « Déplacer ‹ › » réordonne le
    rail, le déclencheur glisse d'une largeur de carte, et NI `scroll` NI
    `resize` ne partent — un réordonnancement du DOM n'émet aucun événement.

    Mesuré sur `/demo/parc` le 2026-10-08 : à l'ouverture, bord droit du panneau
    à 856 pour un déclencheur à 876. Après « Déplacer à droite », le déclencheur
    passe à 1176 et le panneau reste à 856 — il flotte trois cents pixels trop à
    gauche, par-dessus la fiche voisine, en portant le titre de celle qu'il a
    quittée. C'est ce que Nelson a rapporté d'une capture.

    ═══ DEUX REMÈDES ESSAYÉS, ET LE PREMIER A ÉCHOUÉ À LA MESURE ═══

    1. RECALER APRÈS UN APPUI DANS LE PANNEAU, à la trame suivante. Écrit, posé,
       MESURÉ : l'écart restait de −320. Une trame ne suffit pas — React valide
       le réordonnancement après, et `requestAnimationFrame` rendait la position
       d'avant. J'avais justifié ce choix par le coût ; la mesure ne l'a pas
       soutenu, et le coût ne se discute que sur ce qui marche.

    2. SUIVRE LE DÉCLENCHEUR TANT QUE LE MENU EST OUVERT. C'est ce que font les
       bibliothèques de placement, et c'est juste par construction : on ne
       devine plus QUELLE cause a déplacé l'ancre, on observe sa position.

    ═══ CE QUE CETTE BOUCLE COÛTE, ET CE QU'ELLE NE COÛTE PAS ═══

    Elle ne tourne QUE menu ouvert — jamais sur un écran au repos, où aucun
    panneau n'existe. Elle ne provoque un rendu que si l'ancre a BOUGÉ : la
    comparaison est faite avant `setAncre`, sans quoi un objet neuf à chaque
    trame rendrait le composant soixante fois par seconde pour rien.
  */
  useEffect(() => {
    if (!ouvert || !echappe) return
    let trame = 0
    const suivre = () => {
      const d = declencheur.current
      if (d) {
        const boite = d.getBoundingClientRect()
        const top = boite.bottom
        const right = window.innerWidth - boite.right
        /* LA COMPARAISON EST LA CONDITION DE VIABILITÉ de cette boucle, pas une
           optimisation : `setAncre` avec un objet neuf change l'identité à
           chaque fois, donc rendrait sans fin. */
        setAncre((precedent) =>
          precedent && precedent.top === top && precedent.right === right
            ? precedent
            : { top, right },
        )
      }
      trame = requestAnimationFrame(suivre)
    }
    trame = requestAnimationFrame(suivre)
    return () => cancelAnimationFrame(trame)
  }, [ouvert, echappe])

  /* `focusInitial: 'premier'` : le panneau ne contient QUE des commandes, la
     première est donc la bonne première étape. C'est le même réglage que le
     menu de compte, pour la même raison. */
  usePiegeDeFocus(ouvert, boite, () => setOuvert(false), {
    fermerAuClicExterieur: true,
    focusInitial: 'premier',
  })

  /*
    RIEN À REPLIER, RIEN À PROMETTRE — ET `!children` NE SUFFISAIT PAS.

    Un appelant qui compose ses entrées par conditions passe un TABLEAU, et un
    tableau de trois `null` est truthy. Les cartes d'intervention font
    exactement cela : trois gestes optionnels selon l'état, dont aucun sur une
    intervention devisée que le bailleur s'est ouverte à lui-même. Le menu se
    serait affiché, vide, sur cette carte-là — le défaut même que ce composant
    dit refuser deux paragraphes plus haut.

    `Children.toArray` écarte `null`, `undefined` et les booléens : ce qui reste
    est ce qui sera peint.
  */
  if (Children.toArray(children).length === 0) return null

  return (
    <div ref={boite} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        ref={declencheur}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label={libelle}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          // 44 px, comme toute cible du dépôt. `rounded-full` et la bordure de
          // la variante secondaire : c'est un bouton d'en-tête, il se lit comme
          // ses voisins plutôt que comme un ornement.
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-full',
          'transition-colors duration-150',
          /*
            ═══ `discret` : LE CERCLE NE PARAÎT QUE QUAND IL EST UNE CIBLE ═══

            Le déclencheur cerclé est juste en tête de carte, où il est seul.
            Répété par FICHE — douze logements, douze cercles alignés —, il
            devient une colonne de taches que l'œil compte avant d'avoir lu un
            numéro : la commande la moins importante de la fiche y pèse autant
            que son numéro.

            Discret, il garde ses 44 px et son glyphe en encre sourde ; la
            bordure et le fond reviennent au survol, au focus ET tant que le
            menu est ouvert — sans quoi le déclencheur s'efface au moment précis
            où il commande quelque chose.
          */
          discret
            ? cn(
                'border border-transparent text-muted',
                'hover:border-border hover:bg-surface-sunken hover:text-ink',
                'focus-visible:border-border focus-visible:text-ink',
                ouvert && 'border-border bg-surface-sunken text-ink',
              )
            : 'border border-border bg-surface text-ink hover:border-ink',
        )}
      >
        <Icon name="more" size={18} />
      </button>

      {monte && (
        <div
          /*
            ═══ `role="menu"` EST DESCENDU D'UN CRAN, ET ARIA L'EXIGE ═══

            Il vivait ici, sur la SURFACE — la boîte qui porte le placement,
            l'animation et la peinture. Tant que cette boîte ne contenait que
            des entrées, les deux rôles se confondaient sans dommage.

            Le titre de sujet a séparé les deux. ARIA ne donne au rôle `menu`
            que trois enfants : une entrée, un séparateur, un groupe. Un titre
            décoratif n'est aucun des trois, et `menusLicites` l'a refusé — à
            juste titre, sur les huit écrans à menu du produit.

            La surface n'a donc plus de rôle, et le menu est la LISTE qu'elle
            contient. Le titre est son frère, pas son enfant : c'est aussi ce
            qu'ARIA recommande d'un élément qui nomme un menu.
          */
          /* `--z-popover` : le menu s'ouvre au-dessus d'un en-tête qui est
             lui-même collant. Le barreau est celui des panneaux ancrés du
             dépôt, et `altitudes.test.ts` refuse tout niveau écrit à la main. */
          ref={panneau}
          /*
            L'ORIGINE SUIT LE RENVERSEMENT, ce qui est toute la raison d'écrire
            une origine ici. `surface-pop` n'en pose aucune : le panneau grandissait
            depuis son propre CENTRE, donc depuis nulle part. Ancré à droite, il
            part du coin haut-droit quand il tombe et du coin bas-droit quand il
            se renverse — dans les deux cas du déclencheur, qui est juste là.
          */
          style={{
            zIndex: 'var(--z-popover)',
            transformOrigin: versLeHaut ? 'bottom right' : 'top right',
            /* FIXE ET ANCRÉ AU DÉCLENCHEUR quand il faut échapper au rognage.
               Une remontée de sa propre hauteur place le panneau au-dessus de
               son ancre dans le cas renversé : on n'a qu'une coordonnée haute,
               et un `bottom` calculé demanderait la hauteur du panneau avant de
               l'avoir peint.

               ═══ CE DÉCALAGE PASSE PAR UNE VARIABLE, ET IL LE FAUT ═══

               Il était écrit `transform: 'translateY(-100%)'`, en ligne. Le
               panneau portait en même temps une ANIMATION d'entrée qui remplit
               `transform` — et une animation bat une déclaration en ligne, y
               compris après sa fin, tant qu'elle remplit. MESURÉ sur
               `/demo/parc` en 1280 × 600 : `transform` en ligne valait bien
               `translateY(-100%)`, `transform` calculée rendait
               `matrix(1, 0, 0, 1, 0, 0)`. Le renversement était donc MORT — le
               menu recouvrait le bouton qui l'ouvre et débordait de 69 px sous
               le bord de la fenêtre, c'est-à-dire exactement ce que le
               renversement existe pour éviter.

               `--surface-dy` entre dans la MÊME déclaration que le geste
               (`tokens.css`, `surface-pop`), qui compose le placement et
               l'échelle au lieu de les mettre en concurrence.
               `scripts/surfaces-animees.mjs` garde les deux faits d'écran. */
            ...(echappe && ancre
              ? {
                  position: 'fixed' as const,
                  top: versLeHaut ? ancre.top - TAILLE_DU_DECLENCHEUR : ancre.top,
                  right: ancre.right,
                  ...(versLeHaut ? { '--surface-dy': '-100%' } : {}),
                }
              : {}),
          }}
          // Pendant la sortie, le menu n'existe plus que pour l'œil : il quitte
          // l'arbre d'accessibilité et cesse de prendre le pointeur. Sans cela
          // il resterait 150 ms lisible, tabulable et CLIQUABLE — un menu qui
          // s'en va retiendrait le focus et avalerait le clic suivant.
          aria-hidden={sortant || undefined}
          {...(sortant ? INERTE : {})}
          /* La SURFACE du menu, nommée pour la mesure : depuis que `role="menu"`
             est descendu sur la liste, plus aucun attribut ne désignait la boîte
             PEINTE — celle dont `menu-qui-couvre.mjs` calcule le recouvrement.
             Un attribut de données et non une classe : `scripts/` est balayé par
             le générateur d'utilitaires Tailwind. */
          data-surface-de-menu=""
          className={cn(
            sortant ? 'surface-pop-sortie pointer-events-none' : 'surface-pop',
            /*
              IL ÉPOUSE SON CONTENU. `w-64` posait 256 px quoi qu'il porte :
              deux mots de sept lettres flottaient dans une dalle plus large
              que la fiche qui l'ouvre. `w-max` borné prend la place des
              libellés — et la borne haute reste, parce qu'une raison de refus
              s'écrit en une phrase et ne doit pas tirer le panneau hors de
              l'écran.
            */
            echappe && ancre ? 'flex w-max min-w-52 flex-col gap-0.5' : 'absolute right-0 flex w-max min-w-52 flex-col gap-0.5',
            'max-w-[min(18rem,calc(100vw-2.5rem))]',
            /* `p-1` et non `p-2` : le rembourrage du panneau s'ajoutait à celui
               des entrées, qui font déjà 44 px de haut. Deux gestes courts y
               occupaient 120 px pour deux lignes de texte. */
            'rounded-lg border border-border bg-paper p-1 shadow-lg',
            /* Le renversement ne change QUE l'ancrage vertical : la marge suit
               le sens, sans quoi le panneau collerait au déclencheur d'un côté
               et flotterait de l'autre. */
            echappe && ancre ? '' : versLeHaut ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {/*
            LE SUJET, EN TÊTE ET HORS DE L'ARBRE D'ACCESSIBILITÉ.

            `aria-hidden` : la LISTE juste en dessous porte `aria-label={libelle}`
            — « Actions pour le logement B1 » —, et chaque entrée répète le sujet
            dans son `nomAccessible`. Le lire une troisième fois ferait entendre
            « B1 » trois fois avant le premier geste. Ce titre n'existe QUE pour
            l'œil, parce que l'œil est le seul à qui il manquait.

            Il n'est pas un `<h_>` : rien ne le suit dans un plan de document,
            et un titre de niveau flottant dans un panneau fausserait la
            hiérarchie que `hierarchieDesTitres` garde.
          */}
          {sujet && (
            <p
              aria-hidden="true"
              className="numeric truncate px-3 pt-1 pb-1.5 text-label font-semibold text-muted"
            >
              {sujet}
            </p>
          )}
          <div role="menu" aria-label={libelle} className="flex flex-col gap-0.5">
            <FermerLeMenu.Provider value={() => setOuvert(false)}>{children}</FermerLeMenu.Provider>
          </div>
        </div>
      )}
    </div>
  )
}

/** La hauteur du déclencheur — l'ancre haute d'un panneau renversé s'en déduit. */
const TAILLE_DU_DECLENCHEUR = 44

/** Une entrée de menu. Elle referme le panneau en même temps qu'elle agit. */
/**
 * UN TRAIT ENTRE DEUX NATURES DE GESTE.
 *
 * Le menu d'une fiche portait quatre entrées de trois natures — modifier,
 * ranger, détruire — au même poids visuel. La seule irréversible n'était
 * séparée de rien.
 *
 * `role="separator"` EST LÉGITIME DANS UN `menu` : l'en-tête de ce fichier dit
 * qu'un menu « n'admet que des `menuitem` parmi ses descendants SIGNIFIANTS »,
 * et ARIA admet précisément le séparateur à côté d'eux. Il ne compte pas dans
 * le « 2 sur 3 » annoncé, ce qui est exactement ce qu'on veut : il sépare, il
 * ne se choisit pas.
 *
 * `my-1` et non une marge plus large : ce qu'on veut est une COUPURE, pas une
 * respiration. Un trait qui flotte se lit comme un vide et le menu paraît
 * inachevé.
 */
export function MenuSeparateur() {
  return <div role="separator" className="my-1 h-px bg-divider" />
}

/**
 * UN AXE, DEUX SENS, UNE SEULE RANGÉE.
 *
 * ═══ CE QUE DEUX RANGÉES COÛTAIENT ═══
 *
 * « Déplacer à gauche » et « Déplacer à droite » occupaient deux entrées de
 * menu. C'est un contrôle, pas deux décisions : l'axe s'y lisait comme deux
 * choix étrangers l'un à l'autre, et le menu doublait de hauteur pour le dire.
 * Le chevron y était en outre redondant — « à gauche » nomme déjà la direction
 * que le glyphe répétait.
 *
 * ═══ DEUX `menuitem` DANS UNE RANGÉE, ET LA RÈGLE TIENT ═══
 *
 * La `div` qui les aligne ne porte aucun rôle : elle n'est pas un descendant
 * SIGNIFIANT, et les deux seuls descendants signifiants restent des `menuitem`.
 * Le décompte annoncé par la synthèse vocale reste juste, et les deux cibles
 * restent deux alternatives à un seul pointeur — ce qu'exige WCAG 2.5.7 de tout
 * geste obtenu par glissement.
 *
 * `size-11` — 44 px — sur chaque flèche : ce sont des cibles au doigt comme les
 * autres, et le dépôt en a une garde.
 *
 * FERMÉE PLUTÔT QUE RETIRÉE aux extrémités, pour la raison que `MenuElement`
 * écrit déjà à propos de ses entrées closes : un geste qui disparaît fait
 * chercher ce qu'on a mal fait. Et `aria-disabled` plutôt que `disabled`, même
 * motif — l'état s'annonce et la cible reste atteignable au clavier.
 */
export function MenuAxe({
  libelle,
  gauche,
  droite,
}: {
  libelle: string
  gauche: { nomAccessible: string; onClick?: () => void }
  droite: { nomAccessible: string; onClick?: () => void }
}) {
  /* `FermerLeMenu` N'EST PLUS CONSOMMÉ ICI — voir le `onClick` plus bas : un axe
     est un réglage répété, il ne referme pas le panneau qui le porte. */
  const sens = (nom: 'chevronLeft' | 'chevronRight', c: { nomAccessible: string; onClick?: () => void }) => {
    const ferme = c.onClick === undefined
    return (
      <button
        type="button"
        role="menuitem"
        aria-label={c.nomAccessible}
        aria-disabled={ferme || undefined}
        /*
          ═══ L'AXE NE REFERME PAS LE PANNEAU, ET C'EST LA DIFFÉRENCE AVEC UNE
              ENTRÉE ═══

          Il appelait `fermer()` avant d'agir, comme `MenuElement`. La raison
          d'être de `MenuElement` ne s'applique pas ici : ses entrées sont des
          DÉCISIONS — corriger, retirer — dont une seule se prend à la fois, et le
          panneau qui se ferme est la confirmation qu'elle est partie. Un axe est
          un RÉGLAGE RÉPÉTÉ.

          CE QUE ÇA COÛTAIT : déplacer une fiche de quatre rangs demandait quatre
          cycles ouvrir-naviguer-activer, le panneau clignotant à chaque pas, et
          — avant la région vivante du rail — sans le moindre retour entre deux.
          Le contrôle se fermait lui-même après chaque usage.

          RIEN NE MANQUE POUR EN SORTIR : le panneau se ferme par Échap, par clic
          extérieur et au défilement, et `usePiegeDeFocus` tient les trois.

          ET LES DEUX FLÈCHES SE TIENNENT À JOUR PENDANT QU'IL EST OUVERT :
          `peutAller` lit l'ordre AFFICHÉ, recalculé à chaque rendu, donc la
          flèche se ferme bien quand la fiche atteint le bout — sans quoi on
          pousserait dans le vide sur un panneau qui ne se referme plus.
        */
        onClick={ferme ? undefined : () => c.onClick?.()}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-md',
          'transition-colors duration-150',
          ferme
            ? 'cursor-not-allowed text-muted opacity-45'
            : 'cursor-pointer text-ink hover:bg-surface-sunken',
        )}
      >
        <Icon name={nom} size={16} className="opacity-70" />
      </button>
    )
  }
  return (
    /* `pr-1` et non `pr-3` : les deux cibles portent leur propre rembourrage de
       44 px, et l'ajouter au leur décollerait la seconde du bord du panneau. */
    /* `role="group"` AVEC SON NOM : ARIA admet un groupe parmi les enfants d'un
       `menu`, et c'est ce que cette rangée est — un ensemble nommé de deux
       entrées liées. Le nom n'est pas décoratif : sans lui, un lecteur d'écran
       annoncerait deux flèches sans dire de quoi elles sont les deux sens, et
       `menusLicites` refuse d'ailleurs un groupe anonyme. */
    <div role="group" aria-label={libelle} className="flex min-h-11 w-full items-center gap-2.5 rounded-md pl-3 pr-1">
      {/*
        UNE CALE, PAS UNE ICÔNE, ET C'EST UN CHOIX.

        Relevé sur la capture : sans elle, « Déplacer » commençait dans la
        COLONNE DES ICÔNES quand « Corriger » et « Retirer » commençaient 26 px
        plus loin — trois libellés à trois abscisses dans un menu de quatre
        lignes. Les mêmes `gap-2.5` et la même largeur de 16 px que l'icône de
        `MenuElement` remettent la colonne d'aplomb.

        AUCUNE ICÔNE DU JEU NE VEUT DIRE « DÉPLACER » — ni `layers`, ni
        `arrowRight`, ni `sliders`, qui sert déjà « Corriger ». En emprunter une
        dirait quelque chose de faux à la place de ne rien dire, et le dépôt
        refuse ailleurs exactement cet emprunt : « un jeton que le code
        contourne n'est pas un jeton ». Les deux flèches, à droite, portent déjà
        le sens du geste.
      */}
      <span aria-hidden="true" className="w-4 shrink-0" />
      <span className="flex-1 text-body text-ink">{libelle}</span>
      <span className="flex shrink-0 gap-1">
        {sens('chevronLeft', gauche)}
        {sens('chevronRight', droite)}
      </span>
    </div>
  )
}

export function MenuElement({
  icone,
  onClick,
  nomAccessible,
  raison,
  ton,
  children,
}: {
  icone?: Parameters<typeof Icon>[0]['name']
  /**
   * ABSENT, L'ENTRÉE EST FERMÉE — et elle reste LÀ.
   *
   * Une entrée retirée du menu ne s'explique pas : on cherche la commande
   * manquante, puis ce qu'on a mal fait. Présente et fermée, son nom accessible
   * porte le motif. C'est la règle que le Parc applique déjà à ses deux
   * suppressions, transposée dans le menu.
   *
   * `aria-disabled` et non `disabled` : un élément désactivé sort de l'ordre de
   * tabulation, donc sa raison devient inatteignable au clavier — pour qui en a
   * le plus besoin. Il reste atteignable, annonce son état, et n'agit pas.
   */
  onClick?: () => void
  /**
   * Le nom que la synthèse vocale annonce, quand le libellé VISIBLE ne suffit
   * pas à désigner la cible.
   *
   * « Corriger » se répète par ligne : douze entrées identiques ne disent pas
   * laquelle on active. Le libellé visible reste court — il vit dans un menu
   * déjà ouvert sur SA ligne — et le nom accessible porte le numéro.
   */
  nomAccessible?: string
  /**
   * POURQUOI le geste est fermé — rendu SOUS le libellé, et non seulement dans
   * le nom accessible.
   *
   * Un geste éteint sans motif est un cul-de-sac : on clique, rien ne se
   * passe, et on recommence. La raison existait déjà dans ce produit — « le
   * logement a une histoire dans le parc » — mais elle ne vivait que dans
   * `aria-label`, c'est-à-dire pour la synthèse vocale et pour personne
   * d'autre. Le voyant, lui, n'avait qu'une ligne grise.
   */
  raison?: string
  /**
   * `danger` peint le geste qui DÉTRUIT — au survol et au focus seulement.
   *
   * Pas au repos : un menu dont une entrée est rouge en permanence fait lire le
   * rouge avant le mot, et la liste entière se met à crier. C'est au moment où
   * le doigt s'y pose que la couleur a quelque chose à dire.
   */
  ton?: 'danger'
  children: ReactNode
}) {
  const fermer = useContext(FermerLeMenu)
  const ferme = onClick === undefined
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={nomAccessible}
      aria-disabled={ferme || undefined}
      onClick={
        ferme
          ? undefined
          : () => {
              fermer()
              onClick()
            }
      }
      className={cn(
        'flex min-h-11 w-full gap-2.5 rounded-md px-3 py-1.5',
        /* LE GLYPHE SE CALE EN HAUT quand une raison suit le libellé : centré
           sur deux lignes, il se retrouve en face du motif plutôt qu'en face du
           geste qu'il désigne. */
        ferme && raison ? 'items-start pt-2.5' : 'items-center',
        'text-left text-body transition-colors duration-150',
        ferme
          ? /*
              UN GESTE FERMÉ QUI S'EXPLIQUE DOIT SE LIRE.

              `opacity-45` est l'éteint que `Button` applique à ses commandes
              fermées, et il convient tant qu'il n'y a rien à lire dessous. Une
              RAISON à 45 % serait une phrase qu'on tend sans la rendre
              lisible ; le motif du refus est justement ce qui distingue « pas
              maintenant » de « cassé ».

              Sans raison, l'éteint d'avant ne bouge pas.
            */
            cn('cursor-not-allowed', raison ? 'text-muted' : 'text-muted opacity-45')
          : cn(
              'cursor-pointer text-ink',
              ton === 'danger'
                ? 'hover:bg-danger-tint hover:text-danger focus-visible:bg-danger-tint'
                : 'hover:bg-surface-sunken',
            ),
      )}
    >
      {icone && (
        <Icon
          name={icone}
          size={16}
          className={cn('shrink-0', ferme ? 'text-muted' : 'text-inherit opacity-70')}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{children}</span>
        {/* LA RAISON SOUS LE LIBELLÉ, en `text-caption` : elle qualifie le
            geste, elle ne le remplace pas — et la fiche reste lisible d'un
            coup d'œil, le motif ne se lisant que si l'on s'y arrête. */}
        {ferme && raison && <span className="text-caption text-pretty">{raison}</span>}
      </span>
    </button>
  )
}
