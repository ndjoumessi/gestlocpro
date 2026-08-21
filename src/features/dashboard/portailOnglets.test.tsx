import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, attendreLeChargement } from '@/test/render'

/**
 * Motif ARIA des onglets du portail locataire.
 *
 * Les rôles `tablist` / `tab` étaient déclarés sans rien de ce qu'ils
 * annoncent : ni flèches, ni `tabindex` roulant, ni `aria-controls`, ni
 * panneau. Un lecteur d'écran promettait donc une navigation par flèches qui
 * n'existait pas — strictement pire qu'une rangée de boutons ordinaires, qui
 * au moins ne promet rien. Ces tests tiennent la promesse.
 *
 * Le BORNAGE plutôt que le bouclage suit la convention du dépôt, posée par
 * `Combobox` : arriver au bout et se retrouver au début désoriente plus que
 * cela n'aide. L'APG laisse le choix ; le produit n'en a qu'un.
 */
async function ouvrirPortail() {
  const user = userEvent.setup()
  await renderApp('/demo/portail')
  const onglets = screen.getAllByRole('tab')
  return { user, onglets }
}

/**
 * Le portail, ses écrans CHARGÉS.
 *
 * Les onglets sont là au premier rendu — ils appartiennent à la coquille —
 * mais les écrans qu'ils montent passent par leurs squelettes. Les cas d'ARIA
 * n'ont pas à payer cette attente : eux n'interrogent que la coquille.
 */
async function ouvrirPortailCharge() {
  const rendu = await ouvrirPortail()
  await attendreLeChargement()
  return rendu
}

describe('onglets du portail — structure ARIA', () => {
  it('lie chaque onglet à un panneau, et le panneau en retour', async () => {
    const { onglets } = await ouvrirPortail()
    expect(onglets.length).toBeGreaterThan(1)

    const actif = onglets.find((o) => o.getAttribute('aria-selected') === 'true')!
    const panneau = screen.getByRole('tabpanel')
    expect(actif.getAttribute('aria-controls')).toBe(panneau.id)
    expect(panneau.getAttribute('aria-labelledby')).toBe(actif.id)
  })

  it('n’offre qu’un seul arrêt de tabulation pour tout le groupe', async () => {
    const { onglets } = await ouvrirPortail()
    const arrets = onglets.filter((o) => o.getAttribute('tabindex') === '0')
    expect(arrets).toHaveLength(1)
    expect(arrets[0].getAttribute('aria-selected')).toBe('true')
    for (const autre of onglets.filter((o) => o !== arrets[0]))
      expect(autre.getAttribute('tabindex')).toBe('-1')
  })
})

describe('onglets du portail — navigation au clavier', () => {
  it('déplace la sélection et le focus aux flèches', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()

    await user.keyboard('{ArrowRight}')
    expect(onglets[1]).toHaveFocus()
    expect(onglets[1].getAttribute('aria-selected')).toBe('true')
    expect(onglets[0].getAttribute('aria-selected')).toBe('false')

    await user.keyboard('{ArrowLeft}')
    expect(onglets[0]).toHaveFocus()
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
  })

  it('borne aux extrémités au lieu de boucler', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(onglets[0]).toHaveFocus()

    const dernier = onglets[onglets.length - 1]
    dernier.focus()
    await user.keyboard('{ArrowRight}')
    expect(dernier).toHaveFocus()
  })

  it('saute aux extrémités avec Début et Fin', async () => {
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()

    await user.keyboard('{End}')
    expect(onglets[onglets.length - 1]).toHaveFocus()
    expect(onglets[onglets.length - 1].getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{Home}')
    expect(onglets[0]).toHaveFocus()
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
  })

  it('atteint le contenu de l’onglet en une seule tabulation', async () => {
    // Le `tabindex` roulant n'a de sens que s'il fait vraiment gagner les
    // quatre arrêts qu'il retire : depuis l'onglet actif, la tabulation doit
    // sortir du groupe, pas passer à l'onglet suivant.
    const { user, onglets } = await ouvrirPortail()
    onglets[0].focus()
    await user.tab()
    for (const onglet of onglets) expect(onglet).not.toHaveFocus()
  })
})

/**
 * La COQUILLE elle-même, et non plus seulement son motif ARIA.
 *
 * Les tests ci-dessus tiennent le clavier et les liaisons `aria-*` quel que
 * soit le nombre d'onglets — c'est ce qui leur a permis de survivre au passage
 * de cinq à trois sans qu'on les touche. Mais du coup, aucun d'eux ne dit
 * combien il y en a ni ce qu'ils portent : on aurait pu en rajouter deux et
 * rester au vert. Ceux-ci fixent la structure que décrivent les maquettes.
 */
describe('coquille du portail — trois onglets', () => {
  it('n’en expose que trois, et ceux-là', async () => {
    const { onglets } = await ouvrirPortail()
    expect(onglets.map((o) => o.textContent)).toEqual(['Mon espace', 'Documents', 'Signaler'])
  })

  it('ouvre « Mon espace » d’emblée', async () => {
    const { onglets } = await ouvrirPortail()
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
  })

  /**
   * Les paiements et les travaux avaient chacun leur onglet. En les repliant
   * dans « Mon espace », rien ne garantissait qu'ils y arrivent — supprimer les
   * deux `tab === '…'` aurait suffi à les faire disparaître en silence, et les
   * tests d'ARIA seraient restés verts.
   */
  it('replie les paiements et les travaux dans « Mon espace »', async () => {
    await ouvrirPortailCharge()
    expect(
      screen.getByRole('heading', { name: 'Mes paiements par période' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mes travaux en cours' })).toBeInTheDocument()
  })
})

/**
 * Le portail monte les VRAIS écrans, et non une copie.
 *
 * La copie avait fait pire que vieillir, elle avait DIVERGÉ : quatre corps de
 * métier là où `TRADES_REPORTABLE` en compte cinq — la peinture ajoutée sans
 * elle — et des urgences `high`/`medium`/`low` quand le produit ne connaît que
 * `blocking`/`normal`/`low`. Le propriétaire montrait à son locataire un
 * formulaire dont les valeurs n'existent nulle part.
 *
 * Ces cas visent donc ce que la copie N'AVAIT PAS. Viser ce qu'elle partageait
 * avec l'original ne prouverait rien : les deux l'affichaient.
 */
describe('le portail monte les vrais écrans', () => {
  it('montre dans « Mon espace » ce que la copie n’avait jamais reçu', async () => {
    await ouvrirPortailCharge()
    // Deux fonctionnalités arrivées APRÈS la copie, qui l'avaient contournée.
    expect(
      screen.getByRole('heading', { name: 'Ma consommation sur douze mois' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Mes paiements par période' }),
    ).toBeInTheDocument()
  })

  it('propose le vocabulaire du PRODUIT dans « Signaler »', async () => {
    const { user, onglets } = await ouvrirPortailCharge()
    await user.click(onglets[2]!)

    // La peinture : le cinquième métier, ajouté au produit sans que la copie
    // le sache.
    expect(screen.getByRole('radio', { name: /Peinture/ })).toBeInTheDocument()
    // Et l'urgence telle que le produit la nomme — la copie disait « Moyenne ».
    expect(screen.getByRole('radio', { name: /Normal/ })).toBeInTheDocument()
  })

  it('montre les vraies demandes de pièces dans « Documents »', async () => {
    const { user, onglets } = await ouvrirPortailCharge()
    await user.click(onglets[1]!)
    expect(
      screen.getByRole('heading', { name: 'Mes pièces et quittances' }),
    ).toBeInTheDocument()
  })

  /**
   * UN SEUL titre de niveau 1 dans la page.
   *
   * Les écrans montés portent leur `PageHeader`, qui rend un `<h1>` : trois
   * d'entre eux dans une page qui a déjà le sien en ferait quatre documents
   * pour un lecteur d'écran. Sous le cadre, ils descendent en `<h2>`.
   */
  it('ne pose qu’un seul titre de niveau 1, et c’est « Portail locataire »', async () => {
    await ouvrirPortailCharge()
    const titres = screen.getAllByRole('heading', { level: 1 })
    expect(titres).toHaveLength(1)
    expect(titres[0]).toHaveTextContent('Portail locataire')
  })

  /**
   * Le titre du document appartient à la PAGE, pas à ce qu'elle prévisualise.
   *
   * Sans cette garde, l'onglet du navigateur et l'historique porteraient
   * « Résidence Bonamoussadi — A1 » pour une page qui est la prévisualisation
   * du portail — le défaut même que `useDocumentTitle` avait été écrit pour
   * corriger.
   */
  it('laisse le titre du document à la page qui le porte', async () => {
    await ouvrirPortailCharge()
    expect(document.title).toContain('Portail locataire')
    expect(document.title).not.toContain('Bonamoussadi')
  })
})

/**
 * L'adresse du chrome de navigateur suivait l'onglet… jamais : elle était figée
 * sur « /mon-espace ». La fenêtre prétendait donc être sur l'espace du locataire
 * pendant qu'on lisait ses documents.
 */
describe('coquille du portail — adresse de démonstration', () => {
  it('suit l’onglet ouvert', async () => {
    const { user, onglets } = await ouvrirPortail()
    expect(screen.getByText('portail.gestlocpro.com/mon-espace')).toBeInTheDocument()

    await user.click(onglets[1])
    expect(screen.getByText('portail.gestlocpro.com/documents')).toBeInTheDocument()

    await user.click(onglets[2])
    expect(screen.getByText('portail.gestlocpro.com/signaler')).toBeInTheDocument()
  })
})

/**
 * Le nom et les initiales de la barre étaient écrits en dur (« CN »). L'unité
 * affichée pouvait donc changer sans que l'identité bouge — le défaut déjà
 * corrigé une fois pour le nom de l'immeuble.
 */
describe('coquille du portail — identité de la barre', () => {
  it('dérive le nom court du locataire de l’unité', async () => {
    await ouvrirPortail()
    // L'unité A1 est louée à Charles Ngassa (`DEMO_TENANT_UNIT`).
    expect(screen.getByText('Charles N.')).toBeInTheDocument()
    expect(screen.getByText('CN')).toBeInTheDocument()
  })
})
