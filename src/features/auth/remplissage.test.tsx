import { describe, expect, it } from 'vitest'
import { SESSION_ANONYME, renderApp, screen } from '@/test/render'

/**
 * Le remplissage automatique doit être NOMMÉ, champ par champ.
 *
 * Ces jetons ne sont pas décoratifs : ce sont eux qui font proposer un mot de
 * passe fort à l'inscription et le mot de passe enregistré à la connexion, et
 * qui font remplir un numéro depuis le carnet d'adresses.
 *
 * L'indicatif manquait. Sans `tel-country-code`, le navigateur remplit le
 * numéro et laisse l'indicatif tel quel : un Camerounais dont le carnet porte
 * « 677 21 44 08 » se retrouve avec « +33 677 21 44 08 » — un numéro français
 * qui n'existe pas. Les deux champs ne se remplissent correctement que nommés
 * ensemble.
 */
describe('remplissage automatique', () => {
  it('nomme chaque champ de l’inscription', async () => {
    await renderApp('/inscription/proprietaire')
    await screen.findByRole('heading', { level: 1 })

    const jeton = (libelle: RegExp) =>
      screen.getByLabelText(libelle).getAttribute('autocomplete')

    expect(jeton(/nom complet/i)).toBe('name')
    expect(jeton(/adresse e-mail/i)).toBe('email')
    expect(jeton(/^téléphone/i)).toBe('tel-national')
    // Le couple : l'indicatif et le numéro se remplissent ensemble ou mal.
    expect(jeton(/indicatif/i)).toBe('tel-country-code')
    expect(jeton(/^Mot de passe/)).toBe('new-password')
  })

  it('distingue le mot de passe créé de celui qu’on rappelle', async () => {
    /**
     * `new-password` à l'inscription, `current-password` à la connexion.
     *
     * C'est cette distinction qui fait PROPOSER un mot de passe fort d'un côté
     * et RAPPELER celui enregistré de l'autre. Les confondre fait remplir
     * l'inscription avec un ancien mot de passe, ou refuser d'enregistrer le
     * nouveau.
     */
    await renderApp('/connexion', { session: SESSION_ANONYME })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByLabelText(/^Mot de passe/).getAttribute('autocomplete')).toBe(
      'current-password',
    )
  })
})
