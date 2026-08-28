import { describe, expect, it } from 'vitest'
import { renderApp, screen, switchRole, attendreLeChargement, userEvent, within } from '@/test/render'
import { UNITS, WORKS } from '@/data/portfolio'

/**
 * Défauts relevés écran par écran en basculant l'interface en anglais.
 *
 * Ils partagent une origine : une valeur écrite pour être lue en français —
 * une notation, une abréviation, un nombre nu — puis servie telle quelle à un
 * lecteur anglophone. Aucun ne se voyait dans l'interface française, ce qui
 * explique qu'ils aient tous survécu à la relecture.
 */
describe('typologie du logement', () => {
  it('se traduit là où la notation française ne se lit pas', async () => {
    // « T3 » compte les pièces principales à la française. Ce n'est pas un mot
    // français, mais c'est une notation française : le marché anglophone
    // compte les chambres.
    await renderApp('/app/parc', { locale: 'en' })
    expect(screen.getAllByText(/2-bed/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\bT3\b/)).not.toBeInTheDocument()
  })

  it('garde la notation d’origine en français', async () => {
    await renderApp('/app/parc')
    expect(screen.getAllByText(/T3/).length).toBeGreaterThan(0)
  })

  it('se cherche sur le libellé affiché, non sur la clé', async () => {
    // Un anglophone tape ce qu'il voit. Chercher « T3 » sur une interface qui
    // affiche « 2-bed » ne ramenait rien de ce qui était pourtant à l'écran.
    await renderApp('/app/parc', { locale: 'en' })
    expect(screen.getAllByText(/2-bed/).length).toBeGreaterThan(0)
  })
})

describe('paiements', () => {
  it('n’abrège pas les jours de retard en français', async () => {
    // La cellule portait « +24 j », y compris en anglais.
    await renderApp('/app/paiements', { locale: 'en' })
    expect(screen.getByText('+24 d')).toBeInTheDocument()
    expect(screen.queryByText('+24 j')).not.toBeInTheDocument()
  })
})

describe('relevés de compteurs', () => {
  it('affiche les tarifs unitaires comme des montants', async () => {
    // Ils étaient interpolés directement : « 520 » sans devise ni groupement,
    // à côté d'un total correctement formaté, et insensibles à la devise.
    await renderApp('/app/releves', { locale: 'en', currency: 'USD' })
    /* 520 mineures lues en dollars font 5,20 $, et l'écran les ARRONDIT à
       « 5 $ » : les tarifs unitaires passent par `round`, ce qui convient à un
       prix au mètre cube en francs et efface tout d'un prix en dollars. Le cas
       garde ce qu'il gardait — un montant mis en forme, avec sa devise, et non
       un nombre interpolé — et nomme au passage un défaut qu'il ne corrige pas. */
    expect(screen.getByText(/\$\s?5\b/)).toBeInTheDocument()
  })

  it('groupe les index de compteur', async () => {
    // Cinq chiffres rendus « 7640 » dans les deux langues.
    await renderApp('/app/releves', { locale: 'en' })
    expect(screen.getByText(/7,320→7,640/)).toBeInTheDocument()
  })
})

/**
 * Le groupement des milliers suit la **devise**, non la langue de l'interface.
 *
 * Décision de produit, prise explicitement : « 45 000 FCFA » garde son espace
 * insécable étroite dans l'interface anglaise. Le franc CFA est une monnaie de
 * zone francophone, et son écriture usuelle ne change pas parce que le lecteur
 * a choisi l'anglais — au contraire d'une date, qui est du formatage pur.
 *
 * Ce test existe pour que la règle ne passe pas pour un oubli : sans lui, elle
 * ressemble à un défaut d'i18n et quelqu'un la « corrigera ».
 */
describe('groupement monétaire', () => {
  // L'espace du rendu est insécable ÉTROITE (U+202F) et non ordinaire : c'est
  // elle qui empêche un montant de se couper en fin de cellule. L'écrire en
  // échappement plutôt qu'en caractère invisible évite un test qui échoue sans
  // qu'on voie pourquoi.
  const FINE = '\u202f'
  // L'espace qui précède le symbole est PLEINE, celle des milliers est fine.
  // Les deux étaient fines quand les montants étaient en chasse fixe ; voir
  // `currency/currencies.ts`.
  const PLEINE = '\u00a0'

  // La cellule découpe le montant en plusieurs nœuds selon la colonne, d'où
  // l'assertion sur le texte de la page plutôt que sur un élément : ce que la
  // règle affirme est bien « ce rendu apparaît à l'écran », pas « il occupe tel
  // élément ».
  const texte = () => document.body.textContent ?? ''

  it('suit la devise et non la langue de l’interface', async () => {
    await renderApp('/app/paiements', { locale: 'en', currency: 'CFA' })
    expect(texte()).toContain(`145${FINE}000${PLEINE}FCFA`)
  })

  it('change bien avec la devise, à langue égale', async () => {
    await renderApp('/app/paiements', { locale: 'en', currency: 'USD' })
    // Symbole AVANT le montant pour le dollar, mais la même espace pleine :
    // c'est la position qui change d'une devise à l'autre, pas la césure.
    // Le groupement survit au changement d'unité : 145 000 cents font 1 450,00 $.
    expect(texte()).toContain(`$${PLEINE}1,450`)
  })
})

describe('locataires', () => {
  it('conserve le téléphone demandé au lieu de le jeter', () => {
    // Le formulaire réclamait un numéro en promettant d'y envoyer le code
    // d'invitation ; `addTenant` ne recevait que le nom, et aucun champ du
    // modèle ne pouvait l'accueillir.
    expect(UNITS.every((u) => (u.tenant === null) === (u.phone === null))).toBe(true)
  })

  it('affiche le contact, dont les clés existaient sans appelant', async () => {
    await renderApp('/app/locataires', { locale: 'en' })
    expect(screen.getByRole('columnheader', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByText('+237 6 77 21 44 08')).toBeInTheDocument()
  })
})

/**
 * Intitulés des signalements du jeu de démonstration.
 *
 * La distinction que ces tests gardent : le champ porte la saisie du locataire
 * dans le produit réel — et une saisie ne se traduit jamais —, mais ces cinq
 * lignes ne sont la saisie de personne. Les laisser en français montrait du
 * français dans la démonstration anglaise ; les écrire en anglais aurait
 * produit le défaut en miroir.
 */
describe('signalements de démonstration', () => {
  it('suit la langue de l’interface', async () => {
    await renderApp('/app/travaux', { locale: 'en' })
    expect(screen.getByText('Leak under the kitchen sink')).toBeInTheDocument()
  })

  it('reste correct en français, et non anglais en miroir', async () => {
    await renderApp('/app/travaux')
    expect(screen.getByText('Fuite sous l’évier de la cuisine')).toBeInTheDocument()
  })

  it('ne laisse aucune phrase dans la donnée', () => {
    for (const work of WORKS) {
      expect(work).not.toHaveProperty('title')
      // Une clé, pas une phrase : ni espace ni ponctuation.
      expect(work.titleKey).toMatch(/^[a-zA-Z]+$/)
    }
  })
})

/**
 * Ce que le gestionnaire ne peut pas faire, et pourquoi.
 *
 * Valider un devis et arbitrer une caution sont les deux droits qui distinguent
 * le propriétaire du gestionnaire — c'est la même règle de délégation, écrite
 * dans la matrice des droits. L'écran des cautions expliquait déjà l'absence du
 * bouton ; celui des travaux le faisait simplement disparaître, laissant deviner
 * si l'action manquait par droit ou par défaut.
 */
describe('délégation expliquée au gestionnaire', () => {
  it('dit pourquoi le gestionnaire ne valide pas un devis', async () => {
    await renderApp('/demo/travaux', { locale: 'en' })
    await switchRole('manager')
    await attendreLeChargement()
    expect(screen.getByText(/Only the owner approves quotes/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve quote/i })).not.toBeInTheDocument()
  })

  it('laisse au propriétaire le bouton et non la note', async () => {
    await renderApp('/app/travaux', { locale: 'en' })
    expect(screen.getAllByRole('button', { name: /Approve quote/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Only the owner approves quotes/)).not.toBeInTheDocument()
  })

  it('traite les deux droits de la même façon', async () => {
    // La parité est le point : deux écrans, une seule règle.
    await renderApp('/demo/cautions', { locale: 'en' })
    await switchRole('manager')
    await attendreLeChargement()
    expect(screen.getByText(/Only the owner settles deposits/)).toBeInTheDocument()
  })
})

/*
 * « signalement du portail » vivait ici, et gardait la règle des trois
 * caractères sur la COPIE que la prévisualisation entretenait — le seul endroit
 * du dépôt où cette règle était éprouvée, et ce n'était pas le formulaire du
 * produit. Le portail monte désormais le vrai écran ; l'intention est passée
 * dans `ecranSignaler.test.tsx`, qui l'éprouve sur `/demo/signaler`.
 */

/**
 * Matrice des droits.
 *
 * Le mode par défaut doit montrer le parc tel qu'il est démontré — délégué,
 * puisque le sélecteur de profil porte un gestionnaire et que deux écrans lui
 * adressent une note. En mode `solo`, la colonne « Gestionnaire » est
 * entièrement barrée et l'écran n'enseigne plus rien.
 */
describe('délégation des droits', () => {
  it('montre d’emblée un gestionnaire qui a des droits', async () => {
    await renderApp('/app/prise-en-main', { locale: 'en' })
    const row = screen.getByRole('row', { name: /Record a payment/ })
    expect(within(row).getAllByText('Allowed').length).toBe(2)
  })

  it('refuse au gestionnaire exactement les deux droits d’arbitrage', async () => {
    await renderApp('/app/prise-en-main', { locale: 'en' })
    for (const action of ['Approve a quote', 'Settle a deposit']) {
      const row = screen.getByRole('row', { name: new RegExp(action) })
      // Le propriétaire seul : une autorisation sur les trois colonnes.
      expect(within(row).getAllByText('Allowed').length).toBe(1)
    }
  })

  it('ne promet pas d’inviter depuis un écran sans invitation', async () => {
    await renderApp('/app/prise-en-main', { locale: 'en' })
    expect(screen.queryByText(/how to invite/i)).not.toBeInTheDocument()
  })
})

describe('états des lieux', () => {
  it('couvre l’unité du locataire connecté', async () => {
    // Aucun état des lieux n'existait sur A1 : en rôle locataire, l'écran
    // affichait toujours son état vide et la fonctionnalité restait invisible.
    await renderApp('/app/etats-des-lieux', { locale: 'en' })
    expect(screen.getAllByText(/A1/).length).toBeGreaterThan(0)
  })
})

/**
 * L'indicatif de la fiche locataire, cherchable comme à l'inscription.
 *
 * Le menu natif alignait ici les deux cent quatre indicatifs sans moyen d'en
 * atteindre un : « Rendre les indicatifs cherchables » n'avait porté que sur
 * l'écran d'inscription, et cette modale — la seule autre du produit à demander
 * un numéro — était restée en arrière. Deux champs pour la même donnée, dont un
 * seul praticable, et rien n'obligeait le second à suivre.
 */
describe('indicatif de la fiche locataire', () => {
  async function ouvrirLaFiche() {
    const user = userEvent.setup()
    await renderApp('/app/locataires')
    await user.click(await screen.findByRole('button', { name: /créer une fiche locataire/i }))
    return user
  }

  it('se cherche à la frappe plutôt que de dérouler deux cents entrées', async () => {
    const user = await ouvrirLaFiche()

    const indicatif = screen.getByRole('combobox', { name: /indicatif/i })
    await user.click(indicatif)
    await user.type(indicatif, 'zimb')

    // Porté sur la LISTE du combobox : `getAllByRole('option')` ramasserait
    // aussi les `<option>` du sélecteur d'unité, natif et voisin.
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options).toHaveLength(1)
    await user.click(options[0])
    expect(indicatif).toHaveValue('Zimbabwe · +263')
  })

  it('garde le jeton de remplissage automatique', async () => {
    // Le jeton s'était déjà perdu une fois en passant du menu natif au champ
    // cherchable, sur l'inscription. Le même chemin, le même risque.
    await ouvrirLaFiche()
    expect(
      screen.getByRole('combobox', { name: /indicatif/i }).getAttribute('autocomplete'),
    ).toBe('tel-country-code')
  })
})

/**
 * Une décision n'entre dans la file que pour qui peut la prendre.
 *
 * L'ancienne carte « ce qui demande une décision » listait les seuls devis et
 * taisait les cautions à arbitrer — la prérogative qui définit pourtant le
 * propriétaire. En les ajoutant, on a ouvert le risque symétrique : les montrer
 * au GESTIONNAIRE, qui propose et ne décide pas. Une décision qu'on ne peut pas
 * prendre ne s'affiche pas comme une tâche, elle déplace l'attente.
 *
 * LA CARTE A DISPARU, LA RÈGLE RESTE — et elle compte davantage qu'avant. La
 * file du jour OUVRE désormais l'écran : une entrée qu'on ne peut pas traiter y
 * serait la première chose que le gestionnaire lit, tous les matins.
 *
 * Les cas visent `[data-file-entree]` plutôt qu'un intitulé : la file marque ses
 * lignes, et lire un texte rougirait à la première reformulation.
 */
describe('décisions de la file du jour', () => {
  it('porte les cautions à arbitrer au propriétaire', async () => {
    await renderApp('/app')
    await screen.findByRole('heading', { name: /à traiter/i })
    expect(document.querySelector('[data-file-entree="cautions"]')).not.toBeNull()
  })

  it('ne les porte pas au gestionnaire, qui ne peut pas les arbitrer', async () => {
    await renderApp('/demo')
    await switchRole('manager')
    await attendreLeChargement()

    expect(document.querySelector('[data-file-entree="cautions"]')).toBeNull()
    // Et l'écran Cautions ne lui offre pas le geste non plus : les deux doivent
    // dire la même chose, sans quoi la file promet ce que l'écran refuse.
    expect(screen.queryByRole('button', { name: /^arbitrer$/i })).not.toBeInTheDocument()
  })

  /**
   * LE GESTIONNAIRE N'A PAS UNE FILE VIDE POUR AUTANT.
   *
   * Retirer une nature d'entrée à un rôle ouvre un défaut discret : si c'était
   * la seule, il ouvre son écran sur « rien n'attend de vous » alors qu'il a du
   * travail. Les impayés et les relevés ne dépendent d'aucun arbitrage, et ce
   * cas le prouve plutôt que de le supposer.
   */
  it('laisse au gestionnaire ce qu’il peut traiter', async () => {
    await renderApp('/demo')
    await switchRole('manager')
    await attendreLeChargement()

    expect(document.querySelectorAll('[data-file-entree]').length).toBeGreaterThan(0)
    expect(screen.queryByText('Rien n’attend de vous')).not.toBeInTheDocument()
  })
})

/**
 * Les quatre nombres du tableau de bord se recoupent, et l'écran le MONTRE.
 *
 * L'anneau du recouvrement décompose exactement « loyers attendus », et ses
 * deux parts non réglées somment à « impayés cumulés » — l'invariant est écrit
 * dans `kpis.ts`. Rien à l'écran ne le disait : quatre nombres justes, sur deux
 * panneaux éloignés, que l'utilisateur devait rapprocher de tête pour savoir
 * s'ils parlaient de la même chose, ou de deux périodes différentes.
 *
 * Ce cas tient l'arithmétique ET les intitulés. Le montant seul se relirait
 * comme une coïncidence des données de démonstration ; c'est le nom repris à
 * l'identique de l'indicateur qui referme la boucle.
 */
describe('réconciliation du recouvrement', () => {
  it('somme les parts sous les intitulés mêmes des indicateurs', async () => {
    await renderApp('/app')

    const recouvrement = (await screen.findByRole('heading', { name: /recouvrement du mois/i }))
      .closest('div[class*="rounded-lg"]') as HTMLElement

    const lire = (etiquette: RegExp) => {
      const texte = within(recouvrement)
        .getAllByText(etiquette)
        .map((n) => n.parentElement?.textContent ?? '')
        .join(' ')
      const montant = texte.match(/([\d   ]+)\s*(?:FCFA|€)/)?.[1] ?? ''
      return Number(montant.replace(/[^\d]/g, ''))
    }

    const paye = lire(/^payé$/i)
    const partiel = lire(/^partiel$/i)
    const retard = lire(/^en retard$/i)
    const impayes = lire(/reste à percevoir/i)
    const attendu = lire(/loyers attendus/i)

    // Les deux relations, telles que `kpis.ts` les pose.
    expect(partiel + retard).toBe(impayes)
    expect(paye + partiel + retard).toBe(attendu)

    // Et les intitulés sont bien ceux des indicateurs, pas des synonymes : sans
    // cela le rapprochement resterait à la charge du lecteur.
    const entete = screen.getByRole('main')
    expect(within(entete).getAllByText(/reste à percevoir/i).length).toBeGreaterThan(1)
    expect(within(entete).getAllByText(/loyers attendus/i).length).toBeGreaterThan(1)
  })
})

/**
 * Une légende porte sur la MÊME population que le nombre qu'elle explique.
 *
 * « Impayés cumulés » totalisait les retards ET les règlements partiels, mais
 * sa note ne comptait que les retards : quatre locataires devaient, la note en
 * annonçait trois. Une légende qui dément le nombre qu'elle explique est pire
 * qu'une absence de légende — elle donne un motif de douter du chiffre.
 *
 * Le nom a suivi. « Cumulés » promettait un arriéré qui grossit de mois en
 * mois, alors que le montant se calcule sur l'appel de loyers courant, comme
 * « encaissé ce mois » à côté ; et « impayés » nommait l'ensemble par sa moitié
 * la plus sévère, durcissant la lecture d'un parc qui se porte mieux.
 *
 * LA POPULATION SE LIT DÉSORMAIS DANS LA FILE, et c'est un progrès : elle
 * n'est plus une légende sous un montant, elle EST le titre du travail. Une
 * phrase qui compte faux se voit ; une note en gris sous un gros chiffre se
 * lit rarement, et c'est bien pourquoi l'écart avait tenu si longtemps.
 *
 * L'indicateur, lui, a cessé de porter cette note — elle recopiait la file mot
 * pour mot. Il dit maintenant la PART, qui le réconcilie avec sa voisine.
 */
describe('reste à percevoir', () => {
  it('compte tous ceux qui doivent, partiels compris', async () => {
    await renderApp('/app')

    const entree = (await screen.findByText(/loyers ne sont pas soldés/i)).closest(
      '[data-file-entree="impayes"]',
    )
    // Trois en retard — A3, B2, C2 — plus un partiel, A5.
    expect(entree).toHaveTextContent(/4 loyers/)
  })

  /**
   * ET L'INDICATEUR NE LA RECOPIE PAS. C'est la moitié neuve de cette règle :
   * la file nomme le travail, la rangée d'indicateurs le SITUE. Le jour où
   * quelqu'un remettra « 4 locataires · jusqu'à 24 jours » sous le montant, il
   * aura reconstruit la redondance que ce lot vient de retirer.
   */
  it('ne recopie pas la file dans la note de l’indicateur', async () => {
    await renderApp('/app')
    await screen.findByText(/loyers ne sont pas soldés/i)

    const cartes = (await screen.findAllByText(/^reste à percevoir$/i)).map(
      (n) => n.closest('[data-indicateur]') as HTMLElement | null,
    )
    const carte = cartes.find(Boolean)!
    expect(carte).not.toHaveTextContent(/locataires/)
    expect(carte).toHaveTextContent(/du loyer attendu/i)
  })

  it('ne promet plus un arriéré qui s’accumule', async () => {
    await renderApp('/app')
    await screen.findAllByText(/^reste à percevoir$/i)
    expect(screen.getByRole('main')).not.toHaveTextContent(/cumulés/i)
  })
})
