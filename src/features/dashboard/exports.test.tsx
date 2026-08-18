import { afterEach, describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent, within } from '@/test/render'
import { captureDownloads } from '@/test/downloads'
import { UTF8_BOM } from '@/lib/csv'
import { DEMO_TENANT_UNIT, UNITS } from '@/data/portfolio'

/**
 * Les contrôles d'export produisent réellement un fichier.
 *
 * Trois boutons « Exporter le relevé » appelaient `notify(t('app.exported'))`
 * et rien d'autre : le toast annonçait « Relevé du mois exporté (PDF + CSV) »
 * alors qu'aucun `Blob` n'existait dans tout `src/`. Six boutons « Télécharger »
 * du côté locataire n'avaient ni `onClick` ni `href`.
 *
 * Ces tests portent donc sur le FICHIER — son nom, son contenu, son encodage —
 * et non sur le toast. Vérifier le message aurait laissé passer le défaut
 * d'origine tel quel.
 */

let capture: ReturnType<typeof captureDownloads> | null = null

afterEach(() => {
  capture?.restore()
  capture = null
})

/** Clique un bouton et rend le fichier qu'il a produit. */
async function exporter(label: RegExp | string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: label }))
  const files = await capture!.settle()
  expect(files).toHaveLength(1)
  return files[0]
}

describe('export des paiements', () => {
  it('produit un fichier CSV nommé, daté et encodé pour Excel', async () => {
    capture = captureDownloads()
    renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)

    expect(file.name).toMatch(/^gestlocpro-paiements-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(file.type).toContain('text/csv')
    // Sans BOM, « Deïdo » et « Réglé » arrivent illisibles dans Excel. On le
    // vérifie sur les OCTETS : c'est ce que le tableur lira.
    expect(file.text.startsWith(UTF8_BOM)).toBe(true)
    expect([...file.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('exporte les lignes affichées, en-têtes traduits compris', async () => {
    capture = captureDownloads()
    renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)
    const [entetes, ...lignes] = file.text.replace(UTF8_BOM, '').trim().split('\r\n')

    // La devise est nommée une fois par colonne, pas mille fois dans les
    // cellules : c'est ce qui rend la colonne sommable par un tableur.
    expect(entetes).toBe(
      'Unité;Locataire;Dû (FCFA);Réglé (FCFA);Solde (FCFA);Statut;Jours de retard',
    )
    // Dix baux : les deux unités vacantes du parc n'en sont pas.
    expect(lignes).toHaveLength(UNITS.filter((u) => u.status !== 'vacant').length)
    expect(file.text).toContain('Charles Ngassa')
  })

  it('suit le filtre de statut, et le dit dans le nom du fichier', async () => {
    capture = captureDownloads()
    renderApp('/app/paiements')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /En retard/ }))
    const file = await exporter(/Exporter le relevé/)

    expect(file.name).toMatch(/^gestlocpro-paiements-en-retard-/)
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n').slice(1)
    expect(lignes).toHaveLength(UNITS.filter((u) => u.status === 'overdue').length)
    expect(file.text).not.toContain('Charles Ngassa')
  })

  it('n’exporte que son propre bail au locataire', async () => {
    // Le périmètre du rôle vaut pour le fichier autant que pour l'écran : un
    // export qui repartirait de la source aurait sorti tout le parc.
    capture = captureDownloads()
    renderApp('/demo/paiements')
    await switchRole('tenant')
    await attendreLeChargement()

    const file = await exporter(/Exporter le relevé/)
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n').slice(1)

    expect(lignes).toHaveLength(1)
    expect(lignes[0].startsWith(DEMO_TENANT_UNIT)).toBe(true)
    for (const autre of UNITS.filter((u) => u.tenant && u.id !== DEMO_TENANT_UNIT)) {
      expect(file.text).not.toContain(autre.tenant as string)
    }
  })

  it('n’annonce le fichier qu’une fois celui-ci produit', async () => {
    capture = captureDownloads()
    renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)

    // Le toast nomme le fichier : l'utilisateur sait quoi chercher dans son
    // dossier de téléchargements, et le message ne peut plus être vrai sans
    // qu'un fichier existe.
    expect(await screen.findByText(new RegExp(file.name))).toBeInTheDocument()
    expect(screen.queryByText(/PDF/)).not.toBeInTheDocument()
  })
})

describe('export selon la langue', () => {
  it('sépare par des virgules en anglais', async () => {
    capture = captureDownloads()
    renderApp('/app/paiements', { locale: 'en' })

    const file = await exporter(/Export statement/)
    const [entetes] = file.text.replace(UTF8_BOM, '').split('\r\n')

    expect(entetes).toBe(
      'Unit,Tenant,Due (FCFA),Paid (FCFA),Balance (FCFA),Status,Days late',
    )
    expect(file.name).toMatch(/^gestlocpro-payments-/)
  })

  it('sépare par des points-virgules en français', async () => {
    // Excel FR lit la virgule comme séparateur décimal : un fichier virgulé y
    // arrive tout entier dans la colonne A.
    capture = captureDownloads()
    renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)
    expect(file.text.split('\r\n')[0]).toContain(';')
  })
})

describe('export des relevés de compteurs', () => {
  it('porte les index, la consommation et le montant refacturé', async () => {
    capture = captureDownloads()
    renderApp('/app/releves')

    const file = await exporter(/Exporter le relevé/)
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n')

    expect(file.name).toMatch(/^gestlocpro-releves-compteurs-/)
    expect(lignes[0]).toContain('Eau · Index précédent')
    expect(lignes[0]).toContain('(kWh)')
    // A1 : 342 → 358 d'eau, soit 16 m³, et 4 120 → 4 298 kWh, soit 178.
    expect(lignes[1]).toContain('16')
    expect(lignes[1]).toContain('178')
    /**
     * A5 n'a pas été relevée : la cellule reste VIDE.
     *
     * Elle portait « Relevé manquant ». C'était juste tant que la colonne était
     * du texte ; elle porte maintenant un montant calculable, et un mot au
     * milieu d'une colonne de nombres la rend non sommable — le défaut même
     * qu'on corrige. Le manque reste lisible : les trois cellules de
     * consommation de la ligne sont vides elles aussi.
     */
    expect(file.text).not.toContain('Relevé manquant')
    const ligneA5 = lignes.find((l) => l.startsWith('A5'))
    expect(ligneA5).toBe('A5;Aline Tchoumi;176;;;2140;;;;')
  })
})

describe('export du tableau de bord', () => {
  it('exporte les douze mois d’encaissements du graphique', async () => {
    capture = captureDownloads()
    renderApp('/app')

    const file = await exporter(/Exporter le relevé/)
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n')

    expect(file.name).toMatch(/^gestlocpro-encaissements-/)
    expect(lignes[0]).toBe('Période;Loyer (FCFA);Eau (FCFA);Électricité (FCFA);Total (FCFA)')
    expect(lignes).toHaveLength(13)
  })
})

describe('quittances du locataire', () => {
  it('télécharge la quittance de la période, nommée par son mois', async () => {
    capture = captureDownloads()
    renderApp('/demo')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    const [premier] = screen.getAllByRole('button', { name: /Télécharger/ })
    await user.click(premier)
    const [file] = await capture.settle()

    // Le mois de la quittance, pas le jour du téléchargement : c'est la période
    // qui identifie le document.
    expect(file.name).toBe('gestlocpro-quittance-a1-2026-08.csv')
    expect(file.text).toContain('Août 2026')
    expect(file.text).toContain('Charles Ngassa')
    expect(file.text).toContain('Résidence Bonamoussadi')
  })

  it('donne un fichier distinct à chaque période', async () => {
    capture = captureDownloads()
    renderApp('/demo')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    const boutons = screen.getAllByRole('button', { name: /Télécharger/ })
    expect(boutons).toHaveLength(6)

    await user.click(boutons[0])
    await user.click(boutons[1])
    const files = await capture.settle()

    expect(files.map((f) => f.name)).toEqual([
      'gestlocpro-quittance-a1-2026-08.csv',
      'gestlocpro-quittance-a1-2026-07.csv',
    ])
  })
})

describe('portail locataire', () => {
  it('télécharge la quittance depuis « Mon espace »', async () => {
    // Les paiements n'ont plus d'onglet : ils sont une carte de « Mon espace »,
    // qui est l'onglet ouvert d'emblée. Le locataire atteint donc sa quittance
    // sans un seul clic de navigation — c'est tout l'objet du passage à trois
    // onglets, et ce test le mesure.
    capture = captureDownloads()
    renderApp('/demo/portail')

    const user = userEvent.setup()
    // Quatre périodes, donc quatre boutons de même nom : on prend le premier,
    // comme le ferait un locataire cherchant sa quittance la plus récente.
    const [premier] = screen.getAllByRole('button', { name: /Télécharger la quittance/ })
    await user.click(premier)
    const [file] = await capture.settle()

    expect(file.name).toBe('gestlocpro-quittance-a1-2026-08.csv')
  })

  it('dit la vérité sur les documents qu’il n’a pas', async () => {
    // Bail signé, état des lieux et attestation d'assurance n'existent nulle
    // part dans le produit : leur bouton « Télécharger » ne pouvait produire
    // qu'un faux fichier. On affiche l'état de la case à la place.
    capture = captureDownloads()
    renderApp('/demo/portail')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Documents' }))

    const lignes = screen.getAllByRole('listitem')
    const sansDocument = lignes.filter((li) =>
      within(li).queryByText('Aucun document déposé'),
    )
    expect(sansDocument).toHaveLength(3)
    // Aucun bouton mort ne subsiste : seule la quittance, qui a une donnée
    // derrière elle, garde le sien.
    expect(screen.getAllByRole('button', { name: /Télécharger la quittance/ })).toHaveLength(1)
  })
})
