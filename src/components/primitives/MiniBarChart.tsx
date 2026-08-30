/**
 * LE PETIT GRAPHE À BARRES, SORTI DE `Charts.tsx` — et ce que ça a rendu.
 *
 * ═══ CE QUE LA MESURE A DIT ═══
 *
 * `Hero.tsx` importait ce seul composant d'un module de 114 ko. Rollup n'en
 * élaguait presque rien : le morceau IMPATIENT de la vitrine — celui qu'un
 * prospect télécharge avant la première phrase de vente — portait 15 228 octets
 * pour lui. Mesuré le 2026-08-30, trois constructions du même arbre :
 *
 *   import depuis `Charts.tsx`   427 226 o bruts   142 526 gzip
 *   ce fichier-ci                414 259 o bruts   139 401 gzip
 *   sans aucun graphique         411 998 o bruts   138 846 gzip
 *
 * Le déplacement rend 12 967 octets bruts et 3 125 SUR LE FIL — 63 ms à
 * 400 kb/s, le débit que tout ce dépôt retient comme profil du marché visé.
 * C'est quatre-vingt-cinq pour cent de ce qu'on gagnerait à retirer le graphique
 * ENTIÈREMENT : le composant lui-même ne pèse que 2 261 octets, et le reste
 * était du voisinage.
 *
 * ═══ POURQUOI PAS `React.lazy` ═══
 *
 * C'était la piste nommée dans le motif gravé des plafonds de poids. Elle rend
 * les 15 % restants et coûte trois choses : un remplissage à hauteur exacte,
 * sans quoi le contenu saute sous le graphique ; une page qui arrive en deux
 * vagues, donc des portes qui mesurent selon le moment ; et une apparition
 * visible à 1280 px, où le graphique est dans le premier écran — mesuré, son
 * haut est à 555 px pour une vue de 900.
 *
 * Sur le téléphone du marché — 360×640 — il est à 810 px, donc HORS du premier
 * écran, et c'est là que les 63 ms se paient. Le déplacement les rend sans rien
 * de tout cela. Le paresseux reste possible ; il n'est plus urgent.
 *
 * ═══ CE QUE CE FICHIER NE GARANTIT PAS ═══
 *
 * Que le voisinage ne revienne pas. Rien n'empêche quelqu'un d'importer à
 * nouveau `Charts.tsx` ici ou dans `Hero.tsx`. Ce qui l'empêche est ailleurs :
 * `poids-ecrans` porte le plafond de `/@360`, inscrit à la baisse après ce lot,
 * et une régression qui rendrait ces octets serait refusée par le cliquet.
 */
import { useId, useState } from 'react'
import { useCurrency } from '@/currency/CurrencyProvider'
import { hachureOuverte } from './hachure'

/**
 * Histogramme compact à série unique, pour l'aperçu du hero.
 *
 * Il remplace une rangée de barres purement décoratives, marquées
 * `aria-hidden`. Une décoration qui a la forme exacte d'un graphique n'est pas
 * une décoration : le visiteur essaie de la lire, et le lecteur d'écran n'y
 * trouve rien. Ces barres portent donc de vraies valeurs, suivent la devise
 * choisie, s'interrogent au survol comme au clavier, et sont doublées d'une
 * table.
 */
export function MiniBarChart({
  bars,
  caption,
  openPeriodNote,
  format,
  emptyLabel = '—',
}: {
  /**
   * `value: null` — la barre est ABSENTE, non nulle.
   *
   * Une barre au sol et une barre manquante racontent deux choses
   * différentes : « il n'a rien consommé » et « on ne sait pas ». Sur une série
   * de relevés la seconde est la règle — un mois non relevé, un compteur
   * remplacé — et l'afficher à zéro se lirait comme une absence à domicile.
   *
   * `key` sépare l'identité React du libellé affiché : douze relevés peuvent
   * s'étaler sur quatorze mois si des périodes manquent, « août » revient alors
   * deux fois, et React fige une barre à la mauvaise hauteur sans rien casser
   * ni prévenir.
   */
  bars: { key?: string; label: string; value: number | null }[]
  caption: string
  openPeriodNote?: string
  /**
   * Comment lire une valeur. Par défaut de la monnaie — ce que cette carte
   * montrait à l'origine —, mais un compteur se lit en m³ ou en kWh, et `money`
   * y inscrivait des francs sur des mètres cubes.
   */
  format?: (value: number) => string
  /** Ce qu'annonce une période sans valeur dérivable. */
  emptyLabel?: string
}) {
  const { money } = useCurrency()
  const titleId = useId()
  const [active, setActive] = useState<number | null>(null)

  const lire = format ?? ((v: number) => money(v, { compact: true }))
  // Les périodes inconnues ne pèsent pas sur l'échelle : une barre absente ne
  // doit ni écraser ni gonfler les autres.
  const max = Math.max(...bars.map((b) => b.value ?? 0), 1) * 1.04

  return (
    <figure className="m-0" aria-labelledby={titleId}>
      {/*
        LE GRAPHE DÉFILE PLUTÔT QUE DE RENDRE UN MOIS INATTEIGNABLE.

        Mesuré : à 320 px les douze colonnes tombaient à 14 px de large pour un
        pas de 18. WCAG 2.5.8 tolère une cible sous 24 px si un cercle de 24 px
        centré dessus ne rencontre pas celui de sa voisine — à 18 px de pas, ils
        se chevauchent. Vingt-quatre cibles échouaient sur cet écran.

        Et l'enjeu n'est pas l'ergonomie : taper entre deux colonnes affiche la
        valeur de la VOISINE, sans rien qui le signale. Le locataire lit alors
        « 19 m³ » pour un mois qui en faisait 14, et croit lire son relevé.

        `min-w-6` pose le plancher de 24 px, `overflow-x-auto` laisse la
        conséquence défiler DANS SA PROPRE BOÎTE — jamais le document, c'est la
        règle que `DataTable` applique déjà. La dernière colonne coupée signale
        qu'il en reste. Le clavier atteint tout : chaque colonne est un bouton,
        et tabuler fait défiler.

        Rien n'est recouvert au passage : la lecture de cette carte est fixe
        SOUS le graphe — voir plus bas — et non une infobulle flottante qu'un
        `overflow` aurait rognée.
      */}
      <div className="relative flex h-24 items-end gap-1 overflow-x-auto sm:h-28 sm:gap-1.5">
        {bars.map((bar, index) => {
          const isLast = index === bars.length - 1
          const isActive = active === index

          return (
            <button
              key={bar.key ?? bar.label}
              type="button"
              /* Même exemption que le graphe empilé plus haut, pour la même
                 raison : la largeur d'une colonne est celle que la donnée et la
                 fenêtre lui laissent, et la colonne n'agit pas — elle informe. */
              data-cible="donnee"
              className="group flex h-full min-w-6 flex-1 shrink-0 cursor-pointer items-end rounded-sm"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive((c) => (c === index ? null : c))}
              onFocus={() => setActive(index)}
              onBlur={() => setActive((c) => (c === index ? null : c))}
              aria-label={`${bar.label} — ${bar.value === null ? emptyLabel : lire(bar.value)}`}
            >
              <span
                className="animate-grow-y w-full rounded-t-bar transition-shadow duration-150"
                style={{
                  // Une période inconnue garde un filet de 2 px : la colonne
                  // reste visible et cliquable — sans quoi le trou se lirait
                  // comme un mois qui n'existe pas — mais aucune hauteur ne
                  // suggère une quantité.
                  height: bar.value === null ? '2px' : `${(bar.value / max) * 100}%`,
                  // La colonne du mois courant se distingue des onze autres :
                  // c'est une DONNÉE mise en avant, pas un ornement. L'accent
                  // nu n'a jamais pu la porter : l'or de marque tombait à
                  // 2,87:1 sur la carte, sous le seuil de 3:1, et le bleu qui a
                  // pris sa place ne rend que 3,13:1 sur la carte sombre — et
                  // le commentaire d'en-tête de ce fichier l'interdisait déjà.
                  // `--color-accent-ink` tient 6,30 sur `--paper` en clair et
                  // 8,30 sur `--surface` en sombre, en gardant l'écart de
                  // clarté avec `data-1` qui
                  // rend les deux distinguables en niveaux de gris. La hachure
                  // s'y ajoute pour dire la même chose que chez la voisine
                  // empilée : la période n'est pas close.
                  //
                  // LA PÉRIODE SANS RELEVÉ CHANGE DE JETON. `--color-divider`
                  // vaut 1,29:1 sur la carte claire et 1,13:1 en sombre : le
                  // raisonnement au-dessus était juste — « la colonne reste
                  // visible » — mais la valeur du jeton le démentait, et le
                  // filet de deux pixels était invisible, donc le trou se
                  // lisait bien comme un mois qui n'existe pas. Un jeton de
                  // SÉPARATEUR n'est pas fait pour porter du sens ;
                  // `--color-muted-soft` l'est, et tient 4,75:1 en clair,
                  // 4,33:1 en sombre.
                  background:
                    bar.value === null
                      ? 'var(--color-muted-soft)'
                      : isLast
                        ? hachureOuverte('var(--color-accent-ink)')
                        : 'var(--color-data-1)',
                  animationDelay: `${index * 40}ms`,
                  // Même arbitrage que chez la voisine empilée : la colonne
                  // visée reçoit un liseré, les autres ne perdent rien. À 0,40
                  // elles retombaient à 2,47:1 en clair pour `data-1` et 1,79:1
                  // pour l'or d'alors, sous le seuil, au survol comme au
                  // focus.
                  boxShadow: isActive ? '0 0 0 2px var(--color-ink)' : undefined,
                }}
              />
            </button>
          )
        })}

      </div>

      {/* Lecture fixe plutôt qu'infobulle flottante.
          Sur une carte de cette taille, une infobulle ancrée au-dessus des
          barres recouvrait le montant principal — elle cachait l'information
          qu'elle venait préciser. Ici la valeur s'inscrit toujours au même
          endroit, sous le graphe : rien ne bouge, rien ne se recouvre, et cela
          fonctionne au doigt comme au clavier.

          Les repères de début et de fin restent affichés en permanence. Sans
          eux, la seule façon de savoir de quel mois on parlait était de
          survoler — donc rien au premier regard. */}
      {/*
        HAUTEUR FIXE ET CENTRAGE, ET NON UN PLANCHER ALIGNÉ SUR LA LIGNE DE BASE.

        La case du milieu est vide tant qu'aucune colonne n'est visée : elle
        n'a donc pas de ligne de base, et `items-baseline` calait les deux
        repères de début et de fin sur autre chose. Dès qu'elle se remplissait —
        14 px de corps contre 12 px de surtitre — la ligne de base commune se
        déplaçait et les deux repères sautaient de 4 px, verticalement, à chaque
        colonne survolée. Mesuré : deux sources de décalage, dy = ±4, sur la
        page d'accueil.

        `h-6` couvre la plus haute des deux graisses (14 px × 1,5 = 21 px) et
        `items-center` ne dépend d'aucune ligne de base : la case peut se
        remplir et se vider, la rangée garde sa hauteur et ses voisines leur
        place.
      */}
      <div className="mt-3 flex h-6 items-center justify-between gap-3">
        <span
          aria-hidden="true"
          className="text-caps text-muted uppercase"
        >
          {bars[0]?.label}
        </span>

        <span
          aria-live="polite"
          className="min-w-0 truncate text-center text-body font-medium text-ink"
        >
          {active !== null && (
            <>
              <span className="text-caps text-muted uppercase">
                {bars[active].label}
              </span>{' '}
              <span className="numeric">
                {bars[active].value === null ? emptyLabel : lire(bars[active].value)}
              </span>
            </>
          )}
        </span>

        <span
          aria-hidden="true"
          className="text-caps text-muted uppercase"
        >
          {bars[bars.length - 1]?.label}
        </span>
      </div>

      {/* Le mois en cours est encore ouvert : sa colonne est plus basse sans
          que rien ne l'explique.

          PERMANENTE, et non révélée au survol de la dernière colonne. Sous sa
          forme conditionnelle, elle apparaissait et disparaissait au passage du
          pointeur : une ligne de texte qui pousse tout ce qui suit, sur la page
          d'accueil, sous le curseur de qui lit. Même défaut que celui de
          `LectureFixe`, même correctif — et pour la même seconde raison : un
          téléphone n'a pas de survol, donc la note n'y existait jamais. */}
      {openPeriodNote && (
        <p className="mt-1.5 text-center text-body text-muted">{openPeriodNote}</p>
      )}

      <div className="sr-only">
        <table>
          <caption id={titleId}>{caption}</caption>
          <tbody>
            {bars.map((bar) => (
              // Même clé que les colonnes : deux « août » dans une série ne
              // doivent pas se confondre ici non plus.
              <tr key={bar.key ?? bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{bar.value === null ? emptyLabel : lire(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}