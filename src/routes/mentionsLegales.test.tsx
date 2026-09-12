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

    expect(valeur('Dénomination')).toBe('DJOUMESSI')
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
   * RIEN DE CE QUE L'ATTESTATION NE PORTE PAS.
   *
   * Le numéro SIREN, un téléphone, une adresse électronique, le directeur de la
   * publication et l'hébergeur manquent au document : la page n'en affiche aucun,
   * et surtout aucun « à compléter » sous les yeux d'un visiteur. La liste est
   * ÉCRITE ici plutôt que relue du module : la combler devra toucher ce cas, et le
   * diff le montrera.
   */
  it('n’affichent rien de ce que l’attestation ne porte pas, et le disent au code', async () => {
    expect([...MENTIONS_A_COMPLETER]).toEqual([
      'siren',
      'telephone',
      'courriel',
      'directeurDeLaPublication',
      'hebergeur',
    ])

    await renderApp('/mentions-legales')
    const main = screen.getByRole('main')
    for (const absent of [/SIREN/i, /SIRET/i, /t[ée]l[ée]phone/i, /directeur/i, /h[ée]berg/i, /compl[ée]ter/i, /@/]) {
      expect(main.textContent, `la page affiche ${absent}, que l’attestation ne porte pas`).not.toMatch(absent)
    }
  })

  /* LES VALEURS DU REGISTRE NE SE TRADUISENT PAS, et le disent au lecteur d'écran. */
  it('gardent en anglais les valeurs du registre en français, et les déclarent telles', async () => {
    await renderApp('/mentions-legales', { locale: 'en' })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legal notice')
    const editeur = screen.getByRole('region', { name: 'Publisher' })
    const nature = within(editeur).getByText(EDITEUR.nature)
    expect(nature.closest('[lang]')).toHaveAttribute('lang', 'fr')
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
