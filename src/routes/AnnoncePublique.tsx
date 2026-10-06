import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { Logo } from '@/components/primitives/Logo'
import { PanneauDeReglages } from '@/components/controls/PanneauDeReglages'
import { Notice } from '@/components/primitives/Notice'
import { useT, useI18n } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { partiesDeDateISO } from '@/lib/dates'
import { useCurrency } from '@/currency/CurrencyProvider'
import { CURRENCY_DEFS, formatTaux, type CurrencyCode } from '@/currency/currencies'
import { api } from '@/api/client'

interface AnnonceApi {
  rentMinor: number
  depositMinor: number
  currency: CurrencyCode
  availableFrom: string
  description: string | null
  unitLabel: string
  unitType: string
  surfaceSqm: number
  buildingName: string
  district: string
  parkName: string
}

/**
 * UNE ANNONCE, LISIBLE PAR QUELQU'UN QUI N'A PAS DE COMPTE.
 *
 * ═══ POURQUOI CETTE PAGE EXISTE ═══
 *
 * `Listing` et `Applicant` sont nés avec le lot de la vacance, tous deux
 * derrière `exigerAppartenance`. Une annonce publiée ne quittait donc pas le
 * produit : le bailleur la rédigeait, et devait ensuite la recopier ailleurs
 * pour la diffuser. Une annonce qu'on ne peut envoyer à personne n'est pas une
 * annonce.
 *
 * ═══ CE QUE CETTE PAGE NE FAIT PAS, ET CE N'EST PAS UN OUBLI ═══
 *
 * AUCUN FORMULAIRE DE CANDIDATURE. Ce serait la moitié naturelle de l'écran, et
 * elle attend : le serveur n'a AUCUN limiteur de cadence — mesuré, et signalé à
 * part — alors que quatre routes répondent déjà sans authentification. Ouvrir la
 * première ÉCRITURE publique avant une limite ajouterait de l'exposition sur un
 * trou connu.
 *
 * L'usage reste celui du marché visé : le bailleur envoie le lien sur WhatsApp,
 * le prospect lit les faits et répond sur WhatsApp. La page ne prétend pas
 * porter la conversation, et n'affiche donc AUCUN moyen de contact — en inventer
 * un serait la classe de promesse que ce produit refuse ailleurs.
 *
 * ═══ L'EN-TÊTE EST CELUI DU 404 PUBLIC ET DES PAGES JURIDIQUES ═══
 *
 * Logo et réglages derrière un bouton, pour la même raison qu'elles : la barre
 * de la vitrine pointe vers des ancres qui n'existent pas ici.
 *
 * ═══ TROIS ÉTATS DISTINCTS, JAMAIS CONFONDUS ═══
 *
 * « en train de lire », « cette annonce n'existe pas ou n'est plus publiée », et
 * « le serveur n'a pas répondu » sont trois choses, et l'écran les dit
 * séparément. Les replier sur un seul message ferait lire une panne de réseau
 * comme un logement reloué.
 */
export function AnnoncePublique() {
  const { listingId } = useParams<{ listingId: string }>()
  const t = useT()
  const d = useDates()
  const { locale } = useI18n()
  const { argentDepuis, baseDeConversion } = useCurrency()

  const [annonce, setAnnonce] = useState<AnnonceApi | null>(null)
  /** `null` tant qu'on lit ; puis `'absente'` ou `'panne'`. Jamais un booléen. */
  const [echec, setEchec] = useState<'absente' | 'panne' | null>(null)

  useDocumentTitle(
    annonce
      ? t('listing.titleFor', { unit: annonce.unitLabel, district: annonce.district })
      : t('listing.title'),
  )

  useEffect(() => {
    if (!listingId) return
    let annule = false
    void api
      .annoncePublique<AnnonceApi>(listingId)
      .then((lu) => {
        if (!annule) setAnnonce(lu)
      })
      .catch((cause: unknown) => {
        if (annule) return
        /*
          LE 404 ET LA PANNE NE SE CONFONDENT PAS, et le serveur rend le MÊME
          404 pour une annonce absente, un brouillon et une fermée — c'est
          voulu, sans quoi la route deviendrait un détecteur de brouillons. La
          page dit donc « absente ou plus publiée », qui est exactement ce
          qu'elle sait.
        */
        const statut =
          typeof cause === 'object' && cause !== null && 'status' in cause
            ? (cause as { status?: number }).status
            : undefined
        setEchec(statut === 404 ? 'absente' : 'panne')
      })
    return () => {
      annule = true
    }
  }, [listingId])

  /* LA BASE DE CONVERSION, dans les mêmes termes que les pièces du produit :
     d'où, à quel taux, de quand. Une annonce lue en euros sous un loyer encaissé
     en francs affirmerait un prix qui n'a pas été demandé. */
  const base = annonce ? baseDeConversion(annonce.currency) : null
  const mentionDeConversion = base
    ? base.date
      ? t('app.documents.pdfConverted', {
          currency: CURRENCY_DEFS[base.depuis].label,
          date: d.fullDate(partiesDeDateISO(base.date)),
          rate: formatTaux(base.taux, locale),
        })
      : t('app.documents.pdfConvertedPegged', {
          currency: CURRENCY_DEFS[base.depuis].label,
          rate: formatTaux(base.taux, locale),
        })
    : null

  return (
    <div className="min-h-dvh bg-canvas">
      {/*
        LA FORME EXACTE DE L'EN-TÊTE DU 404 PUBLIC, recopiée et non redérivée.

        Ma première rédaction posait `py-4` et la gouttière partagée :
        `plafond-coquille` l'a refusée sur-le-champ — 77 px de coquille pour un
        plafond public de 69, sur les trois largeurs. Huit pixels de plus que
        toutes les autres pages publiques, pour rien.

        ET ELLE AURAIT REPRIS UN DÉFAUT DÉJÀ PAYÉ. `NotFound.tsx` porte
        `flex-wrap` avec son motif mesuré : « sans elle, le logo et la rangée
        restent sur une même ligne quoi qu'il arrive […] il restait 4 px de
        débordement à 320 ». Les retraits à `env(safe-area-inset-*)` y sont pour
        la même raison — c'est le premier élément du document sous
        `viewport-fit=cover`.

        TROISIÈME COPIE DE CETTE FORME, après `NotFound` et `MentionsLegales`.
        L'extraire serait juste, et ce lot n'est pas celui qui doit le faire :
        NOMMÉ, pas corrigé.
      */}
      <header
        className={cn(
          'flex flex-wrap items-center gap-4 border-b border-border',
          'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3',
          'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
        )}
      >
        {/* LE PLANCHER DE CIBLE TACTILE EST DÉCLARÉ ICI, et c'est `cibles.test.ts`
            qui l'a exigé : un `<Link>` nu autour du logo mesurait la hauteur du
            dessin, pas celle d'un doigt. La forme est celle du lien de retour
            des pages juridiques — `min-h-11`, un retrait négatif pour que la
            zone cliquable dépasse sans décaler le logo. */}
        <Link
          to="/"
          aria-label={t('common.backToHome')}
          className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2"
        >
          <Logo />
        </Link>
        <PanneauDeReglages />
      </header>

      {/*
        `aria-busy` PENDANT LA LECTURE, et ce n'est pas une concession à une
        porte.

        C'est d'abord juste : la zone est en cours de mise à jour, et une aide
        technique doit l'apprendre plutôt que d'annoncer un contenu qui va
        changer sous elle.

        ET C'EST CE QUE `plafond-hauteurs` OBSERVE pour savoir si la hauteur
        qu'il mesure est celle du contenu ou celle d'un squelette. Sans ce
        drapeau, il a refusé la page : « un écran qui lisait des données ne le
        dit plus ». Le déclarer « sans attente » aurait été FAUX — cette page lit
        une annonce ; la liste des écrans muets est réservée à ceux qui ne lisent
        aucune donnée.
      */}
      <main
        aria-busy={annonce === null && echec === null}
        className={cn('mx-auto max-w-2xl py-10', GOUTTIERE_LATERALE)}
      >
        {echec === 'absente' && (
          <Notice tone="neutral" titre={t('listing.goneTitle')} role="alert">
            {t('listing.goneBody')}
          </Notice>
        )}
        {echec === 'panne' && (
          <Notice tone="danger" titre={t('listing.failedTitle')} role="alert">
            {t('listing.failedBody')}
          </Notice>
        )}
        {/* NI L'UN NI L'AUTRE, ET RIEN ENCORE : on lit. Le dire plutôt que de
            laisser une page vide, qui se lit comme un logement sans annonce. */}
        {!annonce && echec === null && (
          <p className="text-body text-muted" role="status">
            {t('common.loading')}
          </p>
        )}

        {annonce && (
          <article>
            <p className="mono-label text-muted">{annonce.parkName}</p>
            <h1 className="display-m mt-1">
              {t('listing.heading', {
                type: annonce.unitType,
                district: annonce.district,
              })}
            </h1>
            <p className="text-body text-muted mt-2">
              {t('listing.whereLine', {
                building: annonce.buildingName,
                unit: annonce.unitLabel,
              })}
            </p>

            <dl className="mt-8 flex flex-col gap-3">
              {(
                [
                  ['listing.rent', argentDepuis(annonce.rentMinor, annonce.currency)],
                  ['listing.deposit', argentDepuis(annonce.depositMinor, annonce.currency)],
                  [
                    'listing.surface',
                    t('listing.surfaceValue', { n: String(annonce.surfaceSqm) }),
                  ],
                  [
                    'listing.availableFrom',
                    d.fullDate(partiesDeDateISO(annonce.availableFrom)),
                  ],
                ] as const
              ).map(([cle, valeur]) => (
                <div key={cle} className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-muted">
                    {t(cle as 'listing.rent')}
                  </dt>
                  <dd className="mono-data font-semibold">{valeur}</dd>
                </div>
              ))}
            </dl>

            {mentionDeConversion && (
              <p className="text-caption text-muted mt-3">{mentionDeConversion}</p>
            )}

            {/* LA DESCRIPTION EST CELLE DU BAILLEUR, rendue telle quelle : c'est
                la seule donnée de cette page qu'un humain a écrite, et personne
                ne traduit ce qu'un humain a écrit. */}
            {annonce.description && (
              <p className="text-body mt-8 whitespace-pre-line">{annonce.description}</p>
            )}

            {/* CE QUE LA PAGE NE PEUT PAS FAIRE, DIT À L'ENDROIT OÙ ON LE
                CHERCHE. Un prospect arrive ici pour postuler ; ne rien dire le
                laisserait chercher un bouton absent. La phrase renvoie vers
                celui qui a envoyé le lien, parce que c'est la vérité du
                produit aujourd'hui. */}
            <p className="text-body-s text-muted mt-10 border-t border-divider pt-5">
              {t('listing.howToApply')}
            </p>
          </article>
        )}
      </main>
    </div>
  )
}
