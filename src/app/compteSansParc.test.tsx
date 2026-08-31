import { describe, expect, it } from 'vitest'
import { renderApp, screen, waitFor } from '@/test/render'
import { installerFauxServeur } from '@/test/api'

/**
 * UN COMPTE SANS PARC NE VOIT PAS LA DÉMONSTRATION.
 *
 * ═══ CE QUI ÉTAIT MONTRÉ, ET C'EST GRAVE ═══
 *
 * `PortfolioProvider` monte le jeu de démonstration comme état INITIAL, et ne
 * demande le serveur que si `parkId` existe. Un compte sans adhésion — celui
 * d'un gestionnaire qui vient de s'inscrire et dont le code n'est pas encore
 * consommé — gardait donc ce jeu, sous `/app`, sans rien qui le dise.
 *
 * Signalé sur la production, capture à l'appui : « je me suis log in comme
 * gestionnaire, je vois des données que je n'ai pas insérées ». Trois immeubles,
 * douze unités, 2 932 128 FCFA à percevoir, des cautions à arbitrer, un devis à
 * valider. Rien de tout cela n'existe.
 *
 * L'en-tête du fournisseur assumait ce repli — « sans parc, le jeu de
 * démonstration reste servi, exactement comme avant ». C'est juste sous
 * `/demo`, dont c'est le propos. Sous `/app`, la même donnée devient un
 * mensonge : l'adresse promet un espace réel.
 *
 * ═══ ET IL N'AVAIT AUCUNE SORTIE ═══
 *
 * La carte « rejoindre un parc par code » vit sur « Prise en main et droits »,
 * réservée au PROPRIÉTAIRE. Un gestionnaire sans parc ne pouvait donc ni voir
 * ses vraies données — il n'en a pas — ni saisir le code qui lui en donnerait.
 * Il tournait dans une démonstration en se croyant chez lui.
 */
/**
 * `session: null` — ON LAISSE LA SESSION SE RÉSOUDRE, comme en production.
 *
 * Injecter un état tout fait ne conviendrait pas ici : la coquille n'affirme
 * « aucun parc » que sur un état REÇU du serveur — voir `sessionResolue`. Un
 * état posé par le harnais ne dit rien, et c'est délibéré : la moitié de la
 * suite de ce dépôt monte des écrans de `/app` sur une session sans adhésion,
 * qu'elle utilise comme fixture. Ces cas-ci passent donc par `/auth/me`, dont
 * la réponse par défaut du faux serveur est exactement notre sujet — un compte
 * valide, `memberships: []`.
 */
const RESOLUE: { session: null } = { session: null }

describe('l’espace d’un compte qui n’appartient à aucun parc', () => {
  it('ne montre AUCUN chiffre de démonstration', async () => {
    installerFauxServeur()
    await renderApp('/app', RESOLUE)
    /* ON ATTEND UN ÉCRAN ARRÊTÉ avant de constater une absence : asserter sur
       un DOM encore en chargement rendrait ces cas verts pour la mauvaise
       raison, et ils le resteraient le jour où le défaut revient. */
    await screen.findByRole('heading', { name: /aucun parc/i })

    const page = document.body.textContent ?? ''
    /* Les repères du jeu de démonstration, choisis parce qu'ils ne peuvent pas
       apparaître ailleurs : le nombre d'immeubles semés et le montant total. */
    expect(page, 'la démonstration est servie comme un vrai parc').not.toMatch(/3 immeubles/)
    expect(page).not.toMatch(/2 932 128|2932128/)
  })

  it('dit pourquoi, et offre la seule porte qui existe : le code', async () => {
    installerFauxServeur()
    await renderApp('/app', RESOLUE)

    expect(
      await screen.findByRole('heading', { name: /aucun parc/i }),
      'l’écran ne dit pas que le compte n’appartient à aucun parc',
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/code d’invitation/i),
      'aucune porte : le code d’invitation ne se saisit nulle part',
    ).toBeInTheDocument()
  })

  it('vaut pour TOUTE adresse sous /app, pas seulement l’accueil', async () => {
    /* Sans cela, `/app/paiements` continuerait de rendre les encaissements de
       la démonstration — et c'est l'écran où un chiffre faux coûte le plus. */
    installerFauxServeur()
    await renderApp('/app/paiements', RESOLUE)
    expect(await screen.findByRole('heading', { name: /aucun parc/i })).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/2 932 128|2932128/)
  })

  it('ne garde AUCUNE navigation vers des écrans qui n’existent pas pour lui', async () => {
    /* La capture du signalement montre « Paiements 3 » et « Signalements 3 »
       dans la barre latérale : deux PASTILLES comptées sur le jeu de
       démonstration. Vider le cadre sans vider la navigation aurait laissé le
       mensonge à l'endroit le plus visible, et douze entrées menant toutes au
       même écran vide. */
    installerFauxServeur()
    await renderApp('/app', RESOLUE)
    await screen.findByRole('heading', { name: /aucun parc/i })

    expect(
      screen.queryByRole('link', { name: /paiements/i }),
      'la barre latérale mène encore aux écrans d’un parc qui n’existe pas',
    ).toBeNull()
    expect(screen.queryByRole('link', { name: /cautions/i })).toBeNull()
  })
})

describe('la démonstration elle-même', () => {
  it('garde son jeu, puisque c’est tout son propos', async () => {
    /* LE CAS QUI EMPÊCHE LE CORRECTIF D'ALLER TROP LOIN. Vider le fournisseur
       partout où `parkId` est nul viderait aussi `/demo`, qui n'a jamais de
       `parkId` — et la démonstration est le premier écran que voit un
       prospect. */
    installerFauxServeur({ authentifie: false })
    await renderApp('/demo')
    /* La démonstration simule une attente : on la laisse aboutir plutôt que de
       constater son contenu sur un squelette. */
    await waitFor(() =>
      expect(document.body.textContent ?? '', 'la démonstration a perdu son parc').toMatch(
        /3 immeubles/,
      ),
    )
  })
})
