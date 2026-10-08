import { Button } from '@/components/primitives/Button'
import { cn } from '@/lib/cn'
import { Card } from '@/components/primitives/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { SommaireDesRubriques } from '@/components/layout/SommaireDesRubriques'
import { CLASSE_DE_MARGE_D_ANCRE, TableDesMatieres } from '@/components/layout/TableDesMatieres'
import { useAuDela } from '@/lib/useAuDela'
import { useRole } from '@/components/layout/AppShell'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { lien, useBase } from '@/lib/base'
import type { Role } from '@/features/auth/signupState'
import {
  ROLES_DOCUMENTES,
  cleDe,
  gestesDe,
  suitesDe,
  type Geste,
  type Suite,
} from './manuelDesGestes'
import { VISITES } from './visiteFilmee'

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
 * ═══ ET POURQUOI ELLE A UN SOMMAIRE ═══
 *
 * « Déplié » et « sans repères » ne sont pas la même chose, et la page a tenu
 * les deux jusqu'au 2026-10-08. Mesuré à 1280 px : treize en-têtes « Dans X »
 * d'affilée sur 3 300 px, sans aucune entrée pour les atteindre. `Ctrl+F` reste
 * le premier geste de quelqu'un qui SAIT ce qu'il cherche ; il ne sert à rien à
 * celui qui veut VOIR ce que le produit sait faire, et c'est pourtant lui qui
 * ouvre un manuel.
 *
 * Le sommaire est celui des pages juridiques — `SommaireDesRubriques` —, pas un
 * second écrit ici : deux sommaires auraient divergé sur le premier détail venu.
 * Il coûte 423 px à 1280 et 517 à 360, inscrits dans `plafond-hauteurs`.
 *
 * IL NE PARAÎT PAS SOUS QUATRE SUITES, et ce seuil est mesuré lui aussi : voir
 * `SUITES_MINIMALES_POUR_UN_SOMMAIRE`. Un locataire n'a que trois gestes, et une
 * table des matières plus longue à lire que ce qu'elle indexe n'indexe rien.
 *
 * ═══ LA VISITE EST SERVIE PAR LE PRODUIT, ET C'EST UN REVIREMENT ═══
 *
 * Elle a d'abord été un FICHIER EXTERNE, dont l'adresse venait de
 * `VITE_VIDEO_DEMO`. Résultat observé en production : le fichier existait, ce
 * lecteur existait, et l'écran affichait « la visite n'est pas encore déposée ».
 * Une vidéo qu'il faut héberger à la main est une vidéo qui n'existe pas.
 *
 * Elle vit donc dans `public/`, et le prix est MESURÉ : 2,04 Mo en H.264, depuis
 * 5,20 Mo de brute Playwright. H.264 et non WebM parce qu'il se lit partout,
 * Safari compris — le marché est le téléphone, et un bailleur sur iPhone qui ne
 * voit rien n'a pas de visite.
 *
 * `preload="metadata"` : qui vient chercher un geste ne télécharge pas deux
 * mégaoctets. Le fichier pèse dans le DÉPÔT, pas dans ce que reçoit le visiteur.
 *
 * ═══ ELLE SUIT LA LANGUE, ET C'EST UN SECOND REVIREMENT ═══
 *
 * Elle a d'abord été UN SEUL FILM, tourné en français, servi à tout le monde.
 * L'habillage traduisait et le film non : « the screens you will get » au-dessus
 * de soixante-dix secondes de « Vue consolidée du parc ». Le registre
 * `visiteFilmee.ts` en tient une par langue, et `Record<Locale, …>` fait que la
 * prochaine langue ajoutée ne compile pas sans la sienne.
 *
 * DEUX ÉTATS SUBSISTENT, ET LE SECOND N'EST PAS THÉORIQUE :
 *
 *   1. le lecteur, que toute machine sait rendre ;
 *   2. un navigateur qui ne lit pas la source — le contenu de `<video>` est
 *      alors peint par lui, et il nomme l'issue : la démonstration vivante.
 *
 * ET LA DÉMONSTRATION RESTE OFFERTE SOUS LA VIDÉO, dans les deux cas. Regarder
 * n'est pas essayer, et c'est en essayant qu'on apprend un geste.
 */

/* Le nom du rôle, pris là où l'écran des accès le peint déjà. Trois clés
   littérales plutôt qu'un gabarit : `MessageKey` les vérifie une par une. */
const NOM_DU_ROLE: Record<Role, MessageKey> = {
  owner: 'app.access.role_owner',
  manager: 'app.access.role_manager',
  tenant: 'app.access.role_tenant',
}

/**
 * LE PRÉFIXE DES ANCRES, et pourquoi il y en a un.
 *
 * `SommaireDesRubriques` compose `#${prefixe}-${ancre}`. Sans préfixe, une
 * suite du parc porterait `id="parc-ajouterImmeuble"` dans un document où la
 * coquille applicative rend déjà sa barre latérale, ses panneaux et ses
 * modales : le risque de collision n'est pas théorique, et une collision
 * d'identifiant ne rougit nulle part.
 */
const PREFIXE_D_ANCRE = 'manuel'

/** L'`id` que porte le titre d'une suite — et la cible de l'entrée qui y mène. */
function ancreDe(ancre: string): string {
  return `${PREFIXE_D_ANCRE}-${ancre}`
}

/**
 * EN DESSOUS, LE SOMMAIRE COÛTE PLUS QU'IL NE RAPPORTE — et c'est un relevé.
 *
 * `SommaireDesRubriques` refuse déjà de paraître sur les mentions légales :
 * « trois rubriques courtes, tenant en un écran et demi, sur lesquelles un
 * sommaire serait une table des matières plus longue à lire que ce qu'elle
 * indexe ». Le manuel rencontre le MÊME cas, et pas par analogie : un LOCATAIRE
 * n'a que trois suites — son espace, ses documents, son signalement.
 *
 * Mesuré à 1280 px, carte « vos gestes » comprise : 753 px pour un locataire
 * contre 3 220 pour un propriétaire. Les trois entrées en coûteraient environ
 * 160 pour épargner, au mieux, les 590 px qui les suivent — soit un quart du
 * défilement rendu, pour un bloc qu'on voit entier en baissant les yeux.
 *
 * QUATRE EST DONC UN SEUIL MESURÉ, pas un chiffre rond : c'est le premier rang
 * où la section passe le millier de pixels, et où une entrée épargne plus de
 * hauteur qu'elle n'en occupe.
 */
const SUITES_MINIMALES_POUR_UN_SOMMAIRE = 4

/**
 * LA LARGEUR À PARTIR DE LAQUELLE UNE COLONNE LATÉRALE EXISTE.
 *
 * 64 rem, et EN REM comme toutes les requêtes de ce dépôt : la règle suit la
 * feuille de style quand la police de base grossit, au lieu de couper au même
 * nombre de pixels pour un texte deux fois plus large. Voir `useAuDela.ts`.
 *
 * En deçà, la coquille a déjà replié sa barre latérale et le texte occupe toute
 * la fenêtre : il n'y a littéralement pas de colonne à prendre pour un rail.
 */
const COLONNE_LATERALE = '(min-width: 64rem)'


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

  /* Le découpage vit dans le registre, et non plus ici : le sommaire a besoin
     du MÊME, et deux regroupements écrits côte à côte auraient divergé. */
  const suites = suitesDe(gestes)

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
        {suites.map((suite) => (
          /* AUCUN `id` ICI, ET CE N'EST PAS UN OUBLI. Un propriétaire et son
             gestionnaire partagent la plupart de leurs gestes : les mêmes
             ancres paraîtraient deux fois dans le document, et le sommaire
             déposerait le lecteur sur la section d'un rôle qui n'est pas le
             sien — sans que rien ne rougisse, `getElementById` rendant le
             premier des deux. Seule « vos gestes » porte les ancres. */
          <div key={suite.ancre} className="max-w-[80ch]">
            <dt className="inline text-label font-semibold text-ink">{t(suite.ecranKey)}</dt>
            <dd className="inline text-body text-muted">
              {' — '}
              {suite.gestes.map((g) => (g.gesteKey ? t(g.gesteKey) : t(g.ecranKey))).join(', ')}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {suites.map((suite) => {
        const ecran = t(suite.ecranKey)
        const id = ancreDe(suite.ancre)
        return (
          /* `aria-labelledby` : la section est une région nommée, et un lecteur
             d'écran la liste comme telle au lieu d'annoncer « section ». */
          <section key={suite.ancre} aria-labelledby={id}>
            {/* L'ÉCRAN EST NOMMÉ ET IL EST CLIQUABLE. Nommer sans lier ferait
                chercher dans la barre latérale ; lier sans nommer donnerait un
                bouton dont on ne sait pas où il mène avant de l'avoir pressé. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* LA MARGE D'ANCRE VIENT DU RAIL, et c'est la même valeur que sa
                  ligne de flottaison : elle doit DÉGAGER L'EN-TÊTE COLLANT de
                  la coquille, 65 px mesurés. `scroll-mt-6` — repris des pages
                  juridiques, qui n'en portent pas — déposait le titre à 24 px,
                  donc entièrement derrière la barre, et l'ancre résolvait quand
                  même. Voir `TableDesMatieres.tsx`. */}
              <h4
                id={id}
                className={cn(CLASSE_DE_MARGE_D_ANCRE, 'text-label font-semibold text-ink')}
              >
                {t('app.manual.onScreen', { screen: ecran })}
              </h4>
              <Button
                to={lien(base, suite.adresse)}
                variant="secondary"
                size="sm"
                iconAfter="arrowRight"
              >
                {t('app.manual.openScreen', { screen: ecran })}
              </Button>
            </div>
            <ul className="mt-3 flex flex-col">
              {suite.gestes.map((g) => (
                <LigneDeGeste key={cleDe(g)} geste={g} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * LES ENTRÉES DU SOMMAIRE — une par suite, et aucune ne peut être confondue.
 *
 * ═══ POURQUOI LE NOM DE L'ÉCRAN NE SUFFIT PAS ═══
 *
 * Le registre est rangé dans l'ordre du MOIS, pas de la barre latérale : « Parc
 * immobilier » y revient TROIS fois pour un gestionnaire — on monte le parc, on
 * y vit le bail, on en sort. C'est le propos même de la page, et c'est
 * exactement ce qui rend un sommaire naïf inutile : trois entrées portant le
 * même mot obligent à les essayer l'une après l'autre, c'est-à-dire à refaire
 * le défilement qu'on prétendait supprimer.
 *
 * ═══ CE QUI LES DISTINGUE EST PRIS DANS LA PAGE, PAS INVENTÉ ═══
 *
 * Le premier geste de la suite — « Ajouter un immeuble », « Bail et sûretés »,
 * « Exporter le parc ». C'est la PREMIÈRE LIGNE que le lecteur verra en
 * arrivant, donc la promesse de l'entrée est vérifiable à l'œil au moment où
 * elle est tenue. Un intitulé écrit ici, à côté du registre, aurait vieilli
 * sans que rien ne le dise — c'est le défaut que tout ce dossier évite.
 *
 * Et il n'est ajouté QU'AUX ÉCRANS QUI REVIENNENT : les douze autres entrées
 * restent un seul mot, ce qui est ce qu'on lit le plus vite.
 */
function rubriquesDuSommaire(
  suites: readonly Suite[],
  nomDe: (cle: MessageKey) => string,
): { ancre: string; titre: string }[] {
  const occurrences = new Map<string, number>()
  for (const suite of suites) {
    const ecran = nomDe(suite.ecranKey)
    occurrences.set(ecran, (occurrences.get(ecran) ?? 0) + 1)
  }

  return suites.map((suite) => {
    const ecran = nomDe(suite.ecranKey)
    const tete = suite.gestes[0]!
    const geste = tete.gesteKey ? nomDe(tete.gesteKey) : null
    return {
      ancre: suite.ancre,
      titre: occurrences.get(ecran)! > 1 && geste ? `${ecran} — ${geste}` : ecran,
    }
  })
}

export function Manuel() {
  const { t, locale } = useI18n()
  const { role } = useRole()

  /* LA VISITE DE SA LANGUE. `locale` est la langue EFFECTIVE — celle dont le
     dictionnaire est chargé —, pas celle qui vient d'être demandée : servir le
     film anglais pendant que l'écran est encore en français donnerait l'inverse
     exact du défaut qu'on referme. */
  const visite = VISITES[locale]

  const miens = gestesDe(role)
  const mesSuites = suitesDe(miens)
  const rubriques = rubriquesDuSommaire(mesSuites, t)
  const aUneNavigation = mesSuites.length >= SUITES_MINIMALES_POUR_UN_SOMMAIRE
  const railPossible = useAuDela(COLONNE_LATERALE)
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
        <p className="mt-1 max-w-[65ch] text-body text-muted">{t('app.manual.videoBody')}</p>
        {/*
          `controls` SANS lecture automatique : une vidéo qui démarre seule sur
          un écran d'aide parle par-dessus ce qu'on est venu lire.

          SANS PISTE DE SOUS-TITRES, ET C'EST UN MANQUE, pas un oubli. Une visite
          filmée devrait porter les siens ; ils n'existent pas, et ce dépôt ne
          les fabrique pas. Le manuel écrit dit la même chose en texte — c'est ce
          qui rend ce manque supportable, et non acceptable.
        */}
        <video
          aria-label={t('app.manual.videoPlayerLabel')}
          className="mt-4 w-full rounded-lg bg-ink/5"
          key={visite.video}
          src={visite.video}
          poster={visite.affiche}
          controls
          preload="metadata"
        >
          {t('app.manual.videoFallback')}
        </video>
        {/* REGARDER N'EST PAS ESSAYER. Vers `/demo` même depuis un vrai espace :
            c'est un bac à sable, et c'est ce qu'on veut quand on apprend un
            geste — l'essayer sans toucher à son parc. */}
        <div className="mt-4">
          <Button to="/demo" variant="secondary" size="sm" iconAfter="arrowRight">
            {t('app.manual.videoTryIt')}
          </Button>
        </div>
      </Card>

      {/* ── SES PROPRES GESTES ── */}
      <Card className="mb-4">
        <h2 className="title-m text-ink">{t('app.manual.mineTitle')}</h2>
        <p className="mt-1 max-w-[65ch] text-body text-muted">{t('app.manual.mineSubtitle')}</p>
        {/*
          DEUX NAVIGATIONS, UNE SEULE RENDUE — et par `useAuDela` plutôt que par
          `hidden lg:block`. Les classes de Tailwind laisseraient les DEUX dans
          le document : treize ancres en double, donc un lecteur d'écran qui
          annonce deux fois la même liste, et une sonde qui compte deux fois les
          mêmes liens. Ce qui est caché à l'œil ne l'est pas à l'arbre.

          Le choix de la forme et son prix sont écrits dans `TableDesMatieres`.
        */}
        {/*
          LE SOMMAIRE EST CELUI DU COMPOSANT DES PAGES JURIDIQUES, et pas un
          second écrit ici : deux sommaires divergeraient sur le premier détail
          venu — l'écart entre les colonnes, la hauteur des cibles, le mot
          « Sommaire » lui-même. Le même argument qui l'a fait partager entre
          les conditions générales et la confidentialité vaut pour un troisième
          appelant, et il porte déjà ses mesures : deux colonnes dès 360 px,
          44 px par cible, un `<ol>` qui situe l'entrée dans le document.

          IL INDEXE « VOS GESTES » SEUL. La visite filmée tient en un écran, et
          « ce que font les autres rôles » ne nomme que des gestes sans les
          expliquer : indexer l'une ou l'autre ajouterait des entrées qui
          n'épargnent aucun défilement.
        */}
        {aUneNavigation && !railPossible && (
          <SommaireDesRubriques
            libelle={t('app.manual.contentsTitle')}
            prefixe={PREFIXE_D_ANCRE}
            rubriques={rubriques}
            indice={t('app.manual.anchorHint')}
          />
        )}
        {/* LE RAIL EST UN FRÈRE DU TEXTE, pas un enfant : il doit rester collé
            pendant que la colonne de gestes défile sous lui, et un `sticky`
            n'accroche que dans le conteneur qui défile, jamais dans la boîte
            qu'il suit. */}
        <div className="mt-4 flex gap-8">
          <div className="min-w-0 flex-1">
            <GroupeDeGestes gestes={miens} />
          </div>
          {aUneNavigation && railPossible && (
            /*
              `h-fit` : sans lui l'aside s'étire sur toute la hauteur de la
              rangée et `sticky` n'a plus de course où accrocher. `top-18` =
              72 px, soit les 65 de l'en-tête collant mesuré plus un peu d'air.

              ═══ POURQUOI UN PLAFOND ET UN DÉFILEMENT PROPRE ═══

              Le rail ne tient PAS toujours dans la fenêtre, et c'est mesuré :
              treize entrées à 46 px — le minimum qu'exige la sonde des cibles —
              font 707 px, quand une fenêtre de 1024×768 n'en offre que 696 sous
              l'en-tête. Sans plafond, la dernière entrée est hors écran et rien
              ne permet de l'atteindre : un sommaire dont on ne peut pas lire la
              fin est exactement le défaut qu'il devait corriger.

              `100dvh` et non `100vh` : sur un téléphone en paysage, la barre
              d'adresse se rétracte et `vh` garde la hauteur d'avant.
            */
            <aside className="sticky top-18 h-fit max-h-[calc(100dvh-6rem)] w-52 shrink-0 overflow-y-auto">
              <TableDesMatieres
                libelle={t('app.manual.onThisPage')}
                entrees={rubriques.map(({ ancre, titre }) => ({
                  id: ancreDe(ancre),
                  libelle: titre,
                }))}
              />
            </aside>
          )}
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
