import { useId, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { RadioCards } from '@/components/primitives/Choice'
import { Button, IconButton } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { MenuDeDebordement, MenuElement } from '@/components/primitives/MenuDeDebordement'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import {
  DOCUMENT_KIND_LABELS,
  receiptDue,
  type DocumentKind,
  type DocumentRequest,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useToast } from '@/components/primitives/Toast'
import { cn } from '@/lib/cn'
import {
  useAllReceiptsPdf,
  useDepositPdf,
  useInspectionPdf,
  useReceiptPdf,
} from './documentsPdf'
import { useHistoriqueCsv } from './quittancesCsv'

/**
 * LA GRILLE DES DEUX COLONNES, nommée pour que l'attente ne s'en écarte pas.
 *
 * Elle s'écrivait DEUX fois dans ce fichier : une fois sur la rangée chargée,
 * une fois sur le squelette qui l'annonce. Deux chaînes que rien ne tenait
 * ensemble, dans le seul morceau du produit qu'aucune porte ne rend jamais —
 * la démonstration n'attend pas, la vitrine n'a pas de squelette d'écran, et la
 * mesure au navigateur mesure la page chargée. C'est ainsi que l'espace
 * locataire s'est retrouvé à attendre sous quatre cartes pour en charger trois.
 *
 * Voir `squelettesFideles.test.ts`, qui tient désormais la règle.
 */
const GRILLE_DEUX_COLONNES = 'grid gap-4 lg:grid-cols-2'

/**
 * Documents du locataire — ses pièces contractuelles et ses quittances.
 *
 * L'écran tient une ligne de conduite que le portail avait déjà payée une
 * fois : **on n'affiche pas un bouton qui ne peut rien produire**. Le bail
 * signé, l'état des lieux et le reçu de caution sont annoncés « PDF » par les
 * maquettes ; le produit ne savait alors ni recevoir un fichier déposé, ni en
 * fabriquer un, et chaque ligne disait donc la case vide.
 *
 * IL SAIT FABRIQUER DEPUIS `lib/pdf.ts`, et la règle n'a pas changé pour
 * autant — c'est ce qu'elle autorise qui a changé. Deux des trois lignes ont
 * leurs DONNÉES : une caution porte son consigné, son retenu et son solde ; un
 * état des lieux porte sa date, ses pièces et ses réserves. Elles produisent
 * donc. Le bail n'a rien : aucun texte n'en est enregistré, et le mettre en page
 * reviendrait à fabriquer la pièce qu'on prétend restituer. Il reste la case
 * vide, seul des trois.
 *
 * Les deux renvois — état des lieux, caution — pointent vers des adresses que
 * le locataire ne trouve plus dans sa navigation depuis qu'elle est passée à
 * trois entrées. Elles n'ont pas été fermées pour autant : c'est ici qu'elles
 * se rattrapent, et c'est la raison pour laquelle elles restent ouvertes.
 */
/**
 * Les trois pièces qu'un locataire réclame réellement à son gestionnaire.
 *
 * Un champ libre aurait laissé écrire n'importe quoi, y compris ce que le
 * gestionnaire ne peut pas produire. Trois cases nommées disent le périmètre.
 *
 * Ce sont les valeurs du SERVEUR — `DocumentKind` — et non des clés de
 * traduction : la demande voyage nommée, et chaque écran la lit dans sa propre
 * langue. Figer l'intitulé à l'envoi enfermerait le gestionnaire dans la langue
 * du locataire.
 */
const DEMANDES: DocumentKind[] = ['residence', 'goodStanding', 'leaseCopy']

export function TenantDocuments() {
  const base = useBase()
  const t = useT()
  const d = useDates()
  const { money } = useCurrency()
  const telechargerLaQuittance = useReceiptPdf()
  const telechargerToutesLesQuittances = useAllReceiptsPdf()
  const telechargerLaCaution = useDepositPdf()
  const telechargerLEtatDesLieux = useInspectionPdf()
  const exporterLHistorique = useHistoriqueCsv()
  const {
    unitById,
    tenantUnitIds,
    depositForUnit,
    inspectionForUnit,
    receiptsForUnit,
    documentRequests,
    requestDocument,
    loading,
  } = usePortfolio()
  const { notify } = useToast()
  const [choix, setChoix] = useState<DocumentKind | null>(null)

  const suiviId = useId()

  /** Mono-unité, comme l'espace locataire — et pour la même raison. */
  const monUnite = tenantUnitIds[0] ?? ''
  const tenantReceipts = receiptsForUnit(monUnite)
  /* Les siennes, et dans l'ordre où il les a faites.
     Le paramètre ne s'appelle pas `d` : ce nom est pris trente lignes plus haut
     par les formats de date, et une demande de pièce n'est pas une date. */
  const mesDemandes = documentRequests.filter((demande) => demande.unitId === monUnite)
  const unit = unitById(monUnite)
  const deposit = depositForUnit(monUnite)
  const entree = inspectionForUnit(monUnite, 'entry')

  // L'attente AVANT le garde `!unit` : pendant le chargement, le jeu de
  // démonstration fournit toujours une unité, et l'écran montrerait le dossier
  // d'un autre. Même ordre, même raison que l'espace locataire.


  /*
    « DEMANDE ENVOYÉE » ATTEND QUE LE SERVEUR L'AIT ACCEPTÉE.

    La phrase partait avec l'appel : sur le 409 `already_pending` que cet écran
    s'emploie justement à éviter avant le clic, le locataire lisait que sa
    demande était partie PUIS le message d'échec du fournisseur. Deux annonces
    contraires pour un seul geste.

    Le choix SURVIT au refus, pour la même raison que la saisie du signalement :
    le remettre à `null` punirait le locataire d'une panne qui n'est pas la
    sienne, et il lui faudrait recommencer sa sélection.
  */
  /* Le refus du groupe : posé au clic, levé dès qu'une pièce est désignée. */
  const [sansChoix, setSansChoix] = useState(false)

  async function envoyerLaDemande() {
    /* LE REFUS S'ÉCRIT AU LIEU D'ÉTEINDRE LE BOUTON. Il était `disabled` tant
       qu'aucune pièce n'était choisie — donc mort dès l'arrivée, avant tout
       geste, et muet : le groupe de choix porte `hideLegend`, si bien que même
       son intitulé était masqué. Rien à l'écran ne reliait l'extinction au
       choix qui manquait. Même correctif que « Continuer » à l'inscription. */
    if (!choix) {
      setSansChoix(true)
      return
    }
    if (!unit) return
    setSansChoix(false)
    const acceptee = await requestDocument(unit.id, choix)
    if (!acceptee) return
    setChoix(null)
    notify(t('app.documents.requestSent'), { tone: 'ok' })
  }

  if (loading) return <TenantDocumentsSkeleton />

  if (!unit)
    return (
      <>
        <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />
        <EmptyState
          icon="info"
          level={2}
          title={t('app.tenant.noUnitTitle')}
          body={t('app.tenant.noUnitBody')}
        />
      </>
    )

  return (
    <>
      <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />

      <div className={GRILLE_DEUX_COLONNES}>
        <Card flush>
          <CardHeader
            eyebrow={t('app.documents.contractual')}
            title={t('app.documents.contractualTitle')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />
          <ul className="divide-y divide-divider border-t border-divider">
            {/* LE BAIL RESTE LA CASE VIDE, et c'est le seul des trois.

                Ses deux voisines se téléchargent depuis que le produit sait
                fabriquer un PDF, parce que LEURS DONNÉES existent — une caution
                porte son consigné, son retenu et son solde ; un état des lieux
                porte sa date, ses pièces et ses réserves. Rien n'enregistre le
                TEXTE d'un bail : le produire reviendrait à fabriquer, sous une
                mise en page qui lui donnerait l'apparence d'une pièce, un
                document que rien n'atteste. */}
            <LignePiece label={t('app.documents.lease')} absence={t('app.documents.leaseNever')} />

            <LignePiece
              label={t('app.documents.entryInspection')}
              absence={t('app.documents.inspectionPending')}
              detail={entree ? d.fullDate(entree.date) : undefined}
              to={entree ? lien(base, 'etats-des-lieux') : undefined}
              action={t('app.documents.view')}
              telecharger={
                entree
                  ? {
                      nom: t('app.documents.pdfDownloadInspection'),
                      faire: () => telechargerLEtatDesLieux(unit, entree),
                    }
                  : undefined
              }
            />

            <LignePiece
              label={t('app.documents.depositReceipt')}
              absence={t('app.tenant.leaseDepositNone')}
              detail={deposit ? money(deposit.held, { compact: true }) : undefined}
              to={deposit ? lien(base, 'cautions') : undefined}
              action={t('app.documents.view')}
              telecharger={
                deposit
                  ? {
                      nom: t('app.documents.pdfDownloadDeposit'),
                      faire: () => telechargerLaCaution(unit, deposit),
                    }
                  : undefined
              }
            />
          </ul>
        </Card>

        <Card flush>
          <CardHeader
            eyebrow={`${t('app.documents.receipts')} · ${tenantReceipts.length}`}
            title={t('app.documents.receiptsTitle')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
            action={
              /*
                DEUX FICHIERS, DEUX GESTES, ET LE SECOND EST REPLIÉ.

                Le carnet PDF se PRÉSENTE — à un bailleur suivant, à une
                administration. Le tableur se CALCULE : on y trie ses périodes,
                on y somme une année, on le colle dans une feuille. Un PDF ne
                fait aucun de ces trois gestes, et c'est pourquoi le tableau est
                revenu après que ce lot l'eut retiré.

                Le premier est visible, le second est dans le menu : c'est la
                règle des en-têtes — au plus deux commandes offertes, le reste
                atteignable. Ici l'un des deux est de loin le plus demandé.
              */
              tenantReceipts.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="download"
                    onClick={() => telechargerToutesLesQuittances(unit, tenantReceipts)}
                  >
                    {t('app.documents.downloadAll')}
                  </Button>
                  <MenuDeDebordement libelle={t('common.moreActions')}>
                    <MenuElement
                      icone="download"
                      onClick={() => exporterLHistorique(unit, tenantReceipts)}
                    >
                      {t('app.documents.exportCsv')}
                    </MenuElement>
                  </MenuDeDebordement>
                </div>
              ) : undefined
            }
          />
          {/* Vide tant qu'aucune échéance n'est enregistrée sur le bail. On
              l'annonce plutôt que de servir les six périodes de la
              démonstration comme si elles étaient les siennes. */}
          {tenantReceipts.length === 0 ? (
            <div className="border-t border-divider px-4 py-4 sm:px-5">
              <EmptyState
                icon="file"
                title={t('app.tenant.noReceiptsTitle')}
                body={t('app.tenant.noDocumentsBody')}
              />
            </div>
          ) : (
          <ul className="divide-y divide-divider border-t border-divider">
            {tenantReceipts.map((receipt) => (
              <li
                key={`${receipt.year}-${receipt.month}`}
                /* LA MÊME RANGÉE REPLIABLE QUE `LignePiece`, et la porte a
                   exigé le changement à la ligne près. Le montant ajouté à
                   cette ligne déborde de 6 px à 320 px : « 170 942 FCFA » en
                   capitales interlettrées ne tient pas dans ce que le bouton
                   « Télécharger » laisse, et un nombre ne se coupe pas. Le
                   remède est celui que la carte du dessus applique déjà —
                   plancher sur la colonne de texte, repli, action rendue à
                   droite par `ml-auto`. */
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5"
              >
                <Icon name="file" size={17} className="shrink-0 text-muted" />
                {/* LE MOIS ET SON MONTANT, sur deux lignes comme `LignePiece`
                    juste au-dessus — et pour la même raison qu'elle : à 320 px,
                    une seconde valeur posée sur la même ligne pousse le bouton
                    et coupe le nom du mois.

                    Six lignes ne portaient QUE le nom d'un mois : rien ne
                    distinguait la période à 101 300 de celle à 103 800, et il
                    fallait télécharger pour savoir ce qu'on téléchargeait. Le
                    chiffre existait — l'export de cette même carte l'écrit déjà
                    dans son fichier.

                    LE TOTAL DÛ, ce que la quittance couvre, et non le réglé :
                    sur une période partiellement soldée, le versement se
                    lirait comme le montant de la pièce. Le reste dû a son
                    écran, avec la primitive qui distingue les deux. */}
                <span className="min-w-32 flex-1">
                  <span className="block text-body">{d.monthYear(receipt)}</span>
                  <span className="numeric block text-caps text-muted">
                    {money(receiptDue(receipt), { compact: true })}
                  </span>
                </span>
                <div className="ml-auto shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="download"
                    onClick={() => telechargerLaQuittance(unit, receipt)}
                  >
                    {t('app.documents.download')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          )}
        </Card>
      </div>

      {/* La MÊME grille que la rangée du dessus, lue au même endroit. Elle
          s'écrivait ici à la main — `'mt-4 grid gap-4 lg:grid-cols-2'` —, à
          trente lignes de la constante déclarée pour exactement cela. La marge
          se compose, la grille se nomme. */}
      <div className={cn('mt-4', GRILLE_DEUX_COLONNES)}>
        {/*
          DEMANDER UN DOCUMENT.

          LA DETTE DE MODÈLE A ÉTÉ SOLDÉE, et ce commentaire décrivait encore
          l'ancien montage. La demande partait par le canal des signalements —
          `addWork` —, faute d'objet à elle : elle apparaissait dans « Travaux
          dans mon logement » aux côtés d'une fuite d'évier, ce qui était faux.

          Le produit a désormais un objet `DocumentRequest` : `requestDocument`
          le crée, `resolveDocumentRequest` le clôt en « fournie » ou
          « impossible à fournir », et le suivi juste en dessous le lit. Une
          demande de pièce n'est plus rangée parmi les interventions.
        */}
        <Card>
          <CardHeader
            title={t('app.documents.request')}
            description={t('app.documents.requestHint')}
            level={2}
          />
          {/*
            LA PRIMITIVE, ET DEUX DÉFAUTS DE CLAVIER QUI DISPARAISSENT AVEC ELLE.

            Ce groupe était refait à la main sur des `<button role="radio">` avec
            une navigation aux flèches écrite ici. Elle avait deux trous, et tous
            deux tenaient à ce qu'un faux bouton radio ignore ce qu'un vrai sait :

              · les flèches SÉLECTIONNAIENT une pièce déjà demandée — le
                `disabled` n'était consulté nulle part dans `auClavier`. Le
                bouton d'envoi s'activait alors et partait chercher le 409
                `already_pending` que ce même écran s'emploie à éviter avant le
                clic ;
              · le groupe entier devenait INATTEIGNABLE à la tabulation quand la
                première pièce était déjà demandée : elle portait le seul arrêt
                (`tabIndex={0}`) et était `disabled`, les deux autres portaient
                `-1`.

            Un `input[type=radio][disabled]` est sauté par les flèches et refusé
            au clic sans qu'une ligne soit écrite, et le navigateur pose l'arrêt
            de tabulation sur une entrée qui peut le recevoir. Il n'y avait rien
            à réparer, seulement à cesser de réécrire.
          */}
          <RadioCards
            variant="puces"
            legend={t('app.documents.request')}
            hideLegend
            name="piece"
            value={choix}
            error={sansChoix ? t('app.documents.reqNoChoice') : undefined}
            onChange={(kind) => {
              setChoix(kind)
              setSansChoix(false)
            }}
            options={DEMANDES.map((demande) => ({
              value: demande,
              title: t(DOCUMENT_KIND_LABELS[demande] as 'app.documents.reqResidence'),
              description: '',
              /* Une pièce déjà demandée et sans réponse ne se redemande pas : le
                 serveur le refuse, et le choix doit dire la même chose avant le
                 clic. Le suivi juste en dessous montre la demande en cours — la
                 case n'est pas grisée sans explication. */
              disabled: mesDemandes.some(
                (enCours) => enCours.kind === demande && enCours.status === 'pending',
              ),
            }))}
          />
          <Button className="mt-4" onClick={envoyerLaDemande}>
            {t('app.documents.requestSend')}
          </Button>

          {/*
            LE SUIVI, sous le formulaire.

            Sans lui, la demande partait dans le noir : le locataire cliquait,
            lisait un toast, et n'avait plus aucun moyen de savoir si on lui
            avait répondu. Elle apparaissait bien quelque part — dans « Travaux
            dans mon logement », rangée entre une fuite d'évier et un volet
            cassé, avec une référence de chantier.

            La liste ne s'affiche que s'il y a quelque chose à suivre : une
            section « Mes demandes » vide sur un dossier neuf annoncerait un
            historique qui n'existe pas.
          */}
          {mesDemandes.length > 0 && (
            <div className="mt-4 border-t border-divider pt-4">
              {/* L'intitulé est VISIBLE, et il nomme la liste pour tout le
                  monde : un `aria-label` seul laissait la section anonyme à
                  l'œil, sous un simple filet, alors qu'elle change de sujet —
                  au-dessus on demande, ici on suit. */}
              <p id={suiviId} className="eyebrow text-muted">
                {t('app.documents.myRequests')}
              </p>
              <ul aria-labelledby={suiviId} className="mt-2 flex flex-col gap-2">
                {mesDemandes.map((demande) => (
                  <LigneDemande key={demande.id} demande={demande} />
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/*
          CONFIDENTIALITÉ — la règle est dite, pas seulement appliquée.

          Les maquettes ajoutent « DERNIER ACCÈS · 12/08/2026 09:41 ». Rien ne
          journalise les consultations : cette ligne annoncerait une traçabilité
          qui n'existe pas, sur l'écran précisément où l'on promet la
          confidentialité. Une promesse de sécurité inventée est le pire endroit
          où en inventer une.
        */}
        {/*
          `self-start` : LA NOTE FINIT OÙ FINIT SON TEXTE.

          Étirée sur la hauteur de la colonne des pièces, cette carte portait
          349 px de vide sous deux lignes — 71 % de sa hauteur, en encre pleine,
          soit un pavé sombre presque entièrement creux à côté d'une liste bien
          remplie. Le défaut ne débordait de rien et tenait tous les seuils :
          c'est la sonde du BLANC IMPOSÉ qui l'a nommé, et rien d'autre ne le
          pouvait. Le remède n'est pas d'allonger le texte, c'est de cesser de
          faire payer à la note la hauteur de sa voisine.
        */}
        <Card tone="dark" className="self-start">
          {/* Le titre porte le libellé : `CardHeader` rend son `<h2>` sans
              condition, et le laisser vide posait un en-tête anonyme qu'un
              lecteur d'écran annonce sans pouvoir le nommer. */}
          <CardHeader title={t('app.documents.privacy')} level={2} className="mb-2" />
          <p className="flex items-start gap-3 text-body text-on-dark-muted">
            <Icon name="shield" size={17} className="mt-0.5 shrink-0 text-accent-on-dark" />
            {t('app.documents.privacyBody')}
          </p>
        </Card>
      </div>
    </>
  )
}

/**
 * Une pièce du dossier.
 *
 * Sans `to`, elle n'offre rien : c'est l'état d'une case que le produit ne sait
 * pas encore remplir, et le dire vaut mieux qu'un bouton mort.
 */
function LignePiece({
  label,
  detail,
  to,
  action,
  telecharger,
  absence,
}: {
  label: string
  detail?: string
  to?: string
  action?: string
  /**
   * Le document lui-même, quand le produit sait le fabriquer.
   *
   * SÉPARÉ DE `to`, et les deux cohabitent : consulter mène à l'écran qui
   * montre la pièce — ses photos, ses réserves —, télécharger rend le fichier
   * qu'on garde ou qu'on présente. Fondre les deux aurait obligé à choisir
   * laquelle des deux on retire, et aucune des deux n'est de trop.
   *
   * Un bouton ICÔNE et non un second libellé : la ligne porte déjà « Consulter »
   * et se replie à 320 px. Deux libellés côte à côte y coûtaient une troisième
   * rangée à chacune des trois lignes de la carte.
   */
  telecharger?: { nom: string; faire: () => void }
  /**
   * CE QUE L'ABSENCE EST, quand la pièce n'est pas là.
   *
   * « Aucun document déposé » servait pour trois absences de natures opposées :
   * une pièce qui ne sera JAMAIS déposée — le produit n'enregistre pas le texte
   * d'un bail —, une pièce qui viendra quand elle aura été établie, et une
   * caution qui n'existe peut-être pas. Le locataire ne pouvait ni les
   * distinguer ni savoir laquelle appelle un geste, sur le seul écran du
   * produit où il n'a AUCUN moyen de recouper.
   */
  absence?: string
}) {
  const t = useT()
  return (
    /* MÊME FORME QUE L'EN-TÊTE DE CARTE, MÊME REMÈDE — voir `CardHeader`.
       Le voisin de droite est `shrink-0`, le libellé était `min-w-0` : rien ne
       négocie, le libellé cède tout. Mesuré à 320 : 46 px offerts à « Contrat de
       bail signé », dont le premier mot en réclame 49 — il débordait de 3 px,
       DANS la carte, sans faire rougir aucune règle de page. Le plancher est
       plus bas qu'en en-tête (128 contre 192) parce que la ligne porte déjà une
       icône et vit dans une liste : c'est une ligne, pas un titre. */
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
      <Icon name="file" size={17} className="shrink-0 text-muted" />
      <span className="min-w-32 flex-1">
        {/* PAS de `truncate` sur le libellé : à 320px, la case vide
            (« Aucun document déposé », `shrink-0`) est plus large que le
            bouton « Consulter » qu'elle remplace, et coupait le nom de la
            pièce à deux ou trois lettres pour lui faire de la place —
            « Contrat de bail signé » devenait illisible dans l'état
            précisément où l'écran doit être le plus clair. Ces trois
            libellés tiennent sur deux lignes courtes ; les y laisser vaut
            mieux que les faire disparaître. */}
        <span className="block text-body">{label}</span>
        {detail && <span className="numeric block text-caps text-muted">{detail}</span>}
        {/* SOUS LE LIBELLÉ, jamais dans la colonne de droite : celle-ci est
            `shrink-0` et se bat déjà avec le nom de la pièce à 320 px — une
            phrase y écraserait « Contrat de bail signé » à deux lettres, dans
            l'état précisément où l'écran doit être le plus clair. */}
        {!to && absence && (
          <span className="block text-caps text-pretty text-muted">{absence}</span>
        )}
      </span>
      {/* `ml-auto` : QUAND LA LIGNE SE REPLIE, l'action reste à droite.

          Sans lui elle tombe à gauche, sous l'icône, et les trois lignes de la
          carte montrent trois « Consulter » alignés sur rien. Le `flex-1` du
          libellé la pousse déjà à droite tant que tout tient sur une ligne :
          cette marge automatique n'agit donc QUE dans l'état replié, où elle
          rend à l'action la colonne qu'elle occupe partout ailleurs.

          `CardHeader` fait le même geste pour la même raison. Une première
          rédaction ne le donnait qu'ICI, en distinguant le bouton de la légende
          — « une légende suit son titre, un bouton garde sa colonne ». C'était
          habiller un oubli : la plupart des actions d'en-tête SONT des boutons,
          et « Tout télécharger » se retrouvait seul à gauche deux cartes plus
          bas. La règle est la même partout. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {to ? (
          <Button to={to} variant="ghost" size="sm">
            {action}
          </Button>
        ) : (
          <span className="text-caps text-muted">{t('app.documents.none')}</span>
        )}
        {telecharger && (
          <IconButton icon="download" label={telecharger.nom} onClick={telecharger.faire} />
        )}
      </div>
    </li>
  )
}

/**
 * L'ATTENTE, ET CE QU'ELLE ANNONÇAIT DE FAUX.
 *
 * Elle dessinait DEUX cartes dans UNE grille pour un écran qui en rend QUATRE
 * dans DEUX : la page doublait de hauteur à la seconde où elle cesse d'attendre,
 * et le doigt posé sur ce qu'on croyait avoir vu tombait à côté. C'est très
 * exactement le défaut que `Skeleton` interdit dans sa première règle — « un
 * squelette plus court que son contenu ne fait que déplacer le problème ».
 *
 * Les deux cartes annoncées étaient en outre PLEINES là où les vraies sont
 * `flush` : leur rembourrage propre s'ajoutait à celui des lignes, et les pavés
 * portaient des hauteurs choisies à l'œil — `h-4`, `h-5` — au lieu des jetons
 * `line=` que `squelettesFideles.test.ts` cale sur les boîtes de ligne réelles.
 * Trois façons de ne pas tenir la place, dans quinze lignes.
 *
 * LE TON EST REPRODUIT, ET J'AVAIS TRANCHÉ L'INVERSE AU LOT PRÉCÉDENT. La note
 * de confidentialité est une carte sombre ; je l'avais laissée claire en
 * attente, au motif que les pavés de substitution — en `bg-surface-sunken` — y
 * disparaîtraient. Vérifié depuis dans `tokens.css` : `.on-dark` ne remappe PAS
 * ce jeton, les pavés gardent donc leur valeur claire et se voient sur l'encre.
 * Le motif était une prudence, pas une mesure.
 *
 * L'espace locataire, lui, peignait déjà son aplat d'encre en attente, avec sa
 * raison écrite. Deux attentes voisines qui traitaient une carte sombre de deux
 * façons : c'est la divergence même que ce travail poursuit.
 *
 * `self-start` est repris pour une autre raison, purement géométrique : sans
 * lui la quatrième carte s'étire sur la hauteur de sa voisine, ce que la page
 * chargée refuse justement de faire.
 */
function TenantDocumentsSkeleton() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />
      <SkeletonRegion label={t('app.documents.title')}>
        <div className={GRILLE_DEUX_COLONNES}>
          {/* Les pièces contractuelles : trois lignes fixes. Les quittances :
              autant que de périodes, et le squelette n'en sait rien — trois est
              le compte de la carte voisine, ce qui donne deux colonnes de même
              hauteur plutôt qu'un décrochement inventé. */}
          {[0, 1].map((carte) => (
            <Card key={carte} flush>
              <EnTeteEnAttente />
              <ul className="divide-y divide-divider border-t border-divider">
                {[0, 1, 2].map((ligne) => (
                  <li key={ligne} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    {/* La boîte de l'icône, à sa taille rendue. */}
                    <Skeleton radius="md" className="size-[17px]" />
                    <Skeleton line="body" className="min-w-0 flex-1" />
                    {/* La colonne de droite — « Consulter », « Télécharger » —
                        garde sa place, comme dans la ligne chargée. */}
                    <Skeleton radius="md" className="h-7 w-24 shrink-0" />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className={cn('mt-4', GRILLE_DEUX_COLONNES)}>
          <Card>
            <div className="mb-4">
              <Skeleton line="title" className="w-44" />
              <Skeleton line="body" className="mt-1 w-full max-w-xs" />
            </div>
            {/* Les trois pièces demandables, puis le bouton d'envoi. */}
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((piece) => (
                <Skeleton key={piece} radius="md" className="h-11" />
              ))}
            </div>
            <Skeleton radius="md" className="mt-4 h-9 w-40" />
          </Card>

          <Card tone="dark" className="self-start">
            <Skeleton line="title" className="mb-4 w-32" />
            <div className="flex flex-col gap-1.5">
              <Skeleton line="body" />
              <Skeleton line="body" className="w-2/3" />
            </div>
          </Card>
        </div>
      </SkeletonRegion>
    </>
  )
}

/**
 * L'en-tête d'une carte `flush` en attente.
 *
 * Le rembourrage est celui que les deux `CardHeader` de l'écran reçoivent en
 * `className`, et `mb-4` celui que `CardHeader` porte lui-même : c'est de là que
 * vient la hauteur, et l'écrire ailleurs la ferait dériver.
 */
function EnTeteEnAttente() {
  return (
    <div className="mb-4 px-4 pt-4 sm:px-5 sm:pt-5">
      <Skeleton line="eyebrow" className="mb-1.5 w-24" />
      <Skeleton line="title" className="w-40" />
    </div>
  )
}

/**
 * Une demande, et où elle en est.
 *
 * La date de RÉPONSE est affichée quand elle existe : c'est elle qui distingue
 * « on s'en occupe » de « c'est fait », et le locataire n'a aucun autre moyen
 * de le savoir. Un refus porte sa date au même titre — une demande refusée est
 * traitée, elle n'est pas oubliée.
 */
function LigneDemande({ demande }: { demande: DocumentRequest }) {
  const t = useT()
  const d = useDates()

  const TONS: Record<DocumentRequest['status'], string> = {
    pending: 'text-warn',
    fulfilled: 'text-ok',
    declined: 'text-muted',
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-body">{t(DOCUMENT_KIND_LABELS[demande.kind] as 'app.documents.reqResidence')}</span>
      <span className={cn('text-body', TONS[demande.status])}>
        {t(`app.documents.reqStatus.${demande.status}` as 'app.documents.reqStatus.pending')}
        {' · '}
        {/* La date de la RÉPONSE prime sur celle de la demande : une fois
            répondu, « demandé le 12/08 » n'apprend plus rien. */}
        {d.fullDate(demande.resolvedAt ?? demande.requestedAt)}
      </span>
    </li>
  )
}
