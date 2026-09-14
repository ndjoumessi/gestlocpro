import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderApp, screen } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LA CASE DE L'INSCRIPTION NE FAIT PLUS ACCEPTER UN DOCUMENT ABSENT.
 *
 * Elle disait « J'accepte les conditions générales et la politique de
 * confidentialité », obligatoire, sans lien. Les conditions générales n'existent
 * pas ; la politique existe depuis 6acfd05. Nelson a choisi le 2026-09-14 de
 * retirer les conditions générales de la case jusqu'à ce qu'elles existent, et
 * de faire confirmer la LECTURE de la politique — on s'informe d'une politique
 * de confidentialité, on ne l'accepte pas.
 */
async function allerAuRecapitulatif(user: ReturnType<typeof userEvent.setup>) {
  installerFauxServeur()
  await renderApp('/inscription/proprietaire')
  await user.type(screen.getByLabelText(/nom complet/i), 'Arsène Nkomo')
  await user.type(screen.getByLabelText(/adresse e-mail/i), 'arsene@example.com')
  await user.type(screen.getByLabelText(/^téléphone/i), '677889900')
  await user.type(screen.getByLabelText(/^Mot de passe/), 'Bonamoussadi2026!')
  await user.click(screen.getByRole('button', { name: /continuer/i }))
  const pays = await screen.findByLabelText(/^pays/i)
  await user.click(pays)
  await user.type(pays, 'camer')
  await user.click(screen.getByRole('option', { name: 'Cameroun' }))
  await user.type(screen.getByLabelText(/nom de votre parc/i), 'Parc Bonamoussadi')
  await user.click(screen.getByRole('button', { name: /continuer/i }))
  await screen.findByRole('heading', { name: /tout est correct/i })
}

describe('la case de confidentialité de l’inscription', () => {
  it('fait confirmer la lecture de la politique, et ne cite plus de conditions générales', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    const cases = screen.getAllByRole('checkbox')
    const obligatoire = screen.getByRole('checkbox', { name: /^J’ai lu la politique de confidentialité/ })
    expect(cases).toContain(obligatoire)
    for (const c of cases) {
      expect(c.closest('label')?.textContent).not.toMatch(/conditions générales/i)
    }
  })

  /* Le lien ouvre un NOUVEL ONGLET, et le dit : l'inscription est au dernier
     écran d'un assistant en trois étapes, et naviguer sur place jetterait tout
     ce qui a été saisi.

     CE QUE CE CAS NE TIENT PAS : que cliquer le lien ne coche pas la case. La
     spécification HTML le garantit — un contenu interactif dans un `<label>` ne
     l'active pas —, et Chromium le fait, mesuré le 2026-09-14 sur la même
     structure. jsdom, lui, COCHE la case : l'assertion rougissait sur un défaut
     de l'environnement de test, pas du produit. Elle est retirée plutôt que
     retournée, pour ne pas figer le comportement de jsdom. */
  it('mène à la politique dans un nouvel onglet', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    const lien = screen.getByRole('link', { name: /politique de confidentialité/i })
    expect(lien).toHaveAttribute('href', '/confidentialite')
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien.getAttribute('rel')).toMatch(/noopener/)
    expect(lien).toHaveTextContent(/nouvel onglet/)
  })

  it('refuse la création tant que la lecture n’est pas confirmée, et dit laquelle', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))
    const alertes = await screen.findAllByRole('alert')
    expect(alertes.length).toBeGreaterThan(0)
    expect(alertes.every((a) => /politique de confidentialité/i.test(a.textContent ?? ''))).toBe(true)
  })
})

/**
 * LA CASE DE LA LETTRE D'INFORMATION NE PROMET PAS UN RYTHME QUE RIEN NE TIENT.
 *
 * Elle disait « une fois par trimestre ». Aucune lettre n'existe et rien ne
 * l'envoie — la politique de confidentialité le dit. Nelson a choisi le
 * 2026-09-14 de garder la case et le choix enregistré, et de retirer la promesse.
 */
describe('la case de la lettre d’information', () => {
  it('ne promet aucun rythme d’envoi, et garde ce qui est vrai', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    const lettre = screen.getByRole('checkbox', { name: /nouveautés produit/i })
    const libelle = lettre.closest('label')?.textContent ?? ''
    expect(libelle).not.toMatch(/trimestre|mois|mensuel|semaine|hebdomadaire|par an|annuel/i)
    expect(libelle).toMatch(/sans revente de données/)
  })
})
