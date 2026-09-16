import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, screen, userEvent, waitFor, within } from '@/test/render'
import { COMPTE_FICTIF, installerFauxServeur, type FauxServeur } from '@/test/api'
import type { EtatSession } from '@/api/SessionProvider'
import { NATURES_DU_DOSSIER } from '@/data/dossier'

/**
 * MES DONNÉES — l'écran qui rend le droit à la portabilité.
 *
 * Ce que ces cas tiennent, et que la relecture ne tient pas :
 *
 *  1. TOUTE NATURE RENDUE PAR LE SERVEUR EST MONTRÉE. Un export qui perd une
 *     table en chemin est pire qu'absent : il fait croire qu'on tient tout.
 *     La liste est celle de `NATURES_DU_DOSSIER`, jamais recopiée ici.
 *  2. LE FICHIER PORTE LES LIGNES DU SERVEUR, avec ses noms de colonnes — c'est
 *     ce qui rend l'export vérifiable contre le dossier qu'il documente.
 *  3. SANS PARC, L'ÉCRAN LE DIT. Le geste rend `demonstration`, et une
 *     démonstration muette ferait croire à un dossier vide.
 */
const PARC = '11111111-2222-4333-8444-555555555555'

const SESSION: EtatSession = {
  statut: 'connecte',
  compte: COMPTE_FICTIF,
  adhesions: [{ parkId: PARC, role: 'owner', parkName: 'Parc de test', currency: 'XAF' }],
}

/** Le dossier tel que le serveur le rend : une ligne par nature, et deux baux. */
const DOSSIER = {
  exporteLe: '2026-09-16T08:00:00.000Z',
  role: 'owner',
  compte: { email: COMPTE_FICTIF.email, fullName: COMPTE_FICTIF.fullName },
  parc: { name: 'Parc de test', currency: 'XAF' },
  ...Object.fromEntries(NATURES_DU_DOSSIER.map((nature) => [nature, [{ id: `${nature}-1` }]])),
  baux: [
    { id: 'bail-1', unitId: 'u-1', rentMinor: 145000, status: 'active' },
    { id: 'bail-2', unitId: 'u-2', rentMinor: 110000, status: 'ended' },
  ],
}

let serveur: FauxServeur

beforeEach(() => {
  serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARC}/portfolio`, {
    status: 200,
    body: {
      collections: [],
      buildings: [],
      works: [],
      deposits: [],
      readings: [],
      inspections: [],
      notifications: [],
    },
  })
  serveur.quand('GET', `/parks/${PARC}/export`, { status: 200, body: DOSSIER })
  serveur.quand('POST', '/auth/me/closure', {
    status: 200,
    body: { effaceLe: '2026-10-16T08:00:00.000Z' },
  })
})

async function preparer(session: EtatSession = SESSION) {
  const user = userEvent.setup()
  await renderApp('/app/mes-donnees', { session })
  await user.click(screen.getByRole('button', { name: /préparer mon export/i }))
  return user
}

describe('l’écran « Mes données »', () => {
  it('montre chaque nature du dossier, avec son nombre de lignes', async () => {
    await preparer()

    const tableau = await screen.findByRole('table', { name: /mes données/i })
    /* UNE LIGNE PAR NATURE, comptée et non cherchée à l'œil : une nature ajoutée
       au serveur et oubliée par l'écran fait rougir ici, et une nature montrée
       deux fois aussi. L'en-tête est la ligne de plus. */
    expect(within(tableau).getAllByRole('row')).toHaveLength(NATURES_DU_DOSSIER.length + 1)
    const ligneDesBaux = within(tableau)
      .getAllByRole('row')
      .find((l) => /baux/i.test(l.textContent ?? ''))
    expect(ligneDesBaux, 'aucune ligne pour les baux').toBeDefined()
    /* Le compte vient du dossier, pas d'un nombre écrit à l'écran : deux baux,
       une ligne pour chacune des autres natures. */
    expect(within(ligneDesBaux!).getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /récapitulatif pdf/i })).toBeInTheDocument()
  })

  it('écrit dans le fichier les lignes du serveur, sous les noms du serveur', async () => {
    const user = await preparer()
    await screen.findByRole('table', { name: /mes données/i })

    /* Le téléchargement est le geste du navigateur : on capture ce que l'écran
       lui DONNE — un fichier ne se vérifie pas à l'œil. */
    const ecrits: string[] = []
    const creerUrl = vi.fn(() => 'blob:sonde')
    vi.stubGlobal('URL', { ...URL, createObjectURL: creerUrl, revokeObjectURL: vi.fn() })
    const blobDOrigine = globalThis.Blob
    vi.stubGlobal(
      'Blob',
      class extends blobDOrigine {
        constructor(parties: BlobPart[], options?: BlobPropertyBag) {
          super(parties, options)
          ecrits.push(parties.join(''))
        }
      },
    )

    const lignes = screen.getAllByRole('row')
    const ligneDesBaux = lignes.find((l) => /baux/i.test(l.textContent ?? ''))!
    await user.click(within(ligneDesBaux).getByRole('button', { name: /tableur/i }))

    await waitFor(() => expect(ecrits.length).toBeGreaterThan(0))
    const fichier = ecrits.join('\n')
    expect(fichier).toContain('rentMinor')
    expect(fichier).toContain('145000')
    expect(fichier).toContain('bail-2')
    vi.unstubAllGlobals()
  })

  it('dit que la démonstration ne tient aucun dossier', async () => {
    await preparer({ statut: 'connecte', compte: COMPTE_FICTIF, adhesions: [] })

    expect(await screen.findByText(/la démonstration ne tient aucun dossier/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /récapitulatif pdf/i })).not.toBeInTheDocument()
  })

  it('dit l’échec sans laisser croire à un dossier vide', async () => {
    serveur.quand('GET', `/parks/${PARC}/export`, { status: 500 })
    await preparer()

    expect(await screen.findByText(/n’a pas pu être préparé/i)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /mes données/i })).not.toBeInTheDocument()
  })
})

/**
 * LA FERMETURE DU COMPTE, sur le même écran que l'export — et c'est le point.
 *
 * Nelson a tranché le 2026-09-16 : « avertir et laisser exporter avant ». Le
 * bloc de fermeture ne peut donc pas exister avant que le dossier soit préparé,
 * faute de quoi l'avertissement ne chiffrerait rien.
 */
describe('la fermeture du compte', () => {
  it('ne s’offre pas avant que le dossier soit préparé', async () => {
    await renderApp('/app/mes-donnees', { session: SESSION })
    expect(screen.queryByRole('button', { name: /^Fermer mon compte$/ })).not.toBeInTheDocument()
  })

  it('chiffre ce qui disparaîtra, et attend une confirmation', async () => {
    const user = await preparer()
    await screen.findByRole('table', { name: /mes données/i })

    const bloc = screen.getByRole('region', { name: /fermer mon compte/i })
    /* Le nombre vient du dossier : seize natures d'une ligne, sauf les baux qui
       en portent deux. */
    const lignes = NATURES_DU_DOSSIER.length + 1
    expect(bloc.textContent).toContain(String(lignes))
    expect(bloc.textContent).toMatch(/30 jours/)

    const bouton = screen.getByRole('button', { name: /^Fermer mon compte$/ })
    expect(bouton).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /j’ai exporté mes données/i }))
    expect(bouton).toBeEnabled()
  })

  it('demande la fermeture au serveur, et quitte l’espace', async () => {
    const user = await preparer()
    await screen.findByRole('table', { name: /mes données/i })
    await user.click(screen.getByRole('checkbox', { name: /j’ai exporté mes données/i }))
    await user.click(screen.getByRole('button', { name: /^Fermer mon compte$/ }))

    await waitFor(() =>
      expect(serveur.appels.some((a) => a.methode === 'POST' && a.chemin === '/auth/me/closure')).toBe(
        true,
      ),
    )
    /* L'espace applicatif n'existe plus pour ce compte : l'écran ne doit pas y
       rester à faire semblant. */
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Fermer mon compte$/ })).not.toBeInTheDocument(),
    )
    /* ET LA DATE SUIT LA PERSONNE. La fermeture coupe la session : sans cette
       note sur l'écran de connexion, le geste le plus grave du produit se
       terminerait par un silence, et personne ne saurait jusqu'à quand se
       raviser. La date est celle du SERVEUR, relayée. */
    /* La date est celle que le serveur a rendue, mise en forme par le produit —
       « 16/10/2026 » dans la région du cas, et non une chaîne recopiée ici. */
    expect(await screen.findByText(/16\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/reconnectez-vous/i)).toBeInTheDocument()
  })

})
