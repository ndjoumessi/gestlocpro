import { describe, expect, it } from 'vitest'
import { renderApp, screen, attendreLeChargement } from '@/test/render'
import { VERSION_STOCKAGE } from './persistence'
import { BUILDINGS } from './portfolio'

/**
 * UN ENREGISTREMENT LOCAL DONT LES LIENS NE RÉSOLVENT PAS EST REFUSÉ.
 *
 * ═══ CE QUE LA PRODUCTION RENDAIT, MESURÉ AU VOLET NAVIGATEUR LE 2026-10-07 ═══
 *
 * Sur <https://gestlocpro.vercel.app/demo/parc>, à 1440 px, SANS session
 * (`/api/auth/me` → 401, aucun appel `/portfolio` émis) :
 *
 *     sous-titre     « 3 immeubles, 3 unités. »
 *     CINQ groupes, et non trois
 *       · Résidence Bonamoussadi  — aucun logement
 *       · Immeuble Akwa Nord      — aucun logement
 *       · Villa Deïdo             — aucun logement
 *       · (SANS NOM)  1/1   → B1, un nom de personne en capitales
 *       · (SANS NOM)  1/2   → A1 un second nom, B2
 *
 * `localStorage['gestlocpro.portfolio']` portait trois unités d'un parc RÉEL —
 * identifiants en UUID, `buildingId` en UUID, noms de locataires — à la version
 * COURANTE du format. `EtatPersiste` enregistre `units`, `works` et `deposits`,
 * **jamais `buildings`** : les unités réelles reviennent donc par-dessus les
 * immeubles de la fixture, aucun `buildingId` ne résout, les trois immeubles
 * nommés disent « aucun logement », et `buildingById(id)?.name ?? ''` rend la
 * chaîne vide pour les groupes qui portent les vraies personnes.
 *
 * ═══ POURQUOI LA GARDE EXISTANTE NE LE VOYAIT PAS ═══
 *
 * `CHAMPS_REQUIS` nomme `buildingId` depuis le lot qui a vu « Trois immeubles,
 * douze unités » en titre et `0/0` dans chaque carte — l'en-tête de cette
 * constante décrit le symptôme mot pour mot. Mais son remède vérifie que le
 * champ est **PRÉSENT**. Un enregistrement de parc réel le porte : ce sont de
 * vrais UUID, et il passe `formeValide` sans réserve. La forme était contrôlée,
 * l'ANCRAGE jamais.
 *
 * ═══ POURQUOI PAS L'INCRÉMENT DE VERSION, QUI PURGE AUSSI ═══
 *
 * La version 11 a été incrémentée pour purger exactement ces enregistrements, et
 * son en-tête écrivait « l'écriture est fermée là-bas, ce qui suffit pour
 * demain ». La mesure de production porte la version 11 : ce dossier a donc été
 * écrit APRÈS cette purge, par le code en cours. Une purge suppose qu'on a
 * trouvé toutes les voies d'écriture ; un refus à la LECTURE est vrai quelle
 * qu'en soit la voie, y compris celle qu'on n'a pas encore trouvée.
 *
 * C'est pourquoi ce cas lit `VERSION_STOCKAGE` au lieu d'un nombre : il
 * continuera de mesurer le refus après le prochain incrément, au lieu de passer
 * au vert parce que la version a bougé sous lui.
 *
 * ═══ POURQUOI 768 px, QUAND LA PRODUCTION A ÉTÉ MESURÉE À 1440 ═══
 *
 * Le même enregistrement, posé dans quatre largeurs, rend en jsdom :
 *
 *      375 px   5 groupes  [Bonamoussadi | Akwa Nord | Deïdo | "" | ""]   nom rendu
 *      768 px   5 groupes  [Bonamoussadi | Akwa Nord | Deïdo | "" | ""]   nom rendu
 *     1024 px   3 groupes  [Bonamoussadi | Akwa Nord | Deïdo]             nom ABSENT
 *     1440 px   3 groupes  [Bonamoussadi | Akwa Nord | Deïdo]             nom ABSENT
 *
 * Au-dessus de `md` l'écran passe au TABLEAU, et jsdom n'en rend aucune rangée —
 * le pied annonce pourtant « Total · 3 lignes » et le loyer des trois unités
 * restaurées. Les données sont donc bien là ; c'est leur affichage qui manque à
 * l'environnement de test, pas au produit : la production, elle, les montre à
 * 1440. Mesurer ce cas à 1440 le rendrait VERT sans rien garder — exactement la
 * vacuité contre laquelle la ligne « Charles Ngassa » plus bas existe.
 *
 * LA LARGEUR N'EST POUR RIEN DANS LA CAUSE : le refus se décide dans
 * `loadState`, avant qu'aucun composant ne rende. 768 px est le point de mesure,
 * pas le périmètre du défaut.
 *
 * ═══ LES NOMS SONT FICTIFS, ET C'EST DÉLIBÉRÉ ═══
 *
 * La production portait de vraies personnes. Les recopier ici déplacerait la
 * fuite du `localStorage` vers le dépôt — une adresse publique de plus. Ce qui
 * est reproduit est la FORME : identifiants en UUID, `buildingId` en UUID
 * étranger à la fixture, noms en capitales.
 */

/** Immeubles d'un parc réel : des UUID, qu'aucun immeuble de démonstration ne porte. */
const IMMEUBLE_REEL_UN = '6f681652-eed9-49c6-85c1-11488cff0194'
const IMMEUBLE_REEL_DEUX = 'b14421e9-428a-4157-b8eb-d6eeed6cc649'

const OCCUPANT_UN = 'NDONGO PATRICE'
const OCCUPANT_DEUX = 'MBALLA JUSTINE'
const TELEPHONE_REEL = '+237 6 99 41 07 23'

/**
 * Les trois collections sont peuplées, et ce n'est pas de la décoration.
 *
 * `formeValide` rejette toute collection VIDE — « une collection vide signale un
 * enregistrement corrompu ». Un enregistrement sans travaux ni cautions se
 * ferait donc purger pour une raison qui n'est pas celle qu'on mesure, et le cas
 * passerait au vert sans qu'une ligne ait été corrigée.
 */
function enregistrementDUnParcReel() {
  const unite = (id: string, buildingId: string, label: string, tenant: string | null) => ({
    id,
    buildingId,
    label,
    type: 'T2',
    surface: 52,
    rent: 90000,
    tenant,
    phone: tenant ? TELEPHONE_REEL : null,
    leaseStart: tenant ? { year: 2025, month: 2, day: 1 } : null,
    paid: tenant ? 90000 : 0,
    status: tenant ? 'paid' : 'vacant',
  })
  return {
    version: VERSION_STOCKAGE,
    etat: {
      units: [
        unite('cf226668-7763-4396-9b61-89b44058cb61', IMMEUBLE_REEL_UN, 'B1', OCCUPANT_UN),
        unite('5d2665cd-eda5-4d9d-acee-d447699b9194', IMMEUBLE_REEL_DEUX, 'A1', OCCUPANT_DEUX),
        unite('dafbf8f8-de1a-4ce0-9e88-5641997c137c', IMMEUBLE_REEL_DEUX, 'B2', null),
      ],
      works: [
        {
          id: '0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
          unitId: 'cf226668-7763-4396-9b61-89b44058cb61',
          titleKey: 'sinkLeak',
          trade: 'plumbing',
          status: 'reported',
          quotedAmount: null,
          approvedAmount: null,
          reportedAt: { year: 2026, month: 8, day: 3 },
          urgent: false,
          origin: 'tenantReport',
          reportedBy: OCCUPANT_UN,
        },
      ],
      deposits: [
        {
          unitId: 'cf226668-7763-4396-9b61-89b44058cb61',
          tenant: OCCUPANT_UN,
          held: 180000,
          withheld: 0,
          status: 'held',
        },
      ],
    },
  }
}

const NOMINATIF = [OCCUPANT_UN, OCCUPANT_DEUX, TELEPHONE_REEL]

/** Les en-têtes de groupe, lus par `data-groupe` comme le font les gardes voisines. */
function groupes() {
  return Array.from(document.querySelectorAll('[data-groupe]'))
}

describe('la démonstration refuse un enregistrement qui ne s’ancre pas dans son parc', () => {
  const poser = () =>
    window.localStorage.setItem(
      'gestlocpro.portfolio',
      JSON.stringify(enregistrementDUnParcReel()),
    )

  it('ne rend aucun nom de locataire venu d’un enregistrement étranger', async () => {
    poser()
    await renderApp('/demo/parc', { largeur: 768 })
    await attendreLeChargement()

    const main = screen.getByRole('main')

    /* L'ÉCRAN A BIEN RENDU UN PARC — sans cette ligne, un `/demo/parc` tombé en
       panne satisferait les trois négations suivantes par vacuité. Le jeu de
       démonstration doit être revenu, locataires fictifs compris. */
    expect(main).toHaveTextContent('Charles Ngassa')

    for (const trace of NOMINATIF) expect(main, trace).not.toHaveTextContent(trace)
  })

  it('ne rend aucun groupe anonyme, et rattache ses logements aux immeubles nommés', async () => {
    poser()
    await renderApp('/demo/parc', { largeur: 768 })
    await attendreLeChargement()

    /* Trois immeubles de démonstration, donc trois groupes : la production en
       rendait CINQ, les deux de trop étant ceux dont le nom est vide. */
    expect(groupes()).toHaveLength(BUILDINGS.length)
    for (const groupe of groupes()) {
      expect(groupe.querySelector('h3')?.textContent?.trim() ?? '').not.toBe('')
    }
  })

  it('efface la clé plutôt que de la laisser resservir au prochain chargement', async () => {
    poser()
    await renderApp('/demo/parc', { largeur: 768 })
    await attendreLeChargement()

    /* Un refus qui laisse l'enregistrement en place ne ferme rien : le nom part
       de l'écran, les données personnelles restent sur l'appareil, et le
       chargement suivant les relit. `loadState` supprime déjà la clé sur une
       version périmée ; l'ancrage doit suivre la même règle. */
    expect(window.localStorage.getItem('gestlocpro.portfolio')).toBeNull()
  })

  /**
   * ET `/demo/locataires`, À 1440 px — LÀ OÙ LA PRODUCTION A ÉTÉ MESURÉE.
   *
   * Les cas ci-dessus mesurent à 768 px parce que `/demo/parc` au-dessus de `lg`
   * ne rend plus les logements orphelins : `parcEnCartes` ne parcourt que
   * `ordreDesImmeubles`, bâti depuis `BUILDINGS` seul. Ils y DISPARAISSENT, sans
   * un mot, pendant que le sous-titre les compte encore.
   *
   * Cet écran-ci, lui, lit `units` directement. Les noms et le TÉLÉPHONE y sont
   * donc rendus à la largeur même de la capture de production — mesuré sur le
   * code d'avant ce lot : « NDONGO PATRICE + MBALLA JUSTINE + +237 6 99 41 07 23 »
   * dans le `main` de `/demo/locataires` à 1440 px.
   *
   * SANS CE CAS, LA GARDE SE MESURERAIT AILLEURS QUE LA FUITE. 1 440 px est la
   * largeur où un visiteur de bureau ouvre cette adresse, et c'est précisément
   * celle où `/demo/parc` ne montre plus rien — donc celle où une garde posée
   * sur le seul parc passerait au vert en laissant les noms à l'écran d'à côté.
   */
  it('ne rend aucun nom ni téléphone sur `/demo/locataires` à 1440 px', async () => {
    poser()
    await renderApp('/demo/locataires', { largeur: 1440 })
    await attendreLeChargement()

    const main = screen.getByRole('main')

    /* L'ÉCRAN A BIEN RENDU DES LOCATAIRES — sans quoi la négation qui suit
       passerait par vacuité, comme elle l'a fait pour les groupes anonymes à
       1440 px dans la première rédaction de ce fichier. */
    expect(main).toHaveTextContent('Charles Ngassa')

    for (const trace of NOMINATIF) expect(main, trace).not.toHaveTextContent(trace)
  })
})
