import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { EDITEUR, MENTIONS_A_COMPLETER } from '@/legal/editeur'

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
    expect(valeur('SIREN')).toBe('109 761 023')
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
   * RIEN DE CE QUI N'A PAS ÉTÉ ÉTABLI.
   *
   * Le téléphone et l'adresse électronique de l'ÉDITEUR sont des choix, pas des
   * faits : Nelson les a laissés manquants le 2026-09-12. La page n'en affiche
   * aucun, et surtout aucun « à compléter » sous les yeux d'un visiteur. La liste
   * est ÉCRITE ici plutôt que relue du module : la combler devra toucher ce cas.
   * L'hébergeur, le SIREN et le directeur de la publication en sont sortis le même
   * jour, établis par leurs sources.
   */
  it('n’affichent rien de ce qui n’a pas été établi, et le disent au code', async () => {
    expect([...MENTIONS_A_COMPLETER]).toEqual(['telephone', 'courriel'])

    await renderApp('/mentions-legales')
    const main = screen.getByRole('main')
    /* Un numéro de TVA intracommunautaire — `FR91109761023` se calcule du SIREN —
       n'a rien à faire sur la page d'une entreprise en franchise en base. */
    for (const absent of [/SIRET/i, /compl[ée]ter/i, /à venir/i, /FR\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{3}/, /intracommunautaire/i]) {
      expect(main.textContent, `la page affiche ${absent}, qui n’a pas été établi`).not.toMatch(absent)
    }
    /* Le téléphone et le courriel de l'ÉDITEUR : ceux de la page appartiennent
       tous à l'hébergeur. */
    const editeur = screen.getByRole('region', { name: 'Éditeur' })
    expect(within(editeur).queryAllByRole('link')).toHaveLength(0)
    expect(editeur.textContent).not.toMatch(/@|\+\d/)
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
