import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent } from '@/test/render'
import { installerFauxServeur, type FauxServeur } from '@/test/api'

/**
 * « RENVOYER LE LIEN » DOIT RENVOYER LE LIEN.
 *
 * Le bouton faisait `setSent(false)` : il ramenait au formulaire, adresse
 * pré-remplie, et il fallait presser « Envoyer le lien » une seconde fois. Le
 * libellé est un impératif au singulier — il promet un envoi, pas un retour en
 * arrière. Même défaut que le « Nous contacter » de la grille de tarifs, dont
 * le seul geste promettait une conversation qui n'existait pas.
 *
 * ═══ POURQUOI COMPTER LES APPELS, ET NON REGARDER L'ÉCRAN ═══
 *
 * La version fautive et la version correcte se ressemblent : dans les deux cas
 * quelque chose se passe au clic. C'est le RÉSEAU qui les sépare — une seconde
 * demande part, ou elle ne part pas — et rien à l'écran ne le dit, puisque le
 * serveur rend le même 202 dans tous les cas. Un cas qui vérifierait un texte
 * ou un état visible passerait au vert sur les deux versions.
 *
 * ═══ CE QUE CES CAS NE GARDENT PAS ═══
 *
 * La géométrie de cet état. Il ne se rend qu'APRÈS une soumission, et le
 * balayage de `mesure-ui` ne soumet aucun formulaire : ni le contraste, ni les
 * cibles de 44 px, ni le débordement n'y sont mesurés. Le lien « ce n'est pas
 * la bonne adresse » porte `min-h-11` par discipline, pas par mesure.
 */

const ADRESSE = 'proprietaire@exemple.cm'

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('POST', '/auth/forgot', { status: 202, body: { ok: true } })
})

/** Amène l'écran à son état « demande envoyée », qui n'est atteignable qu'ainsi. */
async function demander(utilisateur: ReturnType<typeof userEvent.setup>) {
  await renderApp('/mot-de-passe-oublie')
  await utilisateur.type(screen.getByLabelText(/adresse e-mail/i), ADRESSE)
  await utilisateur.click(screen.getByRole('button', { name: /envoyer le lien/i }))
  await screen.findByRole('button', { name: /renvoyer le lien/i })
}

const demandes = (s: FauxServeur) =>
  s.appels.filter((a) => a.methode === 'POST' && a.chemin === '/auth/forgot')

describe('mot de passe oublié', () => {
  it('renvoie vraiment la demande, et à la même adresse', async () => {
    const utilisateur = userEvent.setup()
    await demander(utilisateur)
    expect(demandes(serveur), 'la première demande n’est pas partie').toHaveLength(1)

    await utilisateur.click(screen.getByRole('button', { name: /renvoyer le lien/i }))

    const vues = demandes(serveur)
    expect(vues, '« Renvoyer le lien » n’a émis aucune seconde demande').toHaveLength(2)
    /* À la MÊME adresse : un état vidé entre-temps enverrait une demande vide,
       ce qui compterait pour un appel sans rien renvoyer à personne. */
    expect(vues[1]!.corps).toMatchObject({ email: ADRESSE })
  })

  it('reste sur la confirmation après le renvoi', async () => {
    const utilisateur = userEvent.setup()
    await demander(utilisateur)
    await utilisateur.click(screen.getByRole('button', { name: /renvoyer le lien/i }))

    /* Le bouton est TOUJOURS là : renvoyer n'est pas revenir en arrière, et
       c'est très exactement la confusion que ce lot défait. */
    expect(screen.getByRole('button', { name: /renvoyer le lien/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument()
  })

  it('garde une sortie vers le formulaire, sans rien renvoyer', async () => {
    const utilisateur = userEvent.setup()
    await demander(utilisateur)

    await utilisateur.click(screen.getByRole('button', { name: /bonne adresse/i }))

    /* Le formulaire revient AVEC l'adresse : la sortie sert à corriger une faute
       de frappe, et tout retaper serait la punir. */
    const champ = screen.getByLabelText(/adresse e-mail/i)
    expect(champ).toHaveValue(ADRESSE)
    /* Et rien n'est reparti : cette sortie n'est pas un second envoi déguisé. */
    expect(demandes(serveur)).toHaveLength(1)
  })
})
