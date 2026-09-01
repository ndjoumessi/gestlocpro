import { afterEach, describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent, cliquerAction } from '@/test/render'
import { captureDownloads } from '@/test/downloads'
import { UTF8_BOM } from '@/lib/csv'
import { DEMO_TENANT_UNIT, UNITS, TENANT_RECEIPTS } from '@/data/portfolio'

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
  /* `cliquerAction` et non un clic direct : depuis que l'en-tête ne montre que
     deux commandes, l'export s'est replié derrière trois points sur les écrans
     qui en portaient quatre. Le helper reproduit le geste de l'utilisateur —
     chercher, et ouvrir le menu si ce n'est pas là — donc ce cas reste juste
     quelle que soit la moitié de la rangée où l'action a atterri. */
  await cliquerAction(label)
  const files = await capture!.settle()
  expect(files).toHaveLength(1)
  return files[0]
}

describe('export des paiements', () => {
  it('produit un fichier CSV nommé, daté et encodé pour Excel', async () => {
    capture = captureDownloads()
    await renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)

    /* LE NOM PORTE LA DEVISE LUE, entre le sujet et la date. Deux exports du
       même parc dans deux monnaies rendaient deux fichiers de MÊME NOM : le
       second écrasait le premier dans le dossier des téléchargements, sans un
       mot. Un fichier qui quitte le produit doit se suffire, nom compris. */
    expect(file.name).toMatch(/^gestlocpro-paiements-cfa-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(file.type).toContain('text/csv')
    // Sans BOM, « Deïdo » et « Réglé » arrivent illisibles dans Excel. On le
    // vérifie sur les OCTETS : c'est ce que le tableur lira.
    expect(file.text.startsWith(UTF8_BOM)).toBe(true)
    expect([...file.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('exporte les lignes affichées, en-têtes traduits compris', async () => {
    capture = captureDownloads()
    await renderApp('/app/paiements')

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
    await renderApp('/app/paiements')

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
    await renderApp('/demo/paiements')
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
    await renderApp('/app/paiements')

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
    await renderApp('/app/paiements', { locale: 'en' })

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
    await renderApp('/app/paiements')

    const file = await exporter(/Exporter le relevé/)
    expect(file.text.split('\r\n')[0]).toContain(';')
  })
})

describe('export des relevés de compteurs', () => {
  it('porte les index, la consommation et le montant refacturé', async () => {
    capture = captureDownloads()
    await renderApp('/app/releves')

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
    await renderApp('/app')

    const file = await exporter(/Exporter le relevé/)
    const lignes = file.text.replace(UTF8_BOM, '').trim().split('\r\n')

    expect(file.name).toMatch(/^gestlocpro-encaissements-/)
    expect(lignes[0]).toBe('Période;Loyer (FCFA);Eau (FCFA);Électricité (FCFA);Total (FCFA)')
    expect(lignes).toHaveLength(13)
  })
})

/**
 * LES QUITTANCES SORTENT EN PDF, ET NON PLUS EN TABLEUR.
 *
 * Le CSV d'une seule ligne était honnête faute de mieux — son commentaire
 * disait « le vrai document est un PDF que ce produit ne sait pas encore
 * fabriquer ». Il sait : `lib/pdf.ts`. Un tableur d'une ligne n'est pas ce
 * qu'un locataire présente à qui lui réclame une quittance.
 *
 * CE QUI NE CHANGE PAS : l'espace locataire n'offre toujours qu'UN chemin vers
 * ce document. Deux — une modale qui rend les montants du registre, une liste
 * qui recompose un fichier côté client — donnaient deux vérités pour une seule
 * quittance.
 *
 * LES CAS LISENT LES OCTETS et non le texte décodé : un PDF n'est pas de
 * l'UTF-8, et `file.text` y rendrait des caractères de remplacement là où le
 * document porte ses accents. C'est aussi la seule façon de vérifier que le
 * fichier commence bien par la signature du format.
 */
describe('quittances du locataire', () => {
  /**
   * LES DEUX PÉRIODES ATTENDUES, DÉRIVÉES DU JEU ET NON ÉCRITES.
   *
   * Elles l'étaient — `2026-08`, `2026-07` — et elles sont devenues fausses le
   * 1er septembre 2026, quand le jeu de démonstration a cessé de s'ancrer à
   * août pour suivre l'horloge. Le sujet de ces cas n'a pas bougé : le fichier
   * porte le mois de la PÉRIODE, jamais le jour du téléchargement. C'est
   * exactement ce qu'un attendu dérivé garde, et qu'un attendu écrit perdait au
   * premier changement de mois.
   */
  const periodes = [...TENANT_RECEIPTS]
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
    .map((r) => `${r.year}-${String(r.month + 1).padStart(2, '0')}`)
  const nomDuFichier = (rang: number) => `gestlocpro-quittance-a1-${periodes[rang]}.pdf`
  const moisEnToutesLettres = (rang: number) => {
    const r = [...TENANT_RECEIPTS].sort(
      (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
    )[rang]!
    const nom = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(r.year, r.month, 1)),
    )
    return nom.charAt(0).toUpperCase() + nom.slice(1)
  }

  /** Le fichier en latin-1 : un octet, un caractère, comme dans le PDF. */
  const enLatin1 = (octets: Uint8Array) =>
    Array.from(octets, (o) => String.fromCharCode(o)).join('')

  it('télécharge la quittance de la période, nommée par son mois', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    const [premier] = screen.getAllByRole('button', { name: /^Télécharger$/ })
    await user.click(premier)
    const [file] = await capture.settle()

    // Le mois de la quittance, pas le jour du téléchargement : c'est la période
    // qui identifie le document.
    expect(file.name).toBe(nomDuFichier(0))
    expect(file.type).toBe('application/pdf')

    const document = enLatin1(file.bytes)
    expect(document.startsWith('%PDF'), 'ce n’est pas un PDF').toBe(true)
    expect(document).toContain('(Quittance de loyer)')
    /* Le mois en toutes lettres, dans l'encodage du PDF : les accents y sont en
       latin-1, d'où la conversion plutôt qu'une chaîne littérale. */
    expect(document).toContain(
      '(' + moisEnToutesLettres(0).replace(/[À-ÿ]/g, (c) => String.fromCharCode(c.charCodeAt(0))) + ')',
    )
    expect(document).toContain('(Charles Ngassa)')
    /* Sans les parenthèses du format : l'immeuble partage sa ligne avec le
       numéro du logement — « A1 · Résidence Bonamoussadi » —, et exiger la
       chaîne entière ferait rougir ce cas au premier changement de séparateur.
       Ce qu'il garde est que l'immeuble est nommé. */
    expect(document).toContain('R\xE9sidence Bonamoussadi')
  })

  /**
   * LE DOCUMENT DIT CE QU'IL N'EST PAS.
   *
   * Il est produit depuis les données du parc et ne porte aucune signature. Une
   * mise en page soignée suffit à faire passer un relevé pour une pièce ; le
   * pied de page est le seul endroit où cette différence est écrite, et il est
   * sur CHAQUE page — un pied qui ne serait qu'à la dernière ne servirait à
   * rien sur un carnet qu'on détache.
   */
  it('porte en pied de page ce qu’il est, et le compte de ses pages', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^Télécharger$/ })[0])
    const [file] = await capture.settle()

    const document = enLatin1(file.bytes)
    expect(document).toContain('page 1 sur 1')
    expect(document).toContain('sans signature')
  })

  /**
   * UNE QUITTANCE N'ATTESTE QUE D'UNE PÉRIODE SOLDÉE, ET LE SERVEUR L'AVAIT
   * DÉJÀ TRANCHÉ.
   *
   * Sa route d'émission porte la règle en toutes lettres : « quittance seulement
   * si la période est intégralement soldée. En deçà, on émet un REÇU, qui
   * n'atteste que le montant reçu. Confondre les deux ferait signer au bailleur
   * une preuve de paiement qu'il n'a pas reçu. »
   *
   * Le document du locataire, lui, s'intitulait « Quittance de loyer » sur les
   * six périodes, celle qu'il n'a réglée qu'en partie comprise. Le même mois
   * portait donc deux noms selon qui le regardait : un reçu chez le
   * gestionnaire, une quittance chez le locataire — et c'est le second qui la
   * garde et la présente.
   *
   * Les deux chemins lisent désormais LA MÊME PAIRE DE CLÉS. Mai 2026 est la
   * période partielle du jeu de démonstration : 160 760 versés sur 165 818 dus.
   */
  it('n’appelle « quittance » qu’une période soldée', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    const boutons = screen.getAllByRole('button', { name: /^Télécharger$/ })
    // Août soldé, puis mai partiel — quatrième de la liste.
    await user.click(boutons[0])
    await user.click(boutons[3])
    const [solde, partiel] = await capture.settle()

    const lire = (o: Uint8Array) => Array.from(o, (c) => String.fromCharCode(c)).join('')
    expect(lire(solde.bytes)).toContain('(Quittance de loyer)')

    const document = lire(partiel.bytes)
    expect(document, 'une période partielle s’intitule quittance').not.toContain(
      '(Quittance de loyer)',
    )
    expect(document).toContain('(Re\xE7u de paiement)')
  })

  it('donne un fichier distinct à chaque période', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    const boutons = screen.getAllByRole('button', { name: /^Télécharger$/ })
    expect(boutons).toHaveLength(6)

    await user.click(boutons[0])
    await user.click(boutons[1])
    const files = await capture.settle()

    expect(files.map((f) => f.name)).toEqual([nomDuFichier(0), nomDuFichier(1)])
  })

  /**
   * « TOUT TÉLÉCHARGER » REND UN SEUL FICHIER, et c'est la même raison qu'avant.
   *
   * Six téléchargements successifs se font arrêter par le navigateur dès le
   * deuxième : le locataire repartirait avec une quittance sur six en croyant
   * les avoir toutes. Ce qui change est que le fichier unique est devenu un
   * CARNET — une page par période — au lieu d'un tableau de chiffres.
   */
  it('réunit toutes les périodes en un seul carnet', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const file = await exporter(/Tout télécharger/)

    expect(file.name).toMatch(/^gestlocpro-quittances-du-locataire-a1-\d{4}-\d{2}-\d{2}\.pdf$/)
    const document = enLatin1(file.bytes)
    expect(document).toMatch(/\/Count 6/)
    expect(document).toContain('page 6 sur 6')
  })

  /**
   * LE TABLEUR EST REVENU, À CÔTÉ DU CARNET.
   *
   * Il avait disparu quand « Tout télécharger » est passé au PDF, et rien ne
   * l'avait demandé. Les deux fichiers ne servent pourtant pas au même geste :
   * le carnet se présente, le tableau se calcule — on y trie ses périodes, on y
   * somme une année, on le colle dans une feuille.
   *
   * Le cas garde les deux colonnes qui font sa valeur et qu'un document ne
   * remplace pas : « réglé », seul chiffre qui distingue une période payée d'une
   * période en cours, et la référence de l'opérateur, avec laquelle on conteste.
   */
  it('offre aussi l’historique en tableur, calculable', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const file = await exporter(/Exporter en tableur/)

    /* La devise s'intercale, comme sur tous les tableurs — le PDF, lui, garde
       son nom : il porte sa devise EN TOUTES LETTRES sur la feuille, où un
       lecteur la voit. Un tableur ne montre que des nombres. */
    expect(file.name).toMatch(
      /^gestlocpro-quittances-du-locataire-a1-cfa-\d{4}-\d{2}-\d{2}\.csv$/,
    )
    const [entetes, ...lignes] = file.text.replace(UTF8_BOM, '').trim().split('\r\n')
    expect(entetes.split(';').at(-1)).toBe('Référence de la transaction')
    expect(entetes).toContain('Réglé')
    expect(lignes).toHaveLength(6)
    expect(lignes.map((l) => l.split(';').at(-1))).toContain('MM-4471')
  })

  /**
   * LES DEUX LIGNES QUI DISAIENT « AUCUN DOCUMENT DÉPOSÉ » EN PRODUISENT UN.
   *
   * Elles le disaient parce que le produit ne savait ni recevoir un fichier ni
   * en fabriquer. La seconde moitié a changé, et leurs DONNÉES existaient déjà :
   * une caution porte son consigné, son retenu et son solde ; un état des lieux
   * porte sa date, ses pièces et ses réserves.
   *
   * LE BAIL RESTE FERMÉ, et le cas le garde : rien n'enregistre son texte, donc
   * le produire reviendrait à fabriquer une pièce que rien n'atteste.
   */
  it('produit le reçu de caution et l’état des lieux, jamais le bail', async () => {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Télécharger le reçu de caution/i }))
    await user.click(screen.getByRole('button', { name: /Télécharger l’état des lieux/i }))
    const files = await capture.settle()

    expect(files.map((f) => f.name)).toEqual([
      expect.stringMatching(/^gestlocpro-recu-caution-a1-/),
      expect.stringMatching(/^gestlocpro-etat-des-lieux-a1-/),
    ])
    expect(enLatin1(files[0].bytes)).toContain('(Re\xE7u de caution)')
    expect(enLatin1(files[1].bytes)).toContain("(\xC9tat des lieux d\x92entr\xE9e)")

    expect(
      screen.queryByRole('button', { name: /Télécharger le contrat/i }),
      'le bail se télécharge, alors que rien n’en enregistre le texte',
    ).toBeNull()
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
 * LA RÉFÉRENCE DE L'OPÉRATEUR, dans le document que le locataire garde.
 *
 * Elle était saisie à l'encaissement, écrite en base, et absente du `select` de
 * la lecture : le bailleur tapait « MM-4471 » et personne ne le revoyait. Sans
 * elle, le document demande au locataire de croire sur parole un encaissement
 * qu'il ne peut pas retrouver chez son opérateur — c'est avec cette chaîne
 * qu'il conteste.
 *
 * Le lot qui l'a rétablie l'avait ajoutée SANS ce cas, et la mutation l'a dit :
 * remplacer la colonne par `null` ne faisait rougir personne.
 *
 * CES CAS ONT CHANGÉ DE FORMAT, PAS DE RÈGLE. Ils mesuraient une colonne de CSV ;
 * ils mesurent maintenant une ligne de PDF. Ce qu'ils gardent — la référence est
 * là, et rien ne la remplace quand elle n'existe pas — n'a pas bougé d'un mot,
 * et c'est la raison pour laquelle ils survivent au changement plutôt que d'être
 * réécrits.
 */
describe('la référence dans le document du locataire', () => {
  /** Le carnet « Tout télécharger » : les six périodes en un seul PDF. */
  async function historique() {
    capture = captureDownloads()
    await renderApp('/demo/documents')
    await switchRole('tenant')
    await attendreLeChargement()
    const file = await exporter(/Tout télécharger/)
    return Array.from(file.bytes, (o) => String.fromCharCode(o)).join('')
  }

  /**
   * Les lignes de versement du document.
   *
   * Elles se reconnaissent à leur date en tête : le format range chaque texte
   * entre parenthèses, et c'est la seule façon de lire un PDF sans le rendre.
   */
  const versements = (document: string) =>
    [...document.matchAll(/\((\d{2}\/\d{2}\/\d{4}[^)]*)\)/g)].map((m) => m[1])

  it('porte la référence du versement', async () => {
    const document = await historique()

    /*
      Une référence RÉELLE, tirée du jeu de démonstration, et non la seule
      présence d'un intitulé : un libellé suivi de six lignes muettes
      satisferait une assertion qui ne regarderait que la mise en page.
    */
    expect(versements(document).some((ligne) => ligne.includes('MM-4471'))).toBe(true)
  })

  /**
   * L'AUTRE MOITIÉ. Les espèces ne produisent aucune référence, et la ligne
   * n'en porte alors aucune — sans quoi un document qui inventerait un
   * identifiant serait pire que celui qui n'en portait aucun.
   */
  it('n’en invente pas quand le versement n’en porte pas', async () => {
    const document = await historique()
    const lignes = versements(document)

    // Une ligne à DEUX segments — la date et le moyen — donc sans référence.
    expect(lignes.some((ligne) => ligne.split(' \xB7 ').length === 2)).toBe(true)
    // Et les lignes existent bel et bien : une absence sur un document vide ne
    // prouverait rien.
    expect(lignes.length).toBe(6)
    // Aucun séparateur orphelin : « 03/08/2026 · Espèces · » dirait qu'une
    // référence manque là où il n'y en a jamais eu.
    for (const ligne of lignes) expect(ligne.trimEnd().endsWith('\xB7')).toBe(false)
  })

  /**
   * LA NOTE DU BAILLEUR N'Y EST PAS, et ne peut pas y être.
   *
   * Le serveur ne la sert pas à un locataire ; ce cas garde que le document ne
   * la réintroduit pas par une ligne de plus. C'est le pendant, côté fichier, du
   * cas serveur « ne sert pas la note au locataire ».
   */
  it('n’emporte pas l’annotation du bailleur', async () => {
    const document = await historique()
    expect(document).not.toContain('(Note')
  })
})
