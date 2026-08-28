import { createContext, useContext, type ReactNode } from 'react'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * DÉTACHÉ D'`AppShell.tsx`, et c'est le point du fichier.
 *
 * `NotFound.tsx` — l'écran 404 PUBLIC, monté hors de toute session — en avait
 * besoin pour son propre en-tête, et l'importait depuis `AppShell.tsx`. Rien
 * d'autre dans ce fichier ne lui sert : ni la barre latérale, ni son état de
 * rôle, ni ses 1600 lignes. Mais un import statique engage le MODULE entier,
 * pas la seule fonction citée — le découpage du lot qui a suivi (voir
 * `src/app/EspaceApplicatif.tsx`) aurait donc rechargé toute la coquille
 * applicative sur la page d'accueil et sur un lien mort, exactement l'inverse
 * de ce que ce lot cherche à obtenir.
 *
 * `PageHeader` vit donc seul, avec le `CadreContext` dont il dépend. Tout le
 * reste d'`AppShell.tsx` continue de vivre dans le paquet applicatif, et
 * l'importe d'ici comme n'importe quel autre appelant.
 */

/**
 * Vrai quand un écran applicatif est monté DANS un cadre — la prévisualisation
 * du portail, aujourd'hui.
 *
 * Un contexte plutôt qu'une prop : les trois écrans montés ne connaissent pas
 * le cadre et n'ont aucune raison de le connaître. Leur passer un drapeau
 * ferait remonter la prévisualisation jusque dans leur signature.
 */
export const CadreContext = createContext(false)

/** En-tête de page, commun à tous les écrans applicatifs. */
export function PageHeader({
  title,
  description,
  actions,
  debordement,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /**
   * Les commandes REPLIÉES derrière trois points.
   *
   * Ce qu'on fait tous les jours reste sous les yeux ; ce qu'on fait parfois se
   * demande. Aucune action n'est retirée par ce repli — c'est la hiérarchie qui
   * change, pas l'inventaire.
   */
  debordement?: ReactNode
}) {
  /**
   * Monté DANS un cadre, un écran cesse d'être deux choses.
   *
   * Il n'est plus le titre de la PAGE : un second `<h1>` en ferait deux
   * documents, alors que la prévisualisation est une fenêtre dans une page qui
   * a déjà le sien. Et il ne nomme plus l'onglet du navigateur : l'historique
   * porterait « Résidence Bonamoussadi — A1 » pour une page qui est la
   * prévisualisation du portail — exactement le défaut que `useDocumentTitle`
   * avait été écrit pour corriger.
   */
  const dansUnCadre = useContext(CadreContext)

  // Chaque écran applicatif nomme son onglet. Les douze portaient le titre
  // statique de la landing : deux onglets ouverts côte à côte, un signet ou une
  // entrée d'historique ne permettaient pas de les distinguer.
  useDocumentTitle(dansUnCadre ? undefined : title)

  const Titre = dansUnCadre ? 'h2' : 'h1'

  return (
    <div
      /* `data-en-tete-de-page` : les cas comptent les commandes de cette rangée
         et ne peuvent pas la reconnaître autrement — `banner` appartient déjà à
         la coquille, et un saut de parent depuis le titre casse au premier
         niveau intermédiaire. */
      data-en-tete-de-page=""
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        <Titre className="display-app text-balance">{title}</Titre>
        {description && (
          <p className="mt-2 max-w-[62ch] text-body text-pretty text-muted">{description}</p>
        )}
      </div>
      {/* `flex-wrap` SANS `shrink-0` : les deux se contredisaient. `shrink-0`
          interdit au bloc de descendre sous sa largeur `max-content`, donc le
          retour à la ligne que `flex-wrap` déclare vouloir n'arrivait jamais —
          les actions poussaient la rangée au-delà de la fenêtre et TOUT l'écran
          défilait latéralement. Mesuré sur `/app/paiements` : 812 px de boutons
          dans 700 px de fenêtre, `scrollX=160` ; le défaut vivait de 700 à
          860 px de large, c'est-à-dire dans la bande que ni le téléphone ni le
          bureau ne montrent. Le bloc de titre porte déjà `min-w-0` : c'est lui
          qui cède la place, et le titre se replie, ce qu'un titre sait faire. */}
      {(actions || debordement) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {/*
            LE DÉBORDEMENT VIT DANS L'EN-TÊTE, ET NON CHEZ L'APPELANT.

            Trois écrans portaient plus de deux commandes — quatre sur les
            paiements —, et un quatrième en avait posé une HORS de l'en-tête,
            sur sa propre ligne sous la description, faute de place. Chacun
            aurait pu se replier à sa façon ; ils se seraient repliés de quatre
            façons.

            L'en-tête est le seul endroit qui sait ce qu'une rangée d'actions
            doit être : deux commandes sous les yeux, le reste à un geste. Le
            menu se rend `null` tout seul quand on ne lui donne rien — voir
            `MenuDeDebordement`.
          */}
          {debordement}
        </div>
      )}
    </div>
  )
}
