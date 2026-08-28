import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { lien, useBase } from '@/lib/base'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { EmptyState } from '@/components/primitives/DataTable'
import { Skeleton, SkeletonRegion } from '@/components/primitives/Skeleton'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import {
  DOCUMENT_KIND_LABELS,
  dernierVersement,
  type DocumentKind,
  type DocumentRequest,
} from '@/data/portfolio'
import { usePortfolio } from '@/data/PortfolioProvider'
import { useToast } from '@/components/primitives/Toast'
import { useCsvExport, useCsvMoney } from '@/lib/useCsvExport'
import { cn } from '@/lib/cn'
import { useReceiptExport } from './receiptExport'

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
 * maquettes ; ce produit ne sait ni recevoir un fichier déposé, ni fabriquer un
 * PDF opposable — `receiptExport` le dit dans son propre commentaire. Chaque
 * ligne dit donc ce qu'elle sait faire : consulter la pièce à l'écran quand la
 * donnée existe, et annoncer la case vide quand elle n'existe pas.
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
  const downloadReceipt = useReceiptExport()
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
  const exportCsv = useCsvExport()
  const csvMoney = useCsvMoney()
  const [choix, setChoix] = useState<DocumentKind | null>(null)
  const boutons = useRef<(HTMLButtonElement | null)[]>([])

  /*
    UN CHOIX EXCLUSIF SE DIT `radiogroup`, et pas trois boutons pressés.

    `aria-pressed` décrit un interrupteur — chacun indépendant des autres. Ici
    les trois s'excluent : un lecteur d'écran annonçait donc trois bascules sans
    lien, quand il doit annoncer « 2 sur 3 ». Le motif complet vit déjà dans le
    formulaire de signalement, et son commentaire pose l'avertissement qu'on
    suit ici : annoncer une navigation aux flèches sans la câbler est PIRE
    qu'une rangée de boutons ordinaires, qui au moins ne promet rien.

    BORNAGE et non bouclage, comme partout dans ce dépôt.
  */
  const auClavier = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const destination =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(index + 1, DEMANDES.length - 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? DEMANDES.length - 1
              : null

    if (destination === null) return
    // Les flèches feraient défiler la rangée, `Début` et `Fin` le document.
    e.preventDefault()
    setChoix(DEMANDES[destination])
    boutons.current[destination]?.focus()
  }
  const suiviId = useId()

  /** Mono-unité, comme l'espace locataire — et pour la même raison. */
  const monUnite = tenantUnitIds[0] ?? ''
  const tenantReceipts = receiptsForUnit(monUnite)
  /* Les siennes, et dans l'ordre où il les a faites. */
  const mesDemandes = documentRequests.filter((d) => d.unitId === monUnite)
  const unit = unitById(monUnite)
  const deposit = depositForUnit(monUnite)
  const entree = inspectionForUnit(monUnite, 'entry')

  // L'attente AVANT le garde `!unit` : pendant le chargement, le jeu de
  // démonstration fournit toujours une unité, et l'écran montrerait le dossier
  // d'un autre. Même ordre, même raison que l'espace locataire.
  /**
   * Toutes les périodes en UN fichier, et non six téléchargements.
   *
   * « Tout télécharger » qui déclencherait six enregistrements successifs se
   * ferait arrêter par le navigateur dès le deuxième, et le locataire
   * repartirait avec une quittance sur six en croyant les avoir toutes.
   */
  function toutTelecharger() {
    if (!unit) return
    exportCsv({
      name: [t('app.documents.allReceipts'), unit.label],
      headers: [
        t('app.period'),
        csvMoney.header(t('app.tenant.colRent')),
        csvMoney.header(t('app.tenant.colWater')),
        csvMoney.header(t('app.tenant.colPower')),
        csvMoney.header(t('app.payments.paid')),
        t('app.payments.date'),
        t('app.payments.reference'),
      ],
      /**
       * Les montants de CHAQUE période, pris tels que le serveur les a figés.
       *
       * Le loyer sortait de `unit.rent` — celui du bail d'aujourd'hui, recopié
       * sur les six lignes —, et l'eau comme l'électricité se recalculaient au
       * tarif courant. Un fichier téléchargé en octobre n'aurait donc pas dit
       * la même chose que le même fichier téléchargé en juillet.
       *
       * La colonne « réglé » manquait, et son absence laissait croire chaque
       * ligne soldée : c'est le seul chiffre qui distingue une période payée
       * d'une période en cours.
       */
      rows: tenantReceipts.map((receipt) => {
        const versement = dernierVersement(receipt)
        return [
          d.monthYear(receipt),
          csvMoney.amount(receipt.rentMinor),
          csvMoney.amount(receipt.waterMinor),
          csvMoney.amount(receipt.powerMinor),
          csvMoney.amount(receipt.paidMinor),
          // Pas de versement, pas de date : inventer celle de l'échéance
          // laisserait croire à un règlement reçu.
          versement ? d.fullDate(versement.paidOn) : null,
          /*
            LA RÉFÉRENCE DE L'OPÉRATEUR, dans le fichier que le locataire garde.
            C'est avec elle qu'il conteste : sans elle, l'export lui demande de
            croire sur parole un encaissement qu'il ne peut pas retrouver chez
            son opérateur. Elle était écrite en base et rendue à personne.

            La NOTE du bailleur n'y est pas, et ne peut pas y être : le serveur
            ne la sert pas à un locataire.
          */
          versement?.reference ?? null,
        ]
      }),
      notice: 'app.receiptDownloaded',
    })
  }

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
  async function envoyerLaDemande() {
    if (!choix || !unit) return
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
            {/* Aucun dépôt de fichier n'existe dans le produit : la ligne dit
                la case vide plutôt que d'offrir un téléchargement qui
                fabriquerait le document qu'il prétend restituer. */}
            <LignePiece label={t('app.documents.lease')} />

            <LignePiece
              label={t('app.documents.entryInspection')}
              detail={entree ? d.fullDate(entree.date) : undefined}
              to={entree ? lien(base, 'etats-des-lieux') : undefined}
              action={t('app.documents.view')}
            />

            <LignePiece
              label={t('app.documents.depositReceipt')}
              detail={deposit ? money(deposit.held, { round: true }) : undefined}
              to={deposit ? lien(base, 'cautions') : undefined}
              action={t('app.documents.view')}
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
              tenantReceipts.length > 0 ? (
                <Button variant="ghost" size="sm" icon="download" onClick={toutTelecharger}>
                  {t('app.documents.downloadAll')}
                </Button>
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
                className="flex items-center gap-3 px-4 py-3 sm:px-5"
              >
                <Icon name="file" size={17} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 text-body">{d.monthYear(receipt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="download"
                  onClick={() => downloadReceipt(unit, receipt)}
                >
                  {t('app.documents.download')}
                </Button>
              </li>
            ))}
          </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/*
          DEMANDER UN DOCUMENT.

          La demande part par le canal des signalements — `addWork` —, le seul
          que le gestionnaire relève réellement. Elle lui arrive donc, il la voit
          et peut la clore, ce qu'un simple toast n'aurait jamais fait.

          DETTE DE MODÈLE, assumée et à solder : une demande de pièce n'est pas
          une intervention. Elle apparaîtra dans « Travaux dans mon logement »
          aux côtés d'une fuite d'évier, ce qui est faux. Le produit n'a pas
          d'objet « demande » ; en fabriquer un dépasse cet écran, et faire
          semblant d'envoyer aurait été pire que de mal ranger.
        */}
        <Card>
          <CardHeader
            title={t('app.documents.request')}
            description={t('app.documents.requestHint')}
            level={2}
          />
          <div role="radiogroup" aria-label={t('app.documents.request')} className="flex flex-wrap gap-2">
            {DEMANDES.map((demande, index) => {
              const actif = demande === choix
              /**
               * Une pièce DÉJÀ demandée et sans réponse ne se redemande pas.
               *
               * Le serveur le refuse — 409 `already_pending`, garanti par un
               * index unique partiel —, et le bouton doit dire la même chose
               * AVANT le clic : proposer un geste dont on sait qu'il échouera
               * n'offre pas un choix, il fabrique une erreur. Le suivi juste en
               * dessous montre la demande en cours ; la case n'est pas grisée
               * sans explication.
               */
              const enAttente = mesDemandes.some(
                (d) => d.kind === demande && d.status === 'pending',
              )
              return (
                <button
                  key={demande}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  // Un seul arrêt de tabulation pour le groupe : la tabulation
                  // traverse le formulaire, pas trois pièces. Il ne tient que
                  // parce que les flèches, elles, atteignent les autres. À
                  // défaut d'un choix fait, c'est la première qui l'accueille.
                  tabIndex={actif || (choix === null && index === 0) ? 0 : -1}
                  ref={(node) => {
                    boutons.current[index] = node
                  }}
                  disabled={enAttente}
                  onClick={() => setChoix(demande)}
                  onKeyDown={(event) => auClavier(event, index)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-md border px-3.5',
                    'text-label font-medium transition-colors duration-150',
                    'disabled:cursor-not-allowed disabled:opacity-55',
                    !enAttente && 'cursor-pointer',
                    actif
                      ? 'border-ink bg-ink text-on-dark'
                      : 'border-border bg-surface-sunken text-ink hover:border-border-strong',
                  )}
                >
                  {t(DOCUMENT_KIND_LABELS[demande] as 'app.documents.reqResidence')}
                </button>
              )
            })}
          </div>
          <Button className="mt-4" onClick={envoyerLaDemande} disabled={!choix}>
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
}: {
  label: string
  detail?: string
  to?: string
  action?: string
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
      <div className="ml-auto shrink-0">
        {to ? (
          <Button to={to} variant="ghost" size="sm">
            {action}
          </Button>
        ) : (
          <span className="text-caps text-muted">{t('app.documents.none')}</span>
        )}
      </div>
    </li>
  )
}

function TenantDocumentsSkeleton() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('app.documents.title')} description={t('app.documents.subtitle')} />
      <SkeletonRegion label={t('app.documents.title')}>
        <div className={GRILLE_DEUX_COLONNES}>
          {[0, 1].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-32" />
              <div className="mt-4 flex flex-col gap-3">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-5 w-full" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </SkeletonRegion>
    </>
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
