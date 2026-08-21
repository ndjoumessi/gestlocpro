import { afterEach, describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent } from '@/test/render'
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
      // « Solde CUMULÉ » et non « Solde » : l'en-tête suit la colonne du
      // tableau, qui montre l'arriéré depuis le début du bail. L'export disait
      // « Solde » en écrivant l'écart du mois — deux chiffres qui divergent de
      // tout l'arriéré sur un locataire en retard, et c'est le fichier qui sert
      // à réclamer.
      'Unité;Locataire;Dû (FCFA);Réglé (FCFA);Solde cumulé (FCFA);Statut;Jours de retard',
    )
    // Dix baux : les deux unités vacantes du parc n'en sont pas.
    expect(lignes).toHaveLength(UNITS.filter((u) => u.status !== 'vacant').length)
    expect(file.text).toContain('Charles Ngassa')

    /*
      LA VALEUR, ET PAS SEULEMENT L'EN-TÊTE.

      L'export écrivait l'écart du MOIS sous un en-tête qui promettait le cumul,
      et rien ne le voyait : les cas de ce fichier ne comparaient que les
      libellés. Sur un locataire en retard de plusieurs mois, les deux chiffres
      divergent de tout l'arriéré — et c'est le fichier exporté qui sert à
      réclamer.

      On lit donc la colonne dans le tableau RENDU et on exige que le fichier
      porte le même nombre. Comparer l'export à un calcul refait ici ne
      prouverait rien : les deux pourraient se tromper ensemble.
      */
    const cumulAffiche = screen
      .getAllByRole('row')
      .map((r) => r.textContent ?? '')
      .find((texte) => texte.includes('A3'))
    expect(cumulAffiche).toBeDefined()

    const ligneA3 = lignes.find((l) => l.startsWith('A3'))
    expect(ligneA3).toBeDefined()
    const soldeExporte = ligneA3!.split(';')[4]
    // Le montant exporté est brut (sans espaces de milliers) ; on le retrouve
    // dans la cellule affichée, qui les porte.
    expect(cumulAffiche!.replace(/[\s\u202f\u00a0]/g, '')).toContain(soldeExporte)
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
      'Unit,Tenant,Due (FCFA),Paid (FCFA),Running balance (FCFA),Status,Days late',
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

/**
 * L'export CSV des quittances a quitté « Mon espace » pour « Documents ».
 *
 * L'espace en offrait DEUX chemins pour le même document : une carte qui
 * ouvrait la modale — laquelle rend les montants du REGISTRE — et une liste qui
 * téléchargeait un CSV recomposé côté client. Deux vérités pour une seule
 * quittance. L'espace ne garde que la modale ; le CSV, qui est un export et non
 * un document opposable, vit là où le locataire vient chercher ses pièces.
 */
describe('quittances du locataire', () => {
  it('télécharge la quittance de la période, nommée par son mois', async () => {
    capture = captureDownloads()
    renderApp('/demo/documents')
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
    renderApp('/demo/documents')
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

/*
 * « portail locataire » vivait ici, et c'était un DOUBLON avéré : « quittances
 * du locataire », juste au-dessus, mesure le même export sous le même nom de
 * fichier. Quant à « Aucun document déposé », il est gardé par
 * `donneesReellesDuLocataire` et `coquilleLocataire` — et la liste de documents
 * qu'il interrogeait était celle de la copie, que le portail n'entretient plus.
 */

/**
 * LA RÉFÉRENCE DE L'OPÉRATEUR, dans le fichier que le locataire garde.
 *
 * Elle était saisie à l'encaissement, écrite en base, et absente du `select` de
 * la lecture : le bailleur tapait « MM-4471 » et personne ne le revoyait. Sans
 * elle, l'export demande au locataire de croire sur parole un encaissement
 * qu'il ne peut pas retrouver chez son opérateur — c'est avec cette chaîne
 * qu'il conteste.
 *
 * Le lot qui l'a rétablie l'avait ajoutée SANS ce cas, et la mutation l'a dit :
 * remplacer la colonne par `null` ne faisait rougir personne. Le commentaire
 * posé au-dessus de la ligne désignait pourtant cette colonne comme la raison
 * d'être du travail.
 */
describe('la référence dans l’export du locataire', () => {
  /** Le fichier « Tout télécharger » : les six périodes en un seul CSV. */
  async function historique() {
    capture = captureDownloads()
    renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()
    return exporter(/Tout télécharger/)
  }

  it('nomme la colonne et y porte la référence du versement', async () => {
    const file = await historique()
    const [entetes, ...lignes] = file.text.replace(UTF8_BOM, '').trim().split('\r\n')

    // La colonne est la DERNIÈRE : l'ajouter ailleurs décalerait les cinq
    // autres dans les fichiers que le locataire a déjà téléchargés.
    expect(entetes.split(';').at(-1)).toBe('Référence de la transaction')

    /*
      Une référence RÉELLE, tirée du jeu de démonstration, et non la seule
      présence d'une colonne : un en-tête suivi de six cellules vides
      satisferait une assertion qui ne regarderait que la première ligne.
    */
    const references = lignes.map((l) => l.split(';').at(-1))
    expect(references).toContain('MM-4471')
  })

  /**
   * L'AUTRE MOITIÉ. Les espèces ne produisent aucune référence, et la cellule
   * reste vide — sans quoi un export qui inventerait un identifiant serait pire
   * que celui qui n'en portait aucun.
   */
  it('laisse la cellule vide quand le versement n’en porte pas', async () => {
    const file = await historique()
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n').slice(1)

    const references = lignes.map((l) => l.split(';').at(-1))
    expect(references).toContain('')
    // Et la ligne existe bel et bien : une cellule vide sur une ligne absente
    // ne prouverait rien.
    expect(lignes.length).toBe(6)
  })

  /**
   * LA NOTE DU BAILLEUR N'Y EST PAS, et ne peut pas y être.
   *
   * Le serveur ne la sert pas à un locataire ; ce cas garde que l'export ne la
   * réintroduit pas par une colonne de plus. C'est le pendant, côté fichier, du
   * cas serveur « ne sert pas la note au locataire ».
   */
  it('n’emporte pas l’annotation du bailleur', async () => {
    const file = await historique()
    const entetes = file.text.replace(UTF8_BOM, '').trim().split('\r\n')[0]
    expect(entetes).not.toContain('Note')
  })
})
