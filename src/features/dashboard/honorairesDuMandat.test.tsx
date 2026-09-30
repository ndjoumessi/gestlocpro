import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { attendreLeChargement, renderApp, screen, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * LE BARÈME D'UN MANDATAIRE, SUR LA LIGNE DE SON MANDAT.
 *
 * ═══ CE QUE CES CAS GARDENT, ET CE QU'ILS NE PEUVENT PAS GARDER ═══
 *
 * Le calcul — les trois bases, le périmètre du gestionnaire visé, le net négatif
 * — vit côté serveur et y est éprouvé contre une vraie base
 * (`honorairesDeGestion.test.ts`). En démonstration, `parkId` est nul : aucun
 * relevé ne part, et il n'y a donc rien à additionner ici.
 *
 * Ce que ce fichier garde est ce que la boîte DIT, et trois choses s'y jouent :
 *
 *   1. ELLE NOMME SON SUJET. Le nom du gestionnaire est dans le TITRE, et non
 *      dans un `sr-only` posé en fin de boîte — première rédaction, corrigée :
 *      une modale qui ne nomme pas de qui elle parle laisse le lecteur deviner
 *      sur quelle ligne il a cliqué.
 *
 *   2. LES DEUX CHAMPS DE MONTANT S'EXCLUENT. Un taux ET un forfait affichés
 *      ensemble laisseraient croire qu'on peut cumuler, et le serveur refuse le
 *      corps qui en résulterait — un refus qu'on aurait fabriqué à l'écran.
 *
 *   3. SANS BARÈME, ELLE LE DIT. Un relevé qui ne retient rien est juste ; ce
 *      qui serait faux est de laisser lire un « 0 » comme un calcul.
 */
async function ouvrirLesHonoraires() {
  installerFauxServeur()
  await renderApp('/demo/acces', { largeur: 1280 })
  await screen.findByRole('heading', { level: 1 })
  await attendreLeChargement()
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: /^Honoraires et relevé — Diane Fotso$/ }),
  )
  return { user, boite: await screen.findByRole('dialog') }
}

describe('les honoraires d’un mandataire', () => {
  it('NOMMENT LEUR SUJET DANS LE TITRE, et pas dans un texte caché', async () => {
    const { boite } = await ouvrirLesHonoraires()
    /* Par le RÔLE et son nom accessible : un `getByText` passerait aussi sur un
       `sr-only`, c'est-à-dire exactement sur la version qu'on a corrigée. */
    expect(within(boite).getByRole('heading', { name: /Diane Fotso/ })).toBeInTheDocument()
  })

  it('N’OFFRENT JAMAIS UN TAUX ET UN FORFAIT EN MÊME TEMPS', async () => {
    const { user, boite } = await ouvrirLesHonoraires()

    /* Par défaut : un pourcentage. Le taux est là, le forfait n'est pas. */
    expect(within(boite).getByLabelText(/Taux/)).toBeInTheDocument()
    expect(within(boite).queryByLabelText(/Forfait/)).not.toBeInTheDocument()

    const base = within(boite).getByLabelText(/Base de calcul/)
    await user.click(base)
    await user.click(await screen.findByRole('option', { name: /Forfait mensuel/ }))

    /* Après bascule : l'inverse exactement. Sans la seconde moitié de cette
       assertion, le cas passerait sur une boîte qui affiche les deux. */
    expect(within(boite).getByLabelText(/Forfait/)).toBeInTheDocument()
    expect(within(boite).queryByLabelText(/Taux/)).not.toBeInTheDocument()
  })

  it('DISENT QU’AUCUN BARÈME N’EST CONVENU plutôt que d’afficher un zéro', async () => {
    const { boite } = await ouvrirLesHonoraires()
    /* Le relevé n'existe pas en démonstration — aucun parc à interroger. La
       boîte doit le DIRE : un « 0 FCFA d'honoraires » serait un calcul, et il
       n'y a pas eu de calcul. */
    expect(within(boite).getByText(/ne retient rien/)).toBeInTheDocument()
    expect(within(boite).queryByText(/Net à reverser/)).not.toBeInTheDocument()
  })
})
