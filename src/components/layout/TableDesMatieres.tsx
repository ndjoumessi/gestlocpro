import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * LA TABLE DES MATIÈRES QUI SUIT LA LECTURE — un rail collant, et le repère
 * glisse sur la section qu'on est en train de lire.
 *
 * ═══ D'OÙ ELLE VIENT ═══
 *
 * Adaptée de « Table of Contents » de @mohammadshehadeh, 21st.dev
 * (https://21st.dev/@mohammadshehadeh/components/toc). Aucune dépendance npm
 * n'est entrée avec elle : le composant d'origine n'en avait pas.
 *
 * ═══ CE QU'ELLE AJOUTE À `SommaireDesRubriques`, ET POURQUOI LES DEUX VIVENT ═══
 *
 * Un sommaire en tête répond à « où aller » et se tait dès qu'on l'a dépassé.
 * Sur une page de 5 500 px, la question qui reste est « où suis-je » — et c'est
 * la seule à laquelle une liste immobile ne peut pas répondre. Le rail est
 * COLLANT : il est encore là au treizième écran de défilement, et il dit lequel.
 *
 * Il ne remplace donc pas l'autre, il occupe la largeur où l'autre ne tient pas
 * bien, et réciproquement :
 *
 *   · AU-DELÀ DE 64 rem, le rail. Il ne coûte AUCUNE hauteur de page — il vit
 *     dans une colonne latérale que le texte n'occupait pas —, alors qu'un
 *     sommaire en tête en coûte 423 px, mesurés.
 *   · EN DEÇÀ, le sommaire en grille. Il n'y a pas de colonne latérale à
 *     prendre, et un rail s'empilerait DANS le flux : treize entrées à 46 px
 *     coûteraient plus de six cents pixels de page, là où la grille à deux
 *     colonnes en coûte 485 — c'est le calcul qu'elle fait déjà sur les deux
 *     pages juridiques, et il ne change pas ici.
 *
 * CE PARAGRAPHE A DISAIT LE CONTRAIRE, ET IL ÉTAIT FAUX. Il justifiait la
 * grille par les cibles tactiles, « qui ne valent qu'en deçà ». La sonde des
 * cibles mesure les 44 px à TOUTES les largeurs, et elle a refusé ce rail à
 * 1024 px en anglais : `cible 45x38`. La règle du dépôt ne connaît pas de
 * largeur où un lien aurait le droit d'être petit.
 *
 * Et l'espion ne servirait à rien au téléphone de toute façon : une table posée
 * en tête du flux disparaît au premier défilement, donc elle ne peut suivre
 * personne.
 *
 * ═══ CE QUI A ÉTÉ RETIRÉ À L'ORIGINAL, ET POURQUOI ═══
 *
 * 1. LE DÉFILEMENT PILOTÉ À LA MAIN. L'original interceptait le clic,
 *    appelait `scrollIntoView({ behavior: prefersReducedMotion() ? … })` puis
 *    réécrivait l'adresse. Ce dépôt a DÉJÀ diagnostiqué ce motif, dans
 *    `RailDeLogements` : `tokens.css` pose `scroll-behavior: auto !important`
 *    sous `prefers-reduced-motion`, et CSSOM-View ne consulte cette règle que
 *    si l'appel ne demande rien — un `behavior` explicite est exactement le
 *    seul chemin qui lui échappe. Un `<a href="#id">` nu fait mieux et sans
 *    code : il obéit au CSS, il respecte `scroll-margin-top`, et il met
 *    l'ancre dans la barre d'adresse, donc le lien s'envoie.
 *
 * 2. L'API COMPOSABLE — contexte, `Label`, `List`, `Item`, `Link` exportés
 *    séparément, et l'imbrication à plusieurs niveaux. Cette page a une liste
 *    PLATE et un seul appelant. Cent lignes pour des formes dont aucune n'est
 *    demandée, c'est la généralité spéculative que les règles de ce dépôt
 *    refusent.
 *
 * ═══ CE QUI A ÉTÉ GARDÉ ═══
 *
 * L'espion lui-même, son étranglement à 200 ms, `aria-current` sur l'entrée
 * active, et le repli vers la DERNIÈRE section passée quand aucune n'est à
 * l'écran — sans quoi le rail se vide au milieu d'un long paragraphe.
 */

/**
 * LA HAUTEUR SOUS LAQUELLE UNE SECTION EST RÉPUTÉE PASSÉE.
 *
 * MESURÉE, pas reprise : l'original portait 56, qui était la barre collante de
 * SA démonstration. Ici c'est celle de la coquille applicative (48 px) plus les
 * 24 px de `scroll-mt-6` que porte chaque titre de section — c'est-à-dire la
 * ligne exacte où le navigateur dépose un titre quand on clique son ancre. Un
 * seuil plus bas rendrait « active » une section que l'en-tête recouvre.
 */
export const HAUTEUR_SOUS_L_EN_TETE_PX = 80

/**
 * LA MARGE D'ANCRE DES SECTIONS, ET ELLE DOIT VALOIR LA LIGNE DE FLOTTAISON.
 *
 * ═══ LE DÉFAUT MESURÉ, ET IL DATAIT DU PREMIER SOMMAIRE ═══
 *
 * Les titres portaient `scroll-mt-6` — 24 px —, repris des pages juridiques. La
 * coquille applicative, elle, porte un en-tête COLLANT de 65 px : un titre
 * déposé à 24 px du haut est ENTIÈREMENT derrière lui. Vérifié le 2026-10-08 en
 * cliquant « Cautions » puis en demandant `elementFromPoint` juste au-dessus du
 * titre — la réponse était le `HEADER`, à 1800 px comme à 375.
 *
 * Le piège est qu'une vérification naïve passe : le titre EST à la position
 * demandée, l'ancre résout, la page défile. Rien ne dit qu'on a déposé le
 * lecteur sous une barre opaque.
 *
 * 80 = 65 mesurés (en-tête, identique à 320, 375 et 1800 px) + 15 d'air.
 *
 * ═══ POURQUOI UNE CHAÎNE LITTÉRALE ET NON UN CALCUL ═══
 *
 * Tailwind lit les sources au caractère près : une classe assemblée par
 * morceaux n'entre jamais dans le CSS livré, et ce dépôt a déjà payé ce piège
 * (voir [[noms-de-classe-assembles-echappent-au-grep]]). Le nombre et la classe
 * vivent donc côte à côte, et un cas garde leur accord — sans lui, corriger
 * l'un sans l'autre ferait sauter le repère d'une section à chaque clic.
 */
export const CLASSE_DE_MARGE_D_ANCRE = 'scroll-mt-20'

/** L'intervalle de l'étranglement : au-delà, le repère traîne derrière l'œil. */
const ETRANGLEMENT_MS = 200

/** Un titre de section et sa distance au haut de la fenêtre, à l'instant lu. */
export type TitreMesure = { readonly id: string; readonly haut: number }

/**
 * QUELLE SECTION EST LUE, à partir des positions seules.
 *
 * Extraite du composant pour être éprouvable : jsdom ne fait pas de mise en
 * page et rend des rectangles nuls, donc la seule façon de garder cette règle
 * est de lui passer des positions plutôt que de la faire lire le document.
 */
export function sectionLue(titres: readonly TitreMesure[], plafond: number): string | null {
  /*
    LA DERNIÈRE PASSÉE, ET RIEN D'AUTRE.

    L'original de 21st.dev prenait le PREMIER titre encore sous la ligne — donc
    le PROCHAIN, celui qu'on n'a pas lu — et ne se rabattait sur la dernière
    passée que lorsque plus aucun titre n'était à l'écran. Mesuré sur cette page :
    le lecteur lisait « Corriger le parc » et le rail annonçait « Accès au parc »,
    dont le titre était 332 px plus bas. Voir `sectionLue.test.ts`, qui porte le
    relevé.

    En lisant À REBOURS, le premier trouvé est la dernière section commencée :
    une condition, pas deux, et plus de cas de repli — l'ancien repli ÉTAIT la
    bonne réponse, reléguée derrière la mauvaise.
  */
  for (let i = titres.length - 1; i >= 0; i -= 1) {
    const titre = titres[i]!
    if (titre.haut <= plafond) return titre.id
  }
  return null
}

export type EntreeDeTable = {
  /** L'`id` du titre visé — le même que celui de l'ancre. */
  readonly id: string
  /** Ce qui est écrit dans le rail. */
  readonly libelle: string
}

/**
 * QUELLE SECTION EST LUE — et la réponse est une position, pas un événement.
 *
 * `IntersectionObserver` aurait été le réflexe. Il répond « cette section est
 * entrée / sortie », alors que la question posée est « laquelle occupe le haut
 * de la fenêtre MAINTENANT » : avec treize sections dont plusieurs tiennent
 * ensemble à l'écran, il faut de toute façon les classer par position, ce que
 * l'observateur ne donne pas. Une lecture des rectangles au défilement la donne
 * directement, et jsdom la supporte.
 */
function useSectionLue(entrees: readonly EntreeDeTable[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  /* Les identifiants seuls, et joints : un tableau littéral change d'identité à
     chaque rendu du parent, et l'effet se réabonnerait à chaque frappe. */
  const identites = entrees.map((e) => e.id).join('\u0000')

  useEffect(() => {
    const ids = identites ? identites.split('\u0000') : []

    const relire = () => {
      /* AUCUN CAS PARTICULIER EN HAUT DE PAGE. L'original en portait un —
         `scrollY === 0` rendait `null` — parce que sa règle, elle, aurait
         désigné la première section dès le premier pixel. La nôtre ne désigne
         que ce qui est PASSÉ : en haut de page rien ne l'est, et la réponse
         est nulle sans qu'on ait à l'écrire. Un cas en moins, et il ne
         dépendait plus du défilement de la fenêtre. */
      /* LE DOM N'EST LU QUE POUR SES POSITIONS ; la décision est prise par
         `sectionLue`, qui ne connaît que des nombres et se garde donc en
         jsdom, où aucun rectangle n'existe. */
      const titres = ids
        .map((id) => {
          const el = document.getElementById(id)
          return el ? { id, haut: el.getBoundingClientRect().top } : null
        })
        .filter((t): t is TitreMesure => t !== null)

      setActive(sectionLue(titres, HAUTEUR_SOUS_L_EN_TETE_PX))
    }

    /*
      L'ÉTRANGLEMENT EST ÉCRIT ICI PLUTÔT QU'IMPORTÉ : c'est une horloge et un
      drapeau, et le dépôt n'en porte pas d'autre. Il laisse passer le PREMIER
      appel tout de suite et retient les suivants — l'inverse d'un délai, qui
      ferait traîner le repère d'un cinquième de seconde à chaque reprise.
    */
    let dernier = 0
    let minuteur: ReturnType<typeof setTimeout> | null = null
    const auDefilement = () => {
      const reste = ETRANGLEMENT_MS - (Date.now() - dernier)
      if (reste <= 0) {
        dernier = Date.now()
        relire()
      } else if (!minuteur) {
        minuteur = setTimeout(() => {
          dernier = Date.now()
          minuteur = null
          relire()
        }, reste)
      }
    }

    relire()
    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement, { passive: true })

    return () => {
      if (minuteur) clearTimeout(minuteur)
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
    }
  }, [identites])

  return active
}

export function TableDesMatieres({
  libelle,
  entrees,
  className,
}: {
  /** Le nom accessible de la navigation — « Sur cette page », dans la langue courante. */
  libelle: string
  /** Les sections, dans l'ordre du document. */
  entrees: readonly EntreeDeTable[]
  className?: string
}) {
  const active = useSectionLue(entrees)

  return (
    <nav aria-label={libelle} className={cn('flex flex-col gap-3', className)}>
      <p className="text-caption font-semibold uppercase tracking-wide text-muted">{libelle}</p>
      {/* `<ol>` ET NON `<ul>` : l'ordre est celui du document, et un lecteur
          d'écran qui annonce « 7 sur 13 » situe la section dans la page — le
          même choix, pour la même raison, que `SommaireDesRubriques`. */}
      <ol className="flex flex-col border-s border-divider">
        {entrees.map(({ id, libelle: texte }) => {
          const lue = active === id
          return (
            <li key={id}>
              {/*
                `aria-current` ET LA COULEUR, jamais la couleur seule : la porte
                `couleur-non-seule` refuse un état qui ne se lit qu'à la teinte.
                Ici l'état est porté par l'attribut, que l'AT annonce, et par le
                poids du trait — deux canaux en plus du bleu.

                `-ms-px` : le trait de l'entrée recouvre celui du rail au lieu de
                s'ajouter à côté, sans quoi le repère ferait deux pixels de large
                sur une ligne et un sur les autres.
              */}
              <a
                href={`#${id}`}
                aria-current={lue ? 'true' : undefined}
                className={cn(
                  /*
                    DEUX FAÇONS DE TENIR LES 44 px, ET IL EN FAUT DEUX.

                    `py-2.5` les tient EN RENDU : 25,6 px de hauteur de ligne
                    plus 20 de rembourrage font 45,6. `py-1.5` en rendait 38,
                    et `mesure-ui` l'a refusé à 1024 px en anglais.

                    `min-h-11` les DÉCLARE, et c'est une autre porte : la règle
                    de sources lit les classes, pas le rendu. Un rembourrage qui
                    se trouve suffire ne lui dit rien — elle réclame une hauteur
                    écrite, parce que « qui prend la peine de la fixer prend la
                    responsabilité du chiffre ». C'est l'idiome que
                    `SommaireDesRubriques` emploie déjà pour ses entrées.

                    Les deux ne font pas doublon : la première répond de ce que
                    le doigt touche, la seconde de ce que la relecture peut
                    vérifier sans ouvrir un navigateur.
                  */
                  '-ms-px flex min-h-11 items-center border-s py-2.5 ps-4 text-caption',
                  'transition-colors duration-150',
                  lue
                    ? 'border-accent font-semibold text-accent-ink'
                    : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {texte}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
