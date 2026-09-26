import { Icon, type IconName } from '@/components/primitives/Icon'
import { CURRENCIES } from '@/currency/currencies'
import { COUNTRIES } from '@/lib/countries'
import { LOCALES } from '@/i18n/locales'
import { useT } from '@/i18n/I18nProvider'

/**
 * LA COLONNE DE LECTURE FINISSAIT TROP TÔT, ET LE VIDE N'ÉTAIT PAS DESSINÉ.
 *
 * Mesuré à 1440 px avant ce lot : la carte d'aperçu fait 494 px de haut, la
 * colonne de gauche 245 — titre exclu, il est au-dessus des deux. Deux cent
 * cinquante pixels de blanc tombaient donc sous la mention de gratuité, du côté
 * qui PORTE la lecture. Le hero se lisait comme une illustration à laquelle on
 * avait accroché du texte.
 *
 * Ce qui manquait n'était pas du remplissage : c'était la PREUVE. La promesse
 * « gestion locative multi-pays » est faite dans l'amorce, à la première ligne
 * de la page, et rien ne l'étayait avant la section internationale — cinq
 * sections plus bas, soit après la décision de la plupart des visiteurs.
 *
 * LES TROIS NOMBRES SONT DÉRIVÉS, JAMAIS ÉCRITS. C'est la même règle que la
 * section internationale, pour la même raison : « 21 pays » en dur devient faux
 * au premier pays ajouté, et personne ne relit une page de vente pour vérifier
 * un nombre qu'on croit fixe. Les libellés sont ceux de cette section-là, au
 * mot près — la page dit deux fois la même chose, elle ne doit pas la dire de
 * deux façons.
 */
const PREUVES: { key: 'currencies' | 'languages' | 'countries'; icone: IconName }[] = [
  { key: 'currencies', icone: 'card' },
  { key: 'languages', icone: 'monitor' },
  { key: 'countries', icone: 'globe' },
]

export function HeroProof() {
  const t = useT()

  const valeurs: Record<(typeof PREUVES)[number]['key'], number> = {
    currencies: CURRENCIES.length,
    languages: LOCALES.length,
    countries: COUNTRIES.length,
  }

  return (
    /* Une règle en tête plutôt qu'une carte : ces trois faits ne sont pas un
       objet de plus dans le hero, ils sont le PIED de la colonne de lecture.
       Une carte les aurait mis en concurrence avec l'aperçu, qui est la seule
       surface que cet écran doit porter. */
    /* LA RANGÉE S'EMPILE SOUS 360 PX, ET LA BORNE EST MESURÉE, PAS CHOISIE.
       `mesure-ui` a relevé 43 px de débordement LOCAL à 320 px, sur dix-sept
       occurrences : la gouttière rend 280 px, moins deux écarts de 24, soit
       85 px par colonne — dont 22 pour le glyphe et son écart. Il reste 63 px
       pour « Supported currencies », dont le seul premier mot en fait 85 en
       petites capitales. Aucune césure ne rattrape cela ; il faut la colonne.
       À 360 px non plus, et c'est la deuxième mesure qui l'a dit : l'anglais y
       déborde encore de 29 px sur onze occurrences — « Supported currencies »
       est plus long que son homologue français, et c'est lui qui décide. La
       rangée de TROIS ne reprend donc qu'à `sm`, où la colonne vaut 200 px.

       DEUX colonnes en dessous, et non une seule : empilés, les trois faits
       coûtaient 230 px sur l'écran le plus contraint de la page — celui que
       `plafond-vitrine` garde à 360. En deux colonnes, chacune vaut 148 px à
       360 et 128 à 320, où le plus long des six libellés tient sur deux lignes
       sans déborder. Deux rangées au lieu de trois. */
    <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-7 sm:grid-cols-3">
      {PREUVES.map(({ key, icone }) => (
        <div key={key} className="min-w-0">
          {/* Le glyphe et le libellé ne tiennent pas sur une ligne dans un
              tiers de colonne — « Pays proposés à l'inscription » fait à lui
              seul trois mots de plus que ses voisins. `items-start` pose donc
              le signe sur la PREMIÈRE ligne du libellé et le laisse se replier
              sous lui, plutôt que de centrer un glyphe sur deux lignes. */}
          <dt className="eyebrow flex items-start gap-2 text-muted">
            <Icon name={icone} size={14} className="mt-0.5 shrink-0 text-accent-ink" />
            <span className="min-w-0">
              {t(`marketing.international.${key}` as 'marketing.international.currencies')}
            </span>
          </dt>
          {/* `numeric` : chasse fixe, comme partout où le produit peint un
              nombre. Trois chiffres alignés sur une rangée qui se replie ne
              peuvent pas danser d'une langue à l'autre. */}
          <dd className="numeric mt-2 text-title-l leading-none font-medium text-ink">
            {valeurs[key]}
          </dd>
        </div>
      ))}
    </dl>
  )
}
