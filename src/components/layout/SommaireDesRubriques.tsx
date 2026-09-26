import { useT } from '@/i18n/I18nProvider'

/**
 * LE SOMMAIRE D'UNE PAGE JURIDIQUE — treize rubriques, et aucune n'était
 * atteignable autrement qu'en défilant.
 *
 * ═══ LES ANCRES EXISTAIENT DÉJÀ, ET NE SERVAIENT À RIEN ═══
 *
 * Chaque rubrique des conditions générales et de la confidentialité porte un
 * `id` stable — `conditions-fermeture`, `confidentialite-droits` — posé pour
 * que `aria-labelledby` nomme la région. Un identifiant dans le document EST
 * une destination : `/conditions-generales#conditions-fermeture` fonctionne
 * depuis toujours. Rien, sur la page, ne le disait ni n'y menait.
 *
 * Le coût, mesuré sur les conditions générales : 4 679 px à 360 px de large.
 * Quelqu'un qui cherche le délai d'effacement de son compte — la question la
 * plus posée d'un texte comme celui-ci — parcourt treize écrans, en lisant les
 * titres au passage pour ne pas rater le bon.
 *
 * ═══ CE QUI EST PARTAGÉ, ET POURQUOI ═══
 *
 * Les deux pages ont la même structure et la même colonne de lecture ; un
 * sommaire écrit deux fois divergerait sur le premier détail venu — l'écart
 * entre les colonnes, la hauteur des cibles, le mot « Sommaire » lui-même.
 * C'est l'argument que ce dépôt tient déjà pour les grilles d'indicateurs :
 * « le coût n'était pas l'espace, c'était la dérive silencieuse ».
 *
 * Les MENTIONS LÉGALES n'en reçoivent pas : trois rubriques courtes, tenant en
 * un écran et demi, sur lesquelles un sommaire serait une table des matières
 * plus longue à lire que ce qu'elle indexe.
 *
 * ═══ UN `<a href>` ET NON UN `Link` ═══
 *
 * La destination est DANS le document courant. `Link` pousserait une entrée
 * d'historique par saut de rubrique et confierait au routeur un déplacement que
 * le navigateur fait nativement — avec, en prime, le respect de
 * `prefers-reduced-motion` et la mise à jour de la barre d'adresse, donc un
 * lien partageable une fois qu'on a trouvé la clause.
 *
 * ═══ QUARANTE-QUATRE PIXELS PAR ENTRÉE ═══
 *
 * `min-h-11` : ce sont des cibles tactiles, et la sonde des cibles les visite
 * comme les autres.
 *
 * ═══ DEUX COLONNES DÈS 360 PX, ET C'EST UNE MESURE ═══
 *
 * Premier jet : une colonne sous `sm`, deux au-delà. Relevé au navigateur —
 * `/conditions-generales@360` passait de 4 679 px à 5 392, soit SEPT CENT
 * TREIZE pixels pour treize entrées empilées. Un sommaire qui coûte un sixième
 * du document qu'il indexe cesse d'être un raccourci.
 *
 * En deux colonnes, les titres les plus longs se replient sur deux lignes et la
 * rangée grandit — mais sept rangées valent mieux que treize, et le relevé le
 * dit : le surcoût retombe à un peu plus de trois cents pixels. Aucun titre
 * n'est rogné, aucun ne déborde : ils se REPLIENT, ce que la règle du dépôt
 * demande pour toute donnée trop longue pour sa boîte.
 *
 * `gap-x-4` sous `sm` plutôt que `6` : à 360 px la colonne de lecture offre
 * 288 px, et six unités d'écart en retireraient huit à chaque titre.
 */
export function SommaireDesRubriques({
  libelle,
  prefixe,
  rubriques,
}: {
  /** Le nom accessible de la navigation — « Sommaire », dans la langue courante. */
  libelle: string
  /** Le préfixe des identifiants de rubrique : `conditions` ou `confidentialite`. */
  prefixe: string
  /** Les rubriques, dans l'ordre de la page : leur ancre et leur titre. */
  rubriques: readonly { readonly ancre: string; readonly titre: string }[]
}) {
  const t = useT()
  const id = `sommaire-${prefixe}`

  return (
    <nav aria-labelledby={id} className="mt-8 rounded-lg border border-divider bg-surface-2 p-4">
      <h2 id={id} className="eyebrow text-muted">
        {libelle}
      </h2>
      {/*
        `<ol>` ET NON `<ul>` : l'ordre est celui du document, et un lecteur
        d'écran qui annonce « 7 sur 13 » situe la clause dans le texte.

        `-my-1` sur la liste compense la hauteur de cible : chaque entrée fait
        44 px alors que sa ligne de texte en fait 20, et sans cela le bloc
        gagnerait 24 px de rembourrage en haut et en bas qu'aucun texte
        n'occupe.
      */}
      <ol className="mt-1 -my-1 grid grid-cols-2 gap-x-4 sm:gap-x-6">
        {rubriques.map(({ ancre, titre }) => (
          <li key={ancre}>
            <a
              href={`#${prefixe}-${ancre}`}
              className="flex min-h-11 items-center text-body text-accent-ink underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-current"
            >
              {titre}
            </a>
          </li>
        ))}
      </ol>
      {/* CE QUE LE SOMMAIRE NE DIT PAS TOUT SEUL : qu'on peut emporter le lien
          d'une clause. L'ancre paraît dans la barre d'adresse au clic, et cette
          phrase est la seule chose qui apprenne qu'elle est faite pour être
          copiée — une réponse à un locataire ou à un gestionnaire cite une
          clause, pas une page. */}
      <p className="mt-2 text-caption text-muted">{t('legal.anchorHint')}</p>
    </nav>
  )
}
