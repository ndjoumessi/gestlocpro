import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { captureDownloads } from '@/test/downloads'

/**
 * UNE CAUTION RESTITUÉE N'EST PLUS À RESTITUER.
 *
 * ═══ CE QUE L'ÉCRAN AFFIRMAIT ═══
 *
 * Sur la ligne de C3 : la pastille disait « Restituée », et la colonne d'à côté
 * « À restituer 250 000 FCFA ». La même ligne se contredisait à trois
 * centimètres d'écart.
 *
 * Et le total en haut les additionnait : « À RESTITUER · 1 063 000 FCFA », avec
 * en note « 1 déjà restituée ». L'écran SAVAIT — il compte les restitutions
 * pour écrire cette note — et les faisait quand même entrer dans le montant que
 * le bailleur se déclare devoir.
 *
 * ═══ POURQUOI C'EST GRAVE, ET PAS SEULEMENT FAUX ═══
 *
 * Une caution n'est pas de l'argent au bailleur : c'est celui du locataire,
 * détenu pour lui. Le total « à restituer » est donc une DETTE, et une dette
 * qu'on surestime de tout l'historique n'est pas une approximation — c'est un
 * chiffre qui grandit à chaque départ et ne redescend jamais. Sur un parc qui
 * tourne cinq ans, il n'aura plus aucun rapport avec ce qui est dû.
 *
 * `held − withheld` était juste tant qu'aucune caution n'était rendue. Le
 * troisième statut existe depuis l'origine ; la formule ne l'a jamais lu.
 */

/** Les montants du jeu de démonstration : C3 est la caution restituée. */
const RESTITUEE = 250_000
const CONSIGNE_TOTAL = 1_226_000
const RETENU_TOTAL = 163_000

describe('les cautions rendues', () => {
  it('ne comptent plus dans ce qu’il reste à restituer', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* Le total est la DETTE : ce qui est encore détenu, moins ce qui est retenu.
       Les 250 000 déjà rendus n'y sont plus. */
    const attendu = CONSIGNE_TOTAL - RESTITUEE - RETENU_TOTAL
    const principal = (screen.getByRole('main').textContent ?? '').replace(/[\s ]/g, ' ')

    expect(principal, 'le total inclut une caution déjà rendue').toContain(
      attendu.toLocaleString('fr-FR').replace(/[\s ]/g, ' '),
    )
    expect(principal, 'le total d’avant est encore là').not.toContain('1 063 000')
  })

  /**
   * ET LA LIGNE NE SE CONTREDIT PLUS.
   *
   * Le total pouvait être corrigé en laissant chaque ligne mentir : c'est la
   * moitié qu'on oublie, parce qu'elle ne se voit qu'en descendant le tableau.
   */
  it('n’annoncent plus un solde sur leur propre ligne', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const ligne = screen
      .getAllByRole('row')
      .find((r) => /Restituée|Returned/.test(r.textContent ?? ''))
    expect(ligne, 'aucune caution restituée dans le jeu de démonstration').toBeDefined()

    /* LE MONTANT APPARAISSAIT DEUX FOIS sur la même ligne : en « Consigné », ce
       qui est juste — la caution valait bien 250 000 —, et en « À restituer »,
       ce qui contredisait la pastille d'à côté. La colonne du solde reste,
       muette : une case vide se lirait comme une donnée manquante. */
    const occurrences = (ligne!.textContent ?? '')
      .replace(/[\s ]/g, ' ')
      .match(/250 000/g)
    expect(occurrences, 'le montant rendu est annoncé comme encore dû').toHaveLength(1)
    /* DEUX TIRETS sur cette ligne, et c'est juste : la retenue est nulle, le
       solde n'a plus d'objet. On compte plutôt que d'en désigner un — un
       `getByText` unique échouerait sur une ligne parfaitement correcte. */
    expect(within(ligne!).getAllByText('—').length, 'la colonne du solde est vide').toBe(2)
  })

  /**
   * LE CONTREPOIDS. Ce qui est encore détenu reste dû, retenue comprise.
   *
   * Un correctif qui aurait retiré du total tout ce qui n'est pas `held` —
   * l'arbitrage en cours, par exemple — aurait effacé une dette bien réelle :
   * une caution en cours d'arbitrage est retenue en partie, pas rendue.
   */
  it('gardent l’arbitrage en cours dans la dette', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* A3 : 230 000 consignés, 45 000 retenus, arbitrage en cours. Les 185 000
       restants sont dus au locataire, et doivent rester comptés. */
    const ligne = screen.getAllByRole('row').find((r) => /Serge Mbarga/.test(r.textContent ?? ''))
    expect(within(ligne!).getByText(/185 000|185 000/)).toBeInTheDocument()
  })
})

/**
 * L'ÉTAT DES CAUTIONS DIT LA MÊME DETTE QUE L'ÉCRAN DONT IL SORT.
 *
 * ═══ POURQUOI CE DOCUMENT EXISTE ═══
 *
 * Une caution n'est pas l'argent du bailleur : c'est celui du locataire, détenu
 * pour lui. C'est la seule ligne du produit qu'on doit pouvoir JUSTIFIER sur
 * demande, et son écran était le seul écran d'argent SANS export — quand les
 * paiements et les relevés en ont un depuis longtemps.
 *
 * ═══ CE QUE CE CAS TIENT ═══
 *
 * Le raccord, qui n'appartient à personne : l'écran calcule sa dette, le
 * document la recalcule, et rien ne les obligeait à tomber d'accord. C'est
 * exactement la divergence que ce lot vient de corriger sur l'écran — un
 * document qui aurait gardé l'ancienne formule aurait remis la caution rendue
 * dans la dette, sur le papier cette fois.
 */
describe('l’état des cautions', () => {
  it('exclut de la dette ce qui a été rendu, comme l’écran', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /état des cautions|deposits statement/i }))
      const [fichier] = await capture.settle()
      const feuille = new TextDecoder('latin1').decode(fichier.bytes)

      /* 813 000 : ce que le parc doit encore, la caution rendue déduite. Le
         NOMBRE, et pas seulement le titre — un document qui reprendrait
         l'ancienne formule porterait 1 063 000 sans que rien ne le dise. */
      expect(feuille, 'la dette du document diffère de celle de l’écran').toMatch(/813\s?000/)
      expect(feuille, 'la caution rendue est encore comptée').not.toMatch(/1\s?063\s?000/)
    } finally {
      capture.restore()
    }
  })

  it('range les cautions par obligation, la rendue comprise', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /état des cautions|deposits statement/i }))
      const [fichier] = await capture.settle()
      const feuille = new TextDecoder('latin1').decode(fichier.bytes)

      /* TROIS SECTIONS, TROIS OBLIGATIONS : dette entière, dette en litige,
         dette éteinte. Les mêler ferait un tableau exact et inutilisable. */
      for (const section of ['Consignée', 'En cours', 'Restituée'])
        expect(feuille, `la section « ${section} » manque`).toContain(section)

      /* ET LA RENDUE FIGURE QUAND MÊME, hors du total : la retirer ferait un
         document qui ne se recoupe pas avec l'écran, et l'on chercherait la
         caution manquante. */
      expect(feuille, 'la caution rendue a disparu du document').toMatch(/C3/)
    } finally {
      capture.restore()
    }
  })
})

/**
 * LA SOUSTRACTION DE L'ÉTAT DES CAUTIONS SE FERME.
 *
 * ═══ CE QUE LA FEUILLE MONTRAIT ═══
 *
 * Trois lignes empilées, un filet, un total en gras :
 *
 *     Total consigné                                    1 869,02 €
 *     Retenu                                              248,49 €
 *     ────────────────────────────────────────────────────────────
 *     À restituer                                       1 239,41 €
 *
 * 1 869,02 moins 248,49 font 1 620,53. La feuille annonce 1 239,41.
 *
 * ═══ LE TOTAL EST JUSTE, ET C'EST BIEN LE PROBLÈME ═══
 *
 * L'écart est exactement la caution de C3, rendue : elle entre dans le consigné
 * — elle a été versée — et sort de la dette — elle a été remboursée. C'est la
 * règle posée au lot précédent, et le total en gras est le bon chiffre.
 *
 * Mais RIEN SUR LE PAPIER NE LE DIT. Un filet au-dessus d'un total en gras est
 * une promesse de calcul : le lecteur soustrait, tombe à côté, et conclut à une
 * erreur — sur le document qui sert précisément à JUSTIFIER ce qu'on détient
 * pour autrui. Un document qu'on remet ne peut pas demander qu'on lui fasse
 * confiance sur un chiffre qui, écrit à côté des deux autres, semble faux.
 *
 * ═══ CE QUI FERME LA SOUSTRACTION ═══
 *
 * Une ligne de plus, avec le terme manquant : ce qui a DÉJÀ été rendu. Les
 * quatre nombres se recoupent alors sans qu'on ait à savoir quelle règle
 * s'applique — et c'est ce que ce cas mesure, sur les nombres et non sur la
 * présence d'un libellé.
 *
 * LE MAUVAIS CORRECTIF EST À PORTÉE : refaire entrer les cautions rendues dans
 * la dette ferme la soustraction aussi, et remet le bailleur en dette de ce
 * qu'il a déjà remboursé. Le contrepoids ci-dessous le retient.
 */
describe('les totaux de l’état des cautions', () => {
  async function feuilleDesCautions() {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    return await exporterLaFeuille()
  }

  /** L'export seul — pour les cas qui doivent AGIR sur le parc avant. */
  async function exporterLaFeuille() {
    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /état des cautions|deposits statement/i }))
      const [fichier] = await capture.settle()
      return new TextDecoder('latin1').decode(fichier.bytes)
    } finally {
      capture.restore()
    }
  }

  /**
   * Le montant écrit EN FACE d'un intitulé.
   *
   * `page.paire` pose deux textes : l'intitulé à gauche, la valeur à droite,
   * dans cet ordre. On prend donc le premier montant qui suit l'intitulé dans
   * le flux — et l'on ne se contente pas de chercher un nombre quelque part,
   * qui tomberait aussi bien sur la ligne d'une caution.
   */
  function montantEnFaceDe(feuille: string, intitule: string): number {
    const trouve = feuille.match(
      new RegExp(`\\(${intitule}\\) Tj[\\s\\S]*?\\(([^)]+)\\) Tj`),
    )
    expect(trouve, `« ${intitule} » ne figure pas sur la feuille`).not.toBeNull()
    return Number((trouve?.[1] ?? '').replace(/\D/g, ''))
  }

  it('recoupent ce qu’ils affichent', async () => {
    const feuille = await feuilleDesCautions()

    const consigne = montantEnFaceDe(feuille, 'Total consigné')
    const retenu = montantEnFaceDe(feuille, 'Retenu')
    const rendu = montantEnFaceDe(feuille, 'Déjà restituées?')
    const du = montantEnFaceDe(feuille, 'À restituer')

    /* LES NOMBRES, ET NON LES LIBELLÉS : une ligne « Déjà restituée » portant
       un autre montant que celui qui manque laisserait la feuille aussi fausse
       à lire, en ayant l'air d'avoir été corrigée. */
    expect(consigne - retenu - rendu, 'la soustraction de la feuille ne tombe pas juste').toBe(du)
    /* Et les valeurs elles-mêmes, sans quoi une feuille de quatre zéros
       passerait. */
    expect([consigne, retenu, rendu, du]).toEqual([1_226_000, 163_000, 250_000, 813_000])
  })

  /**
   * L'INTITULÉ S'ACCORDE AVEC CE QU'IL COMPTE.
   *
   * « Déjà restituée » est écrit au singulier, comme les trois pastilles de
   * statut dont il reprend le mot. Mais ce n'est pas une pastille : c'est un
   * TOTAL, et il porte autant de cautions qu'il y en a eu de rendues. Sur un
   * parc qui tourne, ce sera le cas ordinaire — les restitutions s'accumulent
   * là où les cautions en cours se renouvellent.
   *
   * ═══ POURQUOI CE CAS ARBITRE UNE CAUTION ═══
   *
   * Le jeu de démonstration n'en porte qu'une de rendue : le singulier y est
   * juste, et aucune lecture de la feuille telle qu'elle sort ne peut montrer
   * le défaut. Le cas FABRIQUE donc la seconde restitution par le geste du
   * produit — arbitrer A3 sans rien retenir, ce que le champ d'aide appelle le
   * cas normal — plutôt que par une donnée d'essai posée à côté. C'est aussi ce
   * qui le rend sûr : si `settleDeposit` cessait de faire passer une caution en
   * « restituée », ce cas tomberait au lieu de continuer à mesurer une fiction.
   */
  it('accorde son intitulé quand deux cautions ont été rendues', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getAllByRole('button', { name: /Arbitrer|Settle/ })[0])
    const modale = await screen.findByRole('dialog')
    /* LE CHAMP EST VIDÉ, et il faut le faire : la modale le PRÉ-REMPLIT avec
       les réserves de sortie — 45 000 pour A3 — et une retenue non nulle exige
       une justification, donc valider sans y toucher ne fait rien. Vidé, il
       vaut zéro : la caution repart entière, ce que le libellé d'aide du champ
       appelle le cas normal. */
    const retenue = modale.querySelector('input[name="withheld"]')
    expect(retenue, 'le champ de retenue est introuvable').not.toBeNull()
    await utilisateur.clear(retenue as HTMLInputElement)
    await utilisateur.click(
      within(modale).getByRole('button', { name: /Valider l’arbitrage|Confirm/ }),
    )

    const feuille = await exporterLaFeuille()

    expect(feuille, 'l’intitulé est resté au singulier').toContain('(Déjà restituées)')
    /* ET LA SOUSTRACTION TIENT TOUJOURS. Un accord posé sans regarder les
       nombres laisserait la feuille bien écrite et fausse. */
    expect(
      montantEnFaceDe(feuille, 'Total consigné') -
        montantEnFaceDe(feuille, 'Retenu') -
        montantEnFaceDe(feuille, 'Déjà restituées?'),
      'la soustraction ne tombe plus après un arbitrage',
    ).toBe(montantEnFaceDe(feuille, 'À restituer'))
  })

  /**
   * LE CONTREPOIDS DE L'ACCORD. Une seule rendue garde le singulier.
   *
   * Mettre l'intitulé au pluriel une fois pour toutes ferme le défaut et en
   * ouvre le symétrique, sur le chemin le plus courant : la première
   * restitution d'un parc.
   */
  it('garde le singulier sur une seule restitution', async () => {
    const feuille = await feuilleDesCautions()

    expect(feuille, 'le pluriel est écrit pour une seule caution').toContain('(Déjà restituée)')
    expect(feuille).not.toContain('(Déjà restituées)')
  })

  /**
   * LE CONTREPOIDS. Fermer la soustraction ne rouvre pas la dette.
   *
   * L'autre manière de faire tomber le calcul juste est de remettre les
   * cautions rendues dans « à restituer ». Le document redeviendrait cohérent
   * avec lui-même ET faux sur le seul chiffre qu'on vient y chercher — le
   * défaut que le lot des cautions a corrigé, réintroduit par sa réparation.
   */
  it('ne remettent pas la caution rendue dans la dette', async () => {
    const feuille = await feuilleDesCautions()

    expect(montantEnFaceDe(feuille, 'À restituer'), 'la dette a repris la caution rendue').toBe(
      813_000,
    )
    expect(feuille, 'l’ancien total est revenu').not.toMatch(/1\s?063\s?000/)
  })

  /**
   * ET L'ÉCRAN DIT LA MÊME CHOSE, parce que c'est le même lecteur.
   *
   * Les trois cartes portent les trois mêmes nombres, côte à côte : 1 226 000,
   * 163 000, 813 000. La note de la troisième disait « 1 déjà restituée » — un
   * DÉNOMBREMENT, qui nomme la raison de l'écart sans en donner la taille. On y
   * apprend qu'il manque quelque chose, pas de combien.
   */
  it('se recoupent aussi sur les trois cartes de l’écran', async () => {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    /* Les cartes se désignent par `data-indicateur`, le témoin que `StatCard`
       pose sur chacune — c'est déjà par lui que les gardes d'indicateur les
       trouvent. */
    const carte = Array.from(document.querySelectorAll('[data-indicateur]')).find((c) =>
      /À restituer|To return/.test(c.textContent ?? ''),
    )
    expect(carte, 'la carte de la dette est introuvable').toBeDefined()

    const texte = (carte?.textContent ?? '').replace(/[\s ]/g, ' ')
    expect(texte, 'la note ne dit pas de combien la dette a été réduite').toContain('250 000')
  })
})

/**
 * L'ÉTAT DES CAUTIONS EN TABLEUR, à côté du document.
 *
 * ═══ DEUX SORTIES POUR DEUX GESTES ═══
 *
 * Le PDF se REMET — à un locataire qui part, à un associé, à un contrôle. Le
 * tableur se RECOUPE : c'est avec lui qu'un bailleur rapproche ses cautions de
 * son relevé bancaire, et cette colonne-là ne se lit pas sur un papier mis en
 * page. Les paiements et les relevés offrent le tableur depuis longtemps ; les
 * cautions, qui sont pourtant l'argent qu'on détient POUR QUELQU'UN D'AUTRE,
 * n'avaient ni l'un ni l'autre.
 *
 * ═══ ET IL PORTE LA MÊME RÈGLE ═══
 *
 * Une caution rendue n'a pas de solde. Un tableur qui reprendrait
 * `held − withheld` sur toutes les lignes remettrait la dette éteinte dans la
 * colonne qu'on somme — le défaut que ce fichier vient de corriger à l'écran,
 * dans le format où il se somme justement.
 */
describe('l’état des cautions en tableur', () => {
  async function exporter() {
    installerFauxServeur()
    await renderApp('/demo/cautions')
    await attendreLeChargement()

    const capture = captureDownloads()
    try {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /tableur|spreadsheet/i }))
      const [fichier] = await capture.settle()
      return new TextDecoder().decode(fichier.bytes)
    } finally {
      capture.restore()
    }
  }

  it('porte chaque caution, son statut et son solde', async () => {
    const tableur = await exporter()

    /* Les cinq cautions, la rendue comprise : un tableur qui en cacherait une
       ne se recouperait pas avec l'écran dont il sort. */
    for (const unite of ['A1', 'A2', 'A3', 'B4', 'C3'])
      expect(tableur, `la caution ${unite} manque`).toContain(unite)

    /* A3 : 230 000 consignés, 45 000 retenus, 185 000 dus. Les trois colonnes,
       parce que c'est leur rapprochement qui fait l'intérêt du fichier. */
    expect(tableur).toContain('230000')
    expect(tableur).toContain('45000')
    expect(tableur).toContain('185000')
  })

  it('n’écrit aucun solde sur une caution rendue', async () => {
    const tableur = await exporter()
    const ligne = tableur.split('\n').find((l) => l.startsWith('C3'))

    expect(ligne, 'la caution rendue est absente du tableur').toBeDefined()
    /* Le montant CONSIGNÉ reste — la caution valait bien 250 000 — mais la
       colonne du solde est vide. Écrire 250000 deux fois sur cette ligne
       remettrait la dette éteinte dans la colonne qu'on somme. */
    expect((ligne!.match(/250000/g) ?? []).length, 'le solde d’une caution rendue est écrit').toBe(
      1,
    )
  })
})
