import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, within } from '@/test/render'
import { DataTable } from './DataTable'

/**
 * CE QUI NOMME LA LIGNE EST UN EN-TÊTE DE LIGNE.
 *
 * ═══ CE QUE LES HUIT TABLEAUX NE DISAIENT PAS ═══
 *
 * Toutes leurs cellules étaient des `<td>`. Les en-têtes de COLONNE étaient là,
 * `scope="col"` compris, et même le `scope="rowgroup"` d'un bloc d'immeuble ;
 * les en-têtes de LIGNE, aucun. Or c'est eux qu'un lecteur d'écran annonce à
 * chaque déplacement dans le tableau : sans eux, parcourir la colonne des
 * loyers du parc donne « 145 000 FCFA », « 110 000 FCFA », « 95 000 FCFA » —
 * trois montants et aucun logement. Il fallait revenir en première colonne
 * après chaque valeur, c'est-à-dire faire à la main le travail que `scope`
 * existe pour supprimer.
 *
 * ET LA FORME EN FICHES TENAIT DÉJÀ LE CONTRAT : l'identité y est la ligne de
 * tête de la carte, inséparable du reste. Les deux formes rendent la même
 * donnée ; elles la nommaient différemment.
 *
 * ═══ POURQUOI CE CAS EST SUR LE PRIMITIF, ET NON SUR UN ÉCRAN ═══
 *
 * Le rôle `identite` est déclaré par l'écran, mais la BALISE est choisie par
 * `DataTable` : un écran ne peut ni l'obtenir ni la perdre. Le tenir ici le tient
 * pour les huit — parc, locataires, encaissements, cautions, relevés, et les
 * trois tableaux des accès.
 */

interface Ligne {
  id: string
  logement: string
  loyer: string
}

const LIGNES: Ligne[] = [
  { id: 'a1', logement: 'A1', loyer: '145 000' },
  { id: 'a2', logement: 'A2', loyer: '110 000' },
]

function Tableau({ numerique = false, gestes = false }: { numerique?: boolean; gestes?: boolean }) {
  return (
    <DataTable<Ligne>
      caption="Logements"
      rows={LIGNES}
      rowKey={(l) => l.id}
      columns={[
        {
          key: 'logement',
          role: 'identite',
          header: 'Logement',
          numeric: numerique,
          render: (l) => <span className="font-medium">{l.logement}</span>,
        },
        {
          key: 'loyer',
          role: 'valeur',
          header: 'Loyer',
          numeric: true,
          render: (l) => <span>{l.loyer}</span>,
        },
        /* LA COLONNE DE GESTES, telle que cinq écrans la déclarent : un en-tête
           VIDE, ce qui est juste à l'œil au-dessus d'un menu à trois points. */
        ...(gestes
          ? [
              {
                key: 'gestes' as const,
                role: 'geste' as const,
                header: '',
                render: (l: Ligne) => <button type="button">Ouvrir {l.logement}</button>,
              },
            ]
          : []),
      ]}
    />
  )
}

/** Le vrai tableau, et non la liste de fiches que la même donnée rend aussi. */
function lignes() {
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1)
}

describe('l’en-tête de ligne d’un tableau', () => {
  it('fait de l’identité un en-tête qui porte sur sa ligne', () => {
    renderWithProviders(<Tableau />)

    for (const ligne of lignes()) {
      const cellules = ligne.children
      const premiere = cellules[0]

      expect(
        premiere.tagName,
        'l’identité est une cellule ordinaire : la valeur se lit sans son nom',
      ).toBe('TH')
      /* `row` ET NON `col` : l'en-tête porte sur ce qui SUIT dans sa ligne. Un
         `scope` omis laisserait le navigateur deviner, et les algorithmes de
         déduction diffèrent d'un lecteur à l'autre. */
      expect(premiere.getAttribute('scope'), 'l’en-tête ne dit pas sur quoi il porte').toBe('row')
    }
  })

  it('n’en fait pas un en-tête de plus dans la colonne des valeurs', () => {
    renderWithProviders(<Tableau />)

    for (const ligne of lignes()) {
      /* UNE SEULE, et le rôle le dit : « ce qui nomme la ligne […] une seule ».
         Deux en-têtes par ligne rendraient l'annonce plus bavarde que l'absence
         qu'on corrige. */
      expect(
        within(ligne).queryAllByRole('rowheader').length,
        'la ligne porte plus d’un en-tête',
      ).toBe(1)
    }
  })

  it('ne change pas un pixel de ce que la colonne rendait', () => {
    renderWithProviders(<Tableau />)

    const premiere = lignes()[0].children[0]
    /* UN `<th>` S'AJOUTE DU GRAS ET DU CENTRAGE. La graisse appartient au rendu
       de la colonne — qui porte son propre `font-medium` — et le centrage n'a
       jamais été voulu : sans ces deux classes, la colonne d'identité de huit
       écrans deviendrait gras sur gras, centrée. */
    expect(premiere.className, 'le gras du navigateur revient sur celui du rendu').toContain(
      'font-normal',
    )
    expect(premiere.className, 'l’identité se centre').toContain('text-left')
  })

  it('laisse une identité numérique alignée à droite', () => {
    renderWithProviders(<Tableau numerique />)

    const premiere = lignes()[0].children[0]
    /* DEUX CLASSES DE LA MÊME PROPRIÉTÉ NE SE DÉPARTAGENT QUE PAR L'ORDRE de la
       feuille produite par Tailwind, que rien ici ne contrôle : `text-left` ne
       doit donc pas être posé à côté du `text-right` de `numeric`. Aucune
       colonne d'identité n'est numérique aujourd'hui ; ce cas garde la porte
       pour celle qui le sera. */
    expect(premiere.className).toContain('text-right')
    expect(premiere.className, 'deux alignements se disputent la cellule').not.toMatch(
      /\btext-left\b/,
    )
  })
})

describe('le nom de la colonne de gestes', () => {
  it('est dit sans être montré', () => {
    renderWithProviders(<Tableau gestes />)

    const entetes = within(screen.getByRole('table')).getAllByRole('columnheader')
    const dernier = entetes[entetes.length - 1]

    /* UN `<th>` VIDE NE SE TAIT PAS. Un lecteur d'écran qui entre dans la
       colonne annonce « colonne 3, vide », et la liste des en-têtes — celle par
       laquelle on s'oriente AVANT de lire le tableau — porte un trou. Le nom est
       donc dit et non montré : « Gestes » écrit en clair au-dessus d'un menu à
       trois points serait un mot que personne ne lit. */
    expect(dernier.textContent, 'la colonne de gestes n’a toujours aucun nom').toBe('Gestes')
    expect(
      dernier.querySelector('.sr-only'),
      'le nom est montré alors qu’il ne devait qu’être dit',
    ).not.toBeNull()
  })

  it('laisse l’écran nommer sa colonne lui-même', () => {
    renderWithProviders(<Tableau />)

    /* LE NOM DONNÉ PAR L'APPELANT GAGNE : ce repli ne sert qu'au cas où
       l'en-tête est vide à dessein, et il ne doit rien imposer aux colonnes qui
       se nomment. */
    const entetes = within(screen.getByRole('table')).getAllByRole('columnheader')
    expect(entetes.map((e) => e.textContent)).toEqual(['Logement', 'Loyer'])
  })
})
