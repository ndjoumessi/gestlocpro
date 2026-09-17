import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { EDITEUR } from '@/legal/editeur'

/**
 * LES MENTIONS LÉGALES, VUES DE L'ÉCRAN.
 *
 * La page ne dit que ce que l'attestation d'immatriculation établit. Ces cas
 * tiennent les deux moitiés de cette promesse : ce qui est établi SE LIT, et ce
 * qui manque ne s'invente pas.
 */
describe('les mentions légales', () => {
  it('nomment l’éditeur, son adresse et son registre, tels que l’attestation les donne', async () => {
    await renderApp('/mentions-legales')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mentions légales')
    const editeur = screen.getByRole('region', { name: 'Éditeur' })
    const valeur = (libelle: string) =>
      within(editeur).getByText(libelle).closest('div')?.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim()

    /* Pour un entrepreneur individuel, la dénomination est le nom de la
       personne : la première version écrivait « DJOUMESSI » seul. */
    expect(valeur('Nom')).toBe('Romel Djoumessi')
    expect(valeur('Forme juridique')).toBe('Entrepreneur individuel')
    /* LE RÉGIME EST UNE LIGNE À PART, et la forme n'a pas bougé. Nelson a
       répondu « micro-entreprise » à la question de la forme juridique le
       2026-09-17 : c'est un RÉGIME fiscal et social, pas une forme — celle du
       registre reste « Entrepreneur individuel ». Les fondre ferait écrire à une
       page légale une chose que l'annuaire des entreprises dément. */
    expect(valeur('Régime')).toBe('Micro-entreprise')
    /* LE NOM COMMERCIAL, donné le même jour : le produit s'appelle GestLocPro,
       la personne s'appelle Romel Djoumessi, et une mention légale doit porter
       les deux — sans quoi un visiteur ne peut pas relier le site qu'il lit à
       l'entreprise qui le publie. */
    expect(valeur('Nom commercial')).toBe('GestLocPro')
    expect(valeur('SIREN')).toBe('109 761 023')
    expect(valeur('SIRET du siège')).toBe('109 761 023 00018')
    expect(valeur('Code APE')).toBe('6201Z')
    /* Franchise en base, déclarée par Nelson le 2026-09-13 : pas de numéro de TVA
       à afficher, et la page dit pourquoi plutôt que de se taire. */
    expect(valeur('TVA')).toBe('Non applicable, article 293 B du CGI')
    expect(valeur('Directeur de la publication')).toBe('Romel Djoumessi')
    expect(valeur('Nature de l’établissement')).toBe('Libérale non réglementée')
    expect(valeur('Activité principale')).toBe('Programmation informatique')
    /* L'adresse est trois lignes, qu'on lit une à une : leur texte bout à bout
       les colle sans espace. */
    for (const ligne of ['71 rue de Rome', '13001 Marseille', 'France']) {
      expect(within(editeur).getByText(ligne)).toBeInTheDocument()
    }
    expect(within(editeur).getByText('Registre national des entreprises')).toBeInTheDocument()
    /* 10/09 et non 10/10 : `DateParts` compte les mois à partir de zéro, et la
       première écriture du module s'était trompée d'un mois. */
    expect(within(editeur).getByText('Inscription à jour au 10/09/2026')).toBeInTheDocument()
  })

  /**
   * L'HÉBERGEUR, TEL QUE SON CONTRAT LE NOMME — et joignable d'un geste.
   */
  it('nomment l’hébergeur, son adresse, son téléphone et son courriel', async () => {
    await renderApp('/mentions-legales')
    const hebergement = screen.getByRole('region', { name: 'Hébergement' })

    expect(within(hebergement).getByText('Railway Corporation')).toBeInTheDocument()
    for (const ligne of ['548 Market St Suite 68956', 'San Francisco, California 94104']) {
      expect(within(hebergement).getByText(ligne)).toBeInTheDocument()
    }
    expect(within(hebergement).getByRole('link', { name: '+1 (415) 707-7675' })).toHaveAttribute(
      'href',
      'tel:+14157077675',
    )
    expect(within(hebergement).getByRole('link', { name: 'team@railway.com' })).toHaveAttribute(
      'href',
      'mailto:team@railway.com',
    )
  })

  /**
   * L'ÉDITEUR JOIGNABLE D'UN GESTE.
   *
   * Le téléphone et l'adresse électronique manquaient : des CHOIX, que Nelson a
   * faits le 2026-09-14. Ils sont rendus en liens, comme ceux de l'hébergeur.
   * Et aucun « à compléter » ne subsiste sur la page.
   */
  it('donnent le téléphone et le courriel de l’éditeur, et rien d’inachevé', async () => {
    await renderApp('/mentions-legales')
    const editeur = screen.getByRole('region', { name: 'Éditeur' })

    expect(within(editeur).getByRole('link', { name: '+33 6 61 75 19 23' })).toHaveAttribute(
      'href',
      'tel:+33661751923',
    )
    expect(within(editeur).getByRole('link', { name: 'romel.djoumessi@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:romel.djoumessi@gmail.com',
    )
    /* Les coordonnées de l'hébergeur restent chez l'hébergeur : aucune ne doit
       être recopiée dans le bloc de l'éditeur. */
    expect(editeur.textContent).not.toMatch(/railway|415/i)

    const main = screen.getByRole('main')
    for (const absent of [/compl[ée]ter/i, /à venir/i]) {
      expect(main.textContent, `la page affiche ${absent}`).not.toMatch(absent)
    }
  })

  /* LES VALEURS DU REGISTRE NE SE TRADUISENT PAS, et le disent au lecteur d'écran. */
  it('gardent en anglais les valeurs du registre en français, et les déclarent telles', async () => {
    await renderApp('/mentions-legales', { locale: 'en' })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legal notice')
    const editeur = screen.getByRole('region', { name: 'Publisher' })
    const nature = within(editeur).getByText(EDITEUR.nature)
    expect(nature.closest('[lang]')).toHaveAttribute('lang', 'fr')
    /* Une citation du code général des impôts ne se traduit pas davantage. */
    expect(within(editeur).getByText(EDITEUR.tva).closest('[lang]')).toHaveAttribute('lang', 'fr')
    /* La date suit la langue de l'interface ; ce cas n'en fige pas le format,
       seulement qu'elle est dite, et en anglais. */
    expect(within(editeur).getByText(/^Entry up to date as of .*2026$/)).toBeInTheDocument()
  })

  it('s’ouvrent depuis le pied de la vitrine, par un lien qui tient son libellé', async () => {
    await renderApp('/')

    const pied = screen.getByRole('contentinfo')
    await userEvent.setup().click(within(pied).getByRole('link', { name: 'Mentions légales' }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mentions légales')
  })
})
