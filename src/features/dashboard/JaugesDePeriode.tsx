import { JaugeDePoste } from '@/components/primitives/StatusPill'
import { useT } from '@/i18n/I18nProvider'
import { imputation, type Receipt } from '@/data/portfolio'

/**
 * L'ÉTAT D'UNE PÉRIODE, POSTE PAR POSTE — trois jauges, loyer · eau ·
 * électricité, et un seul nom accessible.
 *
 * Née dans la grille des paiements, où elle était la cellule d'une période ;
 * le parc la reprend sur chaque fiche de logement pour le mois affiché. UN SEUL
 * COMPOSANT POUR LES DEUX ÉCRANS, et c'est le point : la légende des paiements
 * est la clé de lecture des deux, et une clé n'ouvre que la forme qu'elle
 * montre. Deux copies auraient dérivé — un ordre de postes, une imputation.
 *
 * Trois pastilles et non un seul statut : c'est précisément la distinction
 * qu'un statut global ne sait pas faire. Un locataire qui règle son loyer et
 * laisse courir l'électricité n'est pas « en retard » au même titre que celui
 * qui n'a rien versé, et la démarche à engager n'est pas la même.
 *
 * La couleur ne porte pas l'information toute seule : le nom accessible énonce
 * les trois états en toutes lettres. Ce nom tient au `role="img"`, et non au
 * seul `aria-label`. ARIA 1.2 INTERDIT de nommer le rôle `generic` — celui
 * qu'un `<span>` sans rôle porte implicitement : un navigateur conforme jette
 * l'étiquette, et la cellule se lit vide puisque ses pastilles sont
 * `aria-hidden`. `img` est le rôle qui convient : il accepte d'être nommé, et
 * il rend son contenu présentationnel — ce que ces glyphes sont déjà.
 *
 * La garde interroge donc `getByRole`, jamais `getByLabelText` : celui-ci lit
 * l'attribut sans passer par le calcul du nom accessible, et réussissait sur
 * une cellule que le navigateur laissait muette.
 *
 * Le cas SANS échéance appartient à l'appelant : la grille dit « hors bail »
 * pour une période antérieure à l'entrée, la fiche ne dit rien d'un mois que
 * personne n'a appelé — la pastille d'état le porte déjà.
 */
export function JaugesDePeriode({ receipt, periode }: { receipt: Receipt; periode: string }) {
  const t = useT()
  const regle = imputation(receipt)
  /**
   * Les postes nommés EN TOUTES LETTRES.
   *
   * Première rédaction : les intitulés de colonne du tableau du locataire, où
   * l'électricité s'abrège en « Élec. » faute de largeur. Ici il ne s'agit pas
   * d'une en-tête mais d'un nom accessible — la seule chose qu'un lecteur
   * d'écran prononce de cette cellule. Une abréviation y est un mot de moins,
   * pas une colonne de gagnée.
   */
  const postes = [
    { cle: 'app.tenant.colRent', du: receipt.rentMinor, paye: regle.rent },
    { cle: 'app.tenant.water', du: receipt.waterMinor, paye: regle.water },
    { cle: 'app.tenant.power', du: receipt.powerMinor, paye: regle.power },
  ] as const

  const etat = (du: number, paye: number) =>
    du === 0 || paye >= du ? 'paid' : paye > 0 ? 'partial' : 'overdue'

  return (
    <span
      role="img"
      className="flex items-center gap-1"
      aria-label={`${periode} · ${postes
        .map(
          (p) =>
            `${t(p.cle as 'app.tenant.colRent')} ${t(
              `app.payments.state.${etat(p.du, p.paye)}` as 'app.payments.state.paid',
            )}`,
        )
        .join(', ')}`}
    >
      {postes.map((p) => (
        <JaugeDePoste key={p.cle} etat={etat(p.du, p.paye)} />
      ))}
    </span>
  )
}

/**
 * LA LÉGENDE DES TROIS JAUGES, et elle n'est pas décorative.
 *
 * Trois jauges dans une cellule ou sur une fiche ne disent rien à qui les voit
 * pour la première fois — ni ce que chacune désigne, ni ce que son remplissage
 * veut dire. Chaque site porte bien un nom accessible qui énonce les trois
 * états en toutes lettres, mais un lecteur voyant n'y a pas accès : sans cette
 * ligne, la grille se déchiffre au lieu de se lire.
 *
 * ELLE PORTE LA MÊME JAUGE QUE LES SITES, par le même composant. Une légende
 * qui montrerait une autre forme que celle de la grille serait une clé qui
 * n'ouvre pas — pire que pas de légende du tout, parce qu'on la croit.
 *
 * `intitule` est ce que l'écran met devant : « Par cellule : … » pour la
 * grille, « Sur chaque fiche : … » pour le parc. Le reste — les trois états et
 * leur mot — est le même partout, par construction.
 */
export function LegendeDesPostes({
  intitule,
  suite,
  className,
}: {
  intitule: string
  /** Ce que la ligne dit APRÈS les trois états — la grille y met « hors bail ». */
  suite?: string
  className?: string
}) {
  const t = useT()
  return (
    <p className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label text-muted ${className ?? ''}`}>
      <span>{intitule}</span>
      {(['paid', 'partial', 'overdue'] as const).map((etat) => (
        <span key={etat} className="flex items-center gap-1.5">
          <JaugeDePoste etat={etat} />
          {t(`app.payments.state.${etat}` as 'app.payments.state.paid')}
        </span>
      ))}
      {suite && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">—</span>
          {suite}
        </span>
      )}
    </p>
  )
}
