import { describe, expect, it } from 'vitest'
import { renderApp, screen, userEvent, within } from '@/test/render'
import { installerFauxServeur } from '@/test/api'
import { PARK, SESSION_AVEC_PARC } from './noTechnicalIds.test'

/**
 * Ce que voit un compte qui vient d'être créé.
 *
 * C'est l'état EXACT du premier compte réel du produit : parc déclaré, zéro
 * immeuble, zéro logement. Aucun de ces écrans n'avait jamais été regardé dans
 * cet état — la démonstration sert toujours douze unités, et les tests
 * existants chargent un parc peuplé. Or c'est le premier écran de tout nouvel
 * utilisateur, et le seul qu'il verra tant qu'il n'aura rien saisi.
 *
 * Ce que ces cas tiennent n'est pas l'apparence mais l'ABSENCE DE FAUX : pas de
 * `NaN` né d'une division par zéro, pas d'`undefined` échappé d'un libellé, pas
 * d'écran vide au sens propre — la règle que la vitrine « États du système »
 * énonce pour tout le produit.
 */
/**
 * Toutes les clés du contrat, chacune vide.
 *
 * `notifications` et non `alerts` : la première version de ce jeu d'essai
 * employait le nom du modèle client, `chargerParc` levait sur
 * `data.notifications.map`, et le fournisseur retombait — comme il le doit — sur
 * le jeu de démonstration. L'écran affichait alors « 3 immeubles, 12 unités »
 * pour un parc vide, ce qui ressemblait à s'y méprendre à un défaut du produit.
 * C'en était un du test : une charge incomplète emprunte le chemin d'ERREUR, pas
 * celui du vide, et les deux ne se ressemblent que sur la copie d'écran.
 */
const VIDE = {
  buildings: [],
  works: [],
  collections: [],
  readings: [],
  inspections: [],
  notifications: [],
  deposits: [],
}

/** Les écrans qu'un propriétaire atteint depuis la barre latérale. */
const ECRANS = [
  '/app',
  '/app/parc',
  '/app/paiements',
  '/app/releves',
  '/app/etats-des-lieux',
  '/app/travaux',
  '/app/cautions',
  '/app/locataires',
  '/app/signalements',
  '/app/prise-en-main',
]

/** Le parc de la première journée : des murs, un logement, aucun encaissement. */
const AVEC_UN_LOGEMENT = {
  ...VIDE,
  buildings: [
    { id: 'b1', name: 'Residence A', district: 'Bastos', units: [] },
    {
      id: 'b2',
      name: 'Residence B',
      district: 'Bastos',
      units: [
        {
          id: 'u1',
          label: 'A1',
          type: 'T2',
          surfaceSqm: 100,
          rentMinor: 20000,
          tenant: null,
          status: 'vacant',
          paidMinor: 0,
          overdueDays: null,
        },
      ],
    },
  ],
}

function serveurAvecUnLogement() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: AVEC_UN_LOGEMENT })
  return serveur
}

function serveurVide() {
  const serveur = installerFauxServeur()
  serveur.quand('GET', `/parks/${PARK}/portfolio`, { status: 200, body: VIDE })
  return serveur
}

describe('parc vide, compte neuf', () => {
  for (const route of ECRANS) {
    it(`ne montre ni NaN ni undefined sur ${route}`, async () => {
      serveurVide()
      renderApp(route, { session: SESSION_AVEC_PARC })

      // On attend la fin de l'attente : juger un écran sur son squelette
      // reviendrait à ne rien juger.
      const main = await screen.findByRole('main')
      await new Promise((r) => setTimeout(r, 60))

      const texte = main.textContent ?? ''
      // `NaN %` s'affichait sur un parc vide avant que `computeKpis` ne borne
      // sa division ; c'est le genre de valeur qu'un écran neuf produit et
      // qu'un écran peuplé ne montre jamais.
      expect(texte, `${route} laisse passer un NaN`).not.toMatch(/NaN/)
      expect(texte, `${route} laisse passer un undefined`).not.toMatch(/undefined/)
      // Ni une clé de traduction non résolue.
      expect(texte, `${route} rend une clé brute`).not.toMatch(/app\.[a-z]+\.[a-zA-Z]/)
    })
  }

  it('propose une première action plutôt qu’un écran nu', async () => {
    serveurVide()
    renderApp('/app', { session: SESSION_AVEC_PARC })

    // Un parc vide n'est pas une panne : c'est un début. L'écran doit dire quoi
    // faire, pas seulement constater l'absence.
    expect(await screen.findByText(/votre parc est encore vide/i)).toBeInTheDocument()
    // Un LIEN et non un bouton : il mène à l'écran du parc, où le geste se
    // fait. Le distinguer compte — un lien s'ouvre dans un onglet, se copie, et
    // s'annonce « lien » à la synthèse vocale.
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /ajouter un immeuble/i }),
    ).toBeInTheDocument()
  })

  it('distingue « rien » de « rien qui corresponde »', async () => {
    serveurVide()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    const main = await screen.findByRole('main')
    await new Promise((r) => setTimeout(r, 60))

    // Un parc sans logement n'a pas échoué à trouver : il n'a rien à trouver.
    expect(main).toHaveTextContent(/aucun logement pour l’instant/i)
    // L'écran annonçait « Aucune unité ne correspond à «  » » — la requête vide
    // entre guillemets — et proposait de réinitialiser des filtres non posés.
    expect(main).not.toHaveTextContent(/ne correspond à/i)
    expect(main).not.toHaveTextContent(/réinitialiser les filtres/i)
  })

  it('compte le parc réel dans son sous-titre, sans réciter la démonstration', async () => {
    serveurVide()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    const main = await screen.findByRole('main')
    await new Promise((r) => setTimeout(r, 60))

    // « Trois immeubles, douze unités » était écrit en dur : les chiffres du jeu
    // de démonstration, servis à tout parc réel.
    expect(main).not.toHaveTextContent(/trois immeubles/i)
    // Le français met le SINGULIER à zéro — « 0 immeuble » — là où l'anglais
    // pluralise. C'est `Intl.PluralRules` qui tranche, pas une règle écrite à
    // la main, et le dictionnaire le documente déjà.
    expect(main).toHaveTextContent(/0 immeuble, 0 unité\./i)
  })

  it('accorde chaque nom séparément dans le sous-titre', async () => {
    /**
     * Le cas relevé sur le parc réel : deux immeubles, un seul logement,
     * affichés « 2 immeubles, 1 unités ». Les sous-titres portaient les deux
     * comptes dans un même gabarit avec une seule variante `_one` — or la
     * pluralisation se règle sur un unique `count`, et il y a deux noms à
     * accorder. Deux fragments accordés puis composés : c'est la seule forme
     * qui tienne, et elle tient aussi en anglais où zéro pluralise.
     */
    serveurAvecUnLogement()
    renderApp('/app/parc', { session: SESSION_AVEC_PARC })
    const main = await screen.findByRole('main')
    await new Promise((r) => setTimeout(r, 60))

    expect(main).toHaveTextContent(/2 immeubles, 1 unité\./i)
    expect(main).not.toHaveTextContent(/1 unités/i)
  })

  it('dit qu’il n’y a aucun encaissement, plutôt que de tracer un cadre nu', async () => {
    /**
     * Le parc n'est PAS vide — il a des murs et un logement — mais aucun
     * encaissement n'a encore été enregistré. C'est l'état de la première
     * journée, et c'est celui où le graphique apparaît : avec zéro immeuble, le
     * tableau de bord prend sa branche « parc vide » et ne le rend pas du tout.
     *
     * Un cadre d'axes sans barre n'est pas un graphique : c'est un graphique qui
     * a l'air cassé. L'écran traçait une ligne d'objectif à 0 € au-dessus d'une
     * zone vide, sans un mot.
     */
    serveurAvecUnLogement()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    const main = await screen.findByRole('main')
    await new Promise((r) => setTimeout(r, 60))

    expect(main).toHaveTextContent(/aucun encaissement pour l’instant/i)
  })

  it('n’offre pas d’enregistrer un paiement sur un parc sans logement', async () => {
    serveurVide()
    const user = userEvent.setup()
    renderApp('/app', { session: SESSION_AVEC_PARC })
    await screen.findByText(/votre parc est encore vide/i)

    // Le geste n'aurait aucune unité à créditer : l'offrir mènerait à un
    // sélecteur vide, c'est-à-dire à une impasse.
    expect(
      screen.queryByRole('button', { name: /enregistrer un paiement/i }),
    ).not.toBeInTheDocument()
    void user
  })
})
