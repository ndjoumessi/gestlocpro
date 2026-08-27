import { useLocation } from 'react-router-dom'
import { useT } from '@/i18n/I18nProvider'

/**
 * DÉTACHÉ DE `NotFound.tsx`, pour la même raison que `PageHeader.tsx` a été
 * détaché d'`AppShell.tsx`.
 *
 * `routes/NotFound.tsx` (public) et `routes/NotFoundInApp.tsx` (réservé à
 * l'espace applicatif) partageaient ce composant en le import-ant l'un de
 * chez l'autre. La règle de fuite de `mesure-ui.mjs` — un module réservé à
 * l'application ne doit JAMAIS apparaître dans le paquet impatient — ne peut
 * se vérifier au niveau du FICHIER que si chaque fichier n'a qu'un public.
 * Un fichier qui sert les deux côtés à la fois rendrait la règle aveugle à
 * elle-même : elle devrait soit ignorer ce fichier par exception nommée, soit
 * le prendre pour un faux positif permanent. Le séparer une fois coûte moins
 * que de maintenir cette exception pour toujours.
 */

/** Longueur au-delà de laquelle l'adresse fautive est coupée. */
const MAX_PATH = 120

/**
 * Rappelle l'adresse demandée.
 *
 * Sans elle, l'utilisateur ne peut ni corriger sa saisie ni signaler utilement
 * le lien mort. Elle est coupée, car rien n'empêche une adresse arbitrairement
 * longue de repousser les boutons hors de l'écran ; React échappe le texte,
 * l'afficher est donc sans risque.
 *
 * ═══ L'ADRESSE ENTIÈRE, ET NON SEULEMENT LE CHEMIN ═══
 *
 * Elle ne rendait que `pathname`. Mesuré au navigateur sur
 * `/produits/ancienne-page?ref=lettre-2024&utm=mail` : l'écran affichait
 * « /produits/ancienne-page » sous le mot « Adresse demandée ». Or c'est la
 * PART SUPPRIMÉE qui dit lequel des liens morts on vient de suivre — une
 * campagne, un courriel, un message. Les deux usages que l'en-tête ci-dessus
 * revendique, corriger et signaler, étaient précisément ceux que la coupure
 * empêchait.
 *
 * `search` et `hash` reviennent donc. Ils sont déjà dans la barre d'adresse de
 * l'utilisateur : les montrer ne divulgue rien qu'il n'ait sous les yeux, et le
 * plafond de 120 caractères s'applique maintenant à l'ensemble plutôt qu'au seul
 * chemin — c'est-à-dire à ce qui menace vraiment la mise en page.
 *
 * ═══ UN TERME ET SA DÉFINITION, PAS DEUX PARAGRAPHES ═══
 *
 * « Adresse demandée » nomme, l'adresse définit. Empilés en deux `<p>`, le lien
 * entre les deux ne tient qu'à la mise en page — c'est-à-dire à rien, pour qui
 * ne la voit pas. Un lecteur d'écran annonce le TERME avant sa DÉFINITION quand
 * le balisage le dit ; c'est la règle que les fiches des écrans-tableaux
 * appliquent déjà, et elle valait ici aussi.
 */
export function AttemptedPath() {
  const t = useT()
  const { pathname, search, hash } = useLocation()
  const complete = `${pathname}${search}${hash}`
  const shown = complete.length > MAX_PATH ? `${complete.slice(0, MAX_PATH)}…` : complete

  return (
    <dl className="rounded-lg border border-border bg-surface px-4 py-3">
      <dt className="text-body text-muted">{t('notFound.attempted')}</dt>
      {/* `break-all` et non `break-words` : une adresse n'a pas de mots, et la
          couper à la limite des « mots » la laisserait déborder sur un segment
          long. C'est l'un des rares endroits où couper n'importe où est juste. */}
      <dd className="mt-1 text-body break-all text-ink">{shown}</dd>
    </dl>
  )
}
