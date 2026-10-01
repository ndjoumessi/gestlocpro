import { Button } from '@/components/primitives/Button'
import { Card } from '@/components/primitives/Card'
import { Notice } from '@/components/primitives/Notice'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRole } from '@/components/layout/AppShell'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { lien, useBase } from '@/lib/base'
import type { Role } from '@/features/auth/signupState'
import { ROLES_DOCUMENTES, cleDe, gestesDe, type Geste } from './manuelDesGestes'

/**
 * LE MANUEL D'UTILISATION — les gestes du mois, et où ils vivent.
 *
 * ═══ POURQUOI UN ÉCRAN, ET PAS UN PDF ═══
 *
 * Un PDF se périme sans que rien ne le dise : il ne compile pas, aucune porte ne
 * le mesure, et le jour où un bouton change de nom il décrit un produit qui
 * n'existe plus. Cet écran lit les MÊMES clés de libellé que les boutons qu'il
 * décrit — voir `manuelDesGestes.ts` —, donc il suit le produit sans qu'on y
 * pense, et il est balayé par les mêmes quarante portes que les autres écrans.
 *
 * ═══ POURQUOI TOUT EST DÉPLIÉ ═══
 *
 * Un manuel se CHERCHE. `Ctrl+F` ne trouve pas ce qu'un accordéon a replié, et
 * la recherche du navigateur est le premier geste de quelqu'un qui est bloqué.
 * La page est donc longue, assumée comme telle : son plafond de hauteur est un
 * relevé, pas une ambition.
 *
 * ═══ LES TROIS ÉTATS DE LA VISITE, ET IL Y EN A BIEN TROIS ═══
 *
 * La vidéo est un FICHIER EXTERNE, dont l'adresse vient de `VITE_VIDEO_DEMO` à
 * la construction. Trois états distincts, et les confondre serait la faute que
 * ce dépôt a déjà payée ailleurs :
 *
 *   1. adresse posée      → le lecteur, avec son repli pour un navigateur
 *                           qui ne sait pas lire le format ;
 *   2. adresse absente    → on le DIT, et on propose la démonstration vivante.
 *                           Un lecteur vide sous un titre qui promet une vidéo
 *                           se lit comme une panne du produit ;
 *   3. format illisible   → le contenu de `<video>`, que le navigateur peint
 *                           lui-même quand aucune source ne lui convient.
 *
 * CE QUE LES PORTES NE MESURENT PAS, ET IL FAUT L'ÉCRIRE : `VITE_VIDEO_DEMO`
 * est absente en local comme en intégration, donc toutes les portes au
 * navigateur mesurent l'ÉTAT 2. La géométrie du lecteur n'est vérifiée par
 * aucune d'elles. C'est le prix d'un fichier qui ne vit pas dans le dépôt, et il
 * est payé en connaissance de cause : un WebM de plusieurs mégaoctets dans
 * `public/` — 76 Ko aujourd'hui — changerait ce que chaque visiteur télécharge.
 */

/* Le nom du rôle, pris là où l'écran des accès le peint déjà. Trois clés
   littérales plutôt qu'un gabarit : `MessageKey` les vérifie une par une. */
const NOM_DU_ROLE: Record<Role, MessageKey> = {
  owner: 'app.access.role_owner',
  manager: 'app.access.role_manager',
  tenant: 'app.access.role_tenant',
}

/**
 * L'adresse de la visite, lue à la construction.
 *
 * `trim()` PUIS `|| null` : une variable posée mais vide — ce que rend un
 * `VITE_VIDEO_DEMO=` sans valeur dans un fichier d'environnement — vaut
 * « absente », et non « adresse vide » qui ferait réclamer une ressource à la
 * racine du site. Trois états, pas deux ; voir l'en-tête.
 */
function adresseDeLaVisite(): string | null {
  const brut = import.meta.env.VITE_VIDEO_DEMO
  return typeof brut === 'string' && brut.trim() !== '' ? brut.trim() : null
}

/** Un geste expliqué : son nom tel que l'écran le peint, et ce à quoi il sert. */
function LigneDeGeste({ geste }: { geste: Geste }) {
  const { t } = useI18n()
  /*
    LE NOM DU GESTE EST CELUI DU BOUTON, et quand il n'y a pas de bouton c'est
    celui de l'écran. Un geste de consultation — le registre des décisions,
    l'espace du locataire — n'a rien à cliquer : lui inventer un intitulé
    d'action ferait chercher une commande absente.
  */
  const nom = geste.gesteKey ? t(geste.gesteKey) : t(geste.ecranKey)

  return (
    <li className="border-t border-divider py-3 first:border-t-0 first:pt-0">
      <p className="text-label font-semibold text-ink">{nom}</p>
      <p className="mt-1 max-w-[65ch] text-body text-muted">{t(geste.phraseKey)}</p>
    </li>
  )
}

/**
 * LES GESTES, RANGÉS PAR ÉCRAN SANS QUITTER L'ORDRE DU MOIS.
 *
 * ═══ DEUX RENDUS, ET LA LONGUEUR LES A IMPOSÉS — MESURÉE TROIS FOIS ═══
 *
 * `nomsSeuls` est le rendu de la section « les autres rôles ». Il a été obtenu
 * en corrigeant trois fois ce que la page mesurait vraiment :
 *
 *   1. TOUT EXPLIQUÉ, PARTOUT — 7 343 px à 1280. Un propriétaire lisait les
 *      vingt-deux paragraphes du gestionnaire après les avoir lus dans les
 *      siens, mot pour mot.
 *   2. EXPLIQUÉ SAUF CE QUE LE LECTEUR FAIT DÉJÀ — 6 253 px, et encore FAUX : le
 *      locataire ne partage AUCUN geste avec le bailleur, sa page recevait donc
 *      les quarante-neuf paragraphes de la gestion en entier, 7 365 px. Une règle
 *      qui ne tient que pour deux rôles sur trois n'est pas une règle.
 *   3. NOMMÉ, JAMAIS EXPLIQUÉ, ET SANS BOUTON D'ÉCRAN. On ne va pas sur l'écran
 *      des paiements pour faire le travail du gestionnaire : on lit ce qu'il y
 *      fait. Le bouton invitait à un geste qui n'est pas celui du lecteur.
 *
 * La règle est donc la même pour tous : dans « vos gestes », on EXPLIQUE ; dans
 * « les autres rôles », on NOMME.
 *
 * ═══ CE QUE LA PREMIÈRE RÉDACTION DONNAIT À LIRE ═══
 *
 * Un bouton « Ouvrir Parc immobilier » SOUS CHAQUE GESTE : quatre fois d'affilée
 * pour les quatre gestes du parc, cinq fois pour ceux des paiements. Vu à
 * l'écran, pas déduit. La répétition n'était pas seulement laide — elle noyait
 * le seul élément qui change d'une ligne à l'autre, le geste lui-même.
 *
 * ═══ POURQUOI DES SUITES, ET NON UN REGROUPEMENT ═══
 *
 * On regroupe les gestes CONSÉCUTIFS du même écran, et pas tous les gestes d'un
 * même écran. Trier par écran donnerait l'ordre de la barre latérale, qui est
 * celui du produit ; le registre, lui, est rangé dans l'ordre du MOIS — on monte
 * son parc, on encaisse, on relance, on reloue — et c'est cet ordre qui apprend
 * quelque chose. Le parc revient donc deux fois, une fois pour le monter et une
 * fois pour la vie du bail, ce qui est juste : ce ne sont pas les mêmes moments.
 */
function GroupeDeGestes({
  gestes,
  nomsSeuls = false,
}: {
  gestes: readonly Geste[]
  /** Section « les autres rôles » : on nomme, on n'explique pas. */
  nomsSeuls?: boolean
}) {
  const { t } = useI18n()
  const base = useBase()

  /* Les suites d'adresse identique, dans l'ordre où elles viennent. */
  const suites: Geste[][] = []
  for (const g of gestes) {
    const derniere = suites[suites.length - 1]
    if (derniere && derniere[0]!.adresse === g.adresse) derniere.push(g)
    else suites.push([g])
  }

  /*
    EN MODE « NOMS SEULS », PAS DE BOUTON D'ÉCRAN — et ce n'est pas une économie
    de place, c'est une question qui ne se pose pas. On ne va pas sur l'écran des
    paiements pour faire le travail du gestionnaire ; on lit ce qu'il y fait. Le
    bouton était une invitation à un geste qui n'est pas le sien.

    Son retrait a fait tomber la page de 5 485 à ce qu'elle mesure aujourd'hui —
    douze en-têtes et douze boutons en moins par rôle, pour la même information.
  */
  if (nomsSeuls) {
    return (
      <dl className="flex flex-col gap-2">
        {suites.map((suite) => {
          const tete = suite[0]!
          return (
            <div key={`${tete.adresse}-${cleDe(tete)}`} className="max-w-[80ch]">
              <dt className="inline text-label font-semibold text-ink">{t(tete.ecranKey)}</dt>
              <dd className="inline text-body text-muted">
                {' — '}
                {suite.map((g) => (g.gesteKey ? t(g.gesteKey) : t(g.ecranKey))).join(', ')}
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {suites.map((suite) => {
        const tete = suite[0]!
        const ecran = t(tete.ecranKey)
        return (
          <section key={`${tete.adresse}-${cleDe(tete)}`}>
            {/* L'ÉCRAN EST NOMMÉ ET IL EST CLIQUABLE. Nommer sans lier ferait
                chercher dans la barre latérale ; lier sans nommer donnerait un
                bouton dont on ne sait pas où il mène avant de l'avoir pressé. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-label font-semibold text-ink">
                {t('app.manual.onScreen', { screen: ecran })}
              </h4>
              <Button
                to={lien(base, tete.adresse)}
                variant="secondary"
                size="sm"
                iconAfter="arrowRight"
              >
                {t('app.manual.openScreen', { screen: ecran })}
              </Button>
            </div>
            <ul className="mt-3 flex flex-col">
              {suite.map((g) => (
                <LigneDeGeste key={cleDe(g)} geste={g} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function Manuel() {
  const { t } = useI18n()
  const { role } = useRole()
  const visite = adresseDeLaVisite()

  const miens = gestesDe(role)
  /*
    LES AUTRES RÔLES, DANS L'ORDRE DU REGISTRE et non dans celui d'une liste
    écrite ici. `ROLES_DOCUMENTES` est dérivé de `GESTES` : un rôle qui perdrait
    tous ses gestes disparaîtrait de cette section au lieu d'y afficher un vide,
    et le cas qui garde le registre refuse justement qu'un rôle en arrive là.
  */
  const autres = ROLES_DOCUMENTES.filter((r) => r !== role)

  return (
    <>
      <PageHeader title={t('app.manual.title')} description={t('app.manual.subtitle')} />

      {/* ── LA VISITE ── */}
      <Card className="mb-4">
        <h2 className="title-m text-ink">{t('app.manual.videoTitle')}</h2>
        {visite ? (
          <>
            <p className="mt-1 max-w-[65ch] text-body text-muted">{t('app.manual.videoBody')}</p>
            {/*
              `preload="metadata"` : on ne tire pas les mégaoctets d'une vidéo
              que la plupart des visiteurs de cet écran ne lanceront pas. Ils
              viennent y chercher un geste, pas un film.

              `controls` SANS lecture automatique : une vidéo qui démarre seule
              sur un écran d'aide parle par-dessus ce qu'on est venu lire.
            */}
            {/*
              SANS PISTE DE SOUS-TITRES, ET C'EST UN MANQUE, pas un oubli. Une
              visite filmée devrait porter ses sous-titres ; ils n'existeront que
              lorsque la vidéo existera, et ce dépôt ne les fabrique pas. Le
              manuel écrit, lui, dit la même chose en texte — c'est ce qui rend
              ce manque supportable, et non acceptable.
            */}
            <video
              className="mt-4 w-full rounded-lg bg-ink/5"
              src={visite}
              controls
              preload="metadata"
            >
              {t('app.manual.videoFallback')}
            </video>
          </>
        ) : (
          /*
            L'ABSENCE EST DITE, AVEC SON ISSUE. Ce n'est pas un avertissement
            — rien n'est cassé — mais une information dont la suite est un geste,
            et c'est pourquoi la note porte un bouton plutôt qu'un point final.
          */
          <Notice
            tone="neutral"
            titre={t('app.manual.videoAbsentTitle')}
            className="mt-3"
          >
            <p className="max-w-[65ch]">{t('app.manual.videoAbsentBody')}</p>
            <div className="mt-3">
              {/* VERS `/demo` ET NON VERS LA BASE COURANTE, même depuis un vrai
                  espace : c'est un bac à sable, et c'est exactement ce qu'on
                  veut quand on apprend un geste — essayer sans toucher à son
                  parc. L'adresse change, donc on voit où l'on est. */}
              <Button to="/demo" variant="secondary" size="sm" iconAfter="arrowRight">
                {t('app.manual.videoAbsentAction')}
              </Button>
            </div>
          </Notice>
        )}
      </Card>

      {/* ── SES PROPRES GESTES ── */}
      <Card className="mb-4">
        <h2 className="title-m text-ink">{t('app.manual.mineTitle')}</h2>
        <p className="mt-1 max-w-[65ch] text-body text-muted">{t('app.manual.mineSubtitle')}</p>
        <div className="mt-4">
          <GroupeDeGestes gestes={miens} />
        </div>
      </Card>

      {/* ── CE QUE FONT LES AUTRES ── */}
      <Card>
        <h2 className="title-m text-ink">{t('app.manual.othersTitle')}</h2>
        <p className="mt-1 max-w-[65ch] text-body text-muted">{t('app.manual.othersBody')}</p>
        {autres.map((r) => (
          <section key={r} className="mt-6">
            <h3 className="text-label font-semibold uppercase tracking-wide text-muted">
              {t(NOM_DU_ROLE[r])}
            </h3>
            <div className="mt-2">
              <GroupeDeGestes gestes={gestesDe(r)} nomsSeuls />
            </div>
          </section>
        ))}
      </Card>
    </>
  )
}
