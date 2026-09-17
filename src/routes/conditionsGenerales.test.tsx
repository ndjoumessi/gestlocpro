import { describe, expect, it } from 'vitest'
import FERMETURE from '../../server/src/auth/fermeture.ts?raw'
import { renderApp, screen, within } from '@/test/render'
import { DELAI_D_EFFACEMENT_JOURS } from '@/legal/conditions'

/**
 * LES CONDITIONS GÉNÉRALES — ce qui se garde, et ce qui ne se garde pas.
 *
 * ═══ CE QU'UN CAS NE PEUT PAS TENIR ═══
 *
 * La JUSTESSE juridique de ce texte. Aucune assertion ne dira qu'une clause de
 * responsabilité est opposable, ni qu'une limitation tient devant un juge. Ce
 * fichier tient les cinq choses qui, elles, se mesurent — et qui sont
 * précisément celles qui pourrissent en silence.
 *
 * ═══ CE QU'IL TIENT ═══
 *
 *  1. LE DÉLAI D'EFFACEMENT EST CELUI DU SERVEUR. La page promet un nombre de
 *     jours ; le serveur en tient un autre le jour où quelqu'un le change. Ce
 *     cas LIT la source du serveur plutôt que de recopier trente — une page
 *     juridique qui promet un délai que le code ne tient pas est un engagement
 *     sans soutien, et rien d'autre ne le verrait.
 *  2. LA PAGE EST ATTEIGNABLE, dans les deux langues. Un texte qu'on s'engage à
 *     respecter et qu'aucun lien n'atteint n'est pas publié.
 *  3. LA GRATUITÉ EST DITE, ET SA SORTIE AUSSI. C'est la phrase la plus
 *     susceptible de vieillir : le jour où une facturation existera, elle
 *     deviendra fausse. Un cas la nomme pour qu'on ne puisse pas l'oublier.
 *  4. LE RÔLE DE RESPONSABLE DE TRAITEMENT DU BAILLEUR. C'est la clause propre à
 *     ce produit — un bailleur y enregistre les données personnelles de tiers —
 *     et la seule qu'un texte générique aurait omise.
 *  5. LES RUBRIQUES EXISTENT DANS LES DEUX LANGUES. Une page juridique traduite
 *     à moitié laisse un lecteur anglophone devant un texte qui l'engage.
 *
 * La source du serveur est lue par `?raw` et non par `node:fs` : ce fichier
 * MONTE la page, il lui faut les types du DOM — même raison que
 * `confidentialite.test.tsx`.
 */
describe('les conditions générales d’utilisation', () => {
  it('promettent le délai d’effacement que le SERVEUR tient', async () => {
    /* LU, JAMAIS RECOPIÉ. Le client ne peut pas importer le serveur — deux
       paquets, deux compilations —, donc la constante est dupliquée ; ce cas est
       le seul endroit où les deux se regardent. */
    const duServeur = /DELAI_D_EFFACEMENT_JOURS\s*=\s*(\d+)/.exec(FERMETURE)?.[1]
    expect(duServeur, 'la constante du serveur est introuvable').toBeDefined()
    expect(DELAI_D_EFFACEMENT_JOURS).toBe(Number(duServeur))

    await renderApp('/conditions-generales')
    const fermeture = screen.getByRole('region', { name: /Durée, résiliation et effacement/ })
    expect(within(fermeture).getByText(new RegExp(`${duServeur} jours`))).toBeInTheDocument()
  })

  it('disent la gratuité, et ce qu’il faudra faire pour en sortir', async () => {
    await renderApp('/conditions-generales')
    const prix = screen.getByRole('region', { name: 'Prix' })
    expect(within(prix).getByText(/sans contrepartie financière à ce jour/)).toBeInTheDocument()
    /* Sans cette seconde moitié, la page dirait « c'est gratuit » sans dire à
       quelles conditions cela peut cesser — la seule chose utile au lecteur. */
    expect(within(prix).getByText(/acceptation explicite/)).toBeInTheDocument()
  })

  it('nomment le bailleur responsable de traitement de ses locataires', async () => {
    await renderApp('/conditions-generales')
    const donnees = screen.getByRole('region', { name: /Vos données/ })
    expect(within(donnees).getByText(/responsable de traitement/)).toBeInTheDocument()
    expect(within(donnees).getByText(/sous-traitant/)).toBeInTheDocument()
  })

  it('renvoient aux deux autres pages juridiques', async () => {
    await renderApp('/conditions-generales')
    const objet = screen.getByRole('region', { name: 'Objet' })
    expect(within(objet).getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/mentions-legales',
    )
    const donnees = screen.getByRole('region', { name: /Vos données/ })
    expect(within(donnees).getByRole('link', { name: 'Confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite',
    )
  })

  it('sont atteignables depuis le pied de page public, dans les deux langues', async () => {
    for (const [locale, libelle] of [
      ['fr', 'Conditions'],
      ['en', 'Terms'],
    ] as const) {
      const { unmount } = await renderApp('/', { locale })
      expect(screen.getByRole('link', { name: libelle })).toHaveAttribute(
        'href',
        '/conditions-generales',
      )
      unmount()
    }
  })

  it('portent les mêmes rubriques en anglais', async () => {
    await renderApp('/conditions-generales', { locale: 'en' })
    for (const titre of [
      'Purpose',
      'The service',
      'Your account',
      'Price',
      'Your obligations',
      'Availability',
      'Liability',
      'Ownership',
      'Term, termination and erasure',
      'Suspension',
      'Changes to these terms',
      'Governing law and disputes',
    ]) {
      expect(screen.getByRole('heading', { name: titre, level: 2 })).toBeInTheDocument()
    }
  })
})
