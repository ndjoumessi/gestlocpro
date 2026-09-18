import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderApp, screen } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LA CASE DE L'INSCRIPTION CITE LES DEUX DOCUMENTS, ET LES DEUX EXISTENT.
 *
 * ═══ SON HISTOIRE, PARCE QU'ELLE EXPLIQUE SA FORME ═══
 *
 * Elle disait « J'accepte les conditions générales et la politique de
 * confidentialité », obligatoire, SANS LIEN — et les conditions générales
 * n'existaient pas. `efd8654` les a retirées le 2026-09-14 plutôt que de faire
 * accepter un document absent, en notant qu'elles « reviendront dans cette case
 * le jour où elles existeront ». `51daf49` les a publiées le 2026-09-18 ; elles
 * reviennent donc ici.
 *
 * ═══ DEUX VERBES, ET CE N'EST PAS UNE COQUETTERIE ═══
 *
 * On ACCEPTE des conditions générales : elles engagent, et c'est un contrat. On
 * LIT une politique de confidentialité : elle informe, et rien ne s'y signe. La
 * case porte donc les deux verbes plutôt qu'un seul, et le registre du
 * consentement enregistre `acceptedTermsReadPrivacy` — une valeur qui dit les
 * deux gestes, et non « l'utilisateur a coché ».
 *
 * ═══ CE QUE CES CAS TIENNENT ═══
 *
 * Que la case cite les DEUX documents, que chacun soit ATTEIGNABLE par son
 * propre lien, et que le refus nomme les deux. Sans le dernier, un utilisateur
 * qui ne coche pas lirait un reproche à moitié.
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

describe('la case légale de l’inscription', () => {
  it('fait ACCEPTER les conditions et CONFIRMER la lecture de la politique', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    /* LE NOM ACCESSIBLE PORTE DEUX FOIS « (s'ouvre dans un nouvel onglet) », une
       par lien : la recherche ne peut donc pas exiger la phrase d'un seul
       tenant. Ce n'est pas un défaut — chaque lien doit annoncer ce qu'il fait —
       et c'est précisément pourquoi les deux moitiés sont vérifiées séparément
       plus bas. */
    const obligatoire = screen.getByRole('checkbox', {
      name: /J’accepte les conditions générales/,
    })
    expect(screen.getAllByRole('checkbox')).toContain(obligatoire)
    /* LES DEUX VERBES, ET DANS CET ORDRE. Un libellé qui dirait « j'accepte »
       des deux ferait signer une politique qui ne se signe pas ; un libellé qui
       dirait « j'ai lu » des deux ne ferait accepter aucun contrat. */
    const libelle = obligatoire.closest('label')?.textContent ?? ''
    expect(libelle).toMatch(/J’accepte les conditions générales/)
    expect(libelle).toMatch(/j’ai lu la politique de confidentialité/)
  })

  it('mène aux conditions générales par leur propre lien', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    /* DEUX DOCUMENTS, DEUX LIENS. Un seul lien vers une page qui renverrait à
       l'autre ferait dépendre l'accès à un contrat d'un clic de plus, sur une
       case qu'on ne peut pas décocher après coup. */
    const lien = screen.getByRole('link', { name: /conditions générales/i })
    expect(lien).toHaveAttribute('href', '/conditions-generales')
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien.getAttribute('rel')).toMatch(/noopener/)
    expect(lien).toHaveTextContent(/nouvel onglet/)
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

  it('refuse la création tant que la case n’est pas cochée, et nomme les DEUX documents', async () => {
    const user = userEvent.setup()
    await allerAuRecapitulatif(user)

    await user.click(screen.getByRole('button', { name: /créer mon espace/i }))
    const alertes = await screen.findAllByRole('alert')
    expect(alertes.length).toBeGreaterThan(0)
    /* Un refus qui ne citerait que la politique laisserait croire que les
       conditions, elles, étaient facultatives. */
    expect(alertes.every((a) => /conditions générales/i.test(a.textContent ?? ''))).toBe(true)
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
