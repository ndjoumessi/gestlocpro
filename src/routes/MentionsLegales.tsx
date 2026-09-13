import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { Logo } from '@/components/primitives/Logo'
import { PanneauDeReglages } from '@/components/controls/PanneauDeReglages'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { EDITEUR, HEBERGEUR } from '@/legal/editeur'

/**
 * LES MENTIONS LÉGALES — la première page juridique du produit, et elle ne dit que
 * ce qui est établi.
 *
 * `PublicFooter.tsx` avait retiré ses liens « Conditions générales »,
 * « Confidentialité » et « Contact », qui menaient tous à la FAQ, en écrivant :
 * « les inventer serait un mensonge d'une autre gravité », et « retirer le lien
 * retire le mensonge, pas le devoir ». Nelson a transmis le 2026-09-12
 * l'attestation d'immatriculation de l'entreprise qui édite GestLocPro : c'est la
 * première pièce qui permet d'écrire l'une de ces pages SANS rien inventer.
 *
 * Ce que la page rend vient de `EDITEUR`, et seulement de lui. Ce que la loi exige
 * en plus et que l'attestation ne porte pas n'est pas affiché — ni deviné, ni
 * remplacé par « à compléter » sous les yeux d'un visiteur : voir
 * `MENTIONS_A_COMPLETER`.
 *
 * LES VALEURS DU REGISTRE RESTENT EN FRANÇAIS dans l'interface anglaise, et le
 * disent (`lang="fr"`) : une nature d'établissement inscrite au registre français
 * se cite, elle ne se traduit pas, et un lecteur d'écran anglais doit la
 * prononcer comme elle est écrite.
 *
 * L'en-tête est celui du 404 public — logo et réglages derrière un bouton —, pour
 * la même raison : la barre de la vitrine pointe vers des ancres absentes d'ici.
 */
export function MentionsLegales() {
  const t = useT()
  const d = useDates()
  useDocumentTitle(t('legal.title'))

  const faits: { cle: string; libelle: string; valeur: React.ReactNode }[] = [
    { cle: 'entrepreneur', libelle: t('legal.name'), valeur: EDITEUR.entrepreneur },
    { cle: 'forme', libelle: t('legal.legalForm'), valeur: <span lang="fr">{EDITEUR.forme}</span> },
    { cle: 'siren', libelle: t('legal.siren'), valeur: <span className="numeric">{EDITEUR.siren}</span> },
    /* Une citation du code général des impôts : en français dans les deux
       interfaces, comme les valeurs du registre. */
    { cle: 'tva', libelle: t('legal.vat'), valeur: <span lang="fr">{EDITEUR.tva}</span> },
    { cle: 'nature', libelle: t('legal.nature'), valeur: <span lang="fr">{EDITEUR.nature}</span> },
    { cle: 'activite', libelle: t('legal.activity'), valeur: <span lang="fr">{EDITEUR.activite}</span> },
    {
      cle: 'adresse',
      libelle: t('legal.address'),
      valeur: (
        <address className="not-italic" lang="fr">
          {EDITEUR.adresse.map((ligne) => (
            <span key={ligne} className="block">
              {ligne}
            </span>
          ))}
        </address>
      ),
    },
    {
      cle: 'registre',
      libelle: t('legal.registration'),
      valeur: (
        <>
          <span lang="fr">{EDITEUR.registre}</span>
          <span className="block text-label text-muted">
            {t('legal.updatedOn', { date: d.fullDate(EDITEUR.miseAJour) })}
          </span>
        </>
      ),
    },
    { cle: 'directeur', libelle: t('legal.director'), valeur: EDITEUR.directeurDeLaPublication },
  ]

  /* L'HÉBERGEUR EST AMÉRICAIN, ses coordonnées sont écrites en anglais et le
     déclarent (`lang="en"`) — même règle que les valeurs du registre, dans
     l'autre sens. */
  const hebergement: { cle: string; libelle: string; valeur: React.ReactNode }[] = [
    { cle: 'raison', libelle: t('legal.hostName'), valeur: <span lang="en">{HEBERGEUR.raisonSociale}</span> },
    {
      cle: 'adresse',
      libelle: t('legal.address'),
      valeur: (
        <address className="not-italic" lang="en">
          {HEBERGEUR.adresse.map((ligne) => (
            <span key={ligne} className="block">
              {ligne}
            </span>
          ))}
        </address>
      ),
    },
    {
      cle: 'telephone',
      libelle: t('legal.phone'),
      valeur: (
        /* `min-h-11` et `-my-2`, comme le numéro d'une fiche de locataire : une
           cible de 44 px, sans agrandir la ligne qui la porte. */
        <a
          href={`tel:${HEBERGEUR.telephone.replace(/[^\d+]/g, '')}`}
          className="numeric -my-2 inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
        >
          {HEBERGEUR.telephone}
        </a>
      ),
    },
    {
      cle: 'courriel',
      libelle: t('legal.email'),
      valeur: (
        <a
          href={`mailto:${HEBERGEUR.courriel}`}
          className="-my-2 inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
        >
          {HEBERGEUR.courriel}
        </a>
      ),
    },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header
        className={cn(
          'flex flex-wrap items-center gap-4 border-b border-border',
          'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3',
          'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
        )}
      >
        <Logo />
        <PanneauDeReglages className="ml-auto" />
      </header>

      <main className={cn('flex-1 py-12', GOUTTIERE_LATERALE)}>
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="display-m text-balance">{t('legal.title')}</h1>
          <p className="mt-4 text-body-l text-pretty text-muted">{t('legal.intro')}</p>

          <section aria-labelledby="mentions-editeur" className="mt-10">
            <h2 id="mentions-editeur" className="title-m">
              {t('legal.publisher')}
            </h2>
            {/* `<dl>` : un lecteur d'écran annonce le terme avant sa valeur,
                la règle des fiches du produit. */}
            <dl className="mt-4 divide-y divide-divider border-y border-divider">
              {faits.map((fait) => (
                <div key={fait.cle} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                  <dt className="text-label font-semibold text-muted">{fait.libelle}</dt>
                  <dd className="text-body break-words">{fait.valeur}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="mentions-hebergement" className="mt-10">
            <h2 id="mentions-hebergement" className="title-m">
              {t('legal.hosting')}
            </h2>
            <dl className="mt-4 divide-y divide-divider border-y border-divider">
              {hebergement.map((fait) => (
                <div key={fait.cle} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                  <dt className="text-label font-semibold text-muted">{fait.libelle}</dt>
                  <dd className="text-body break-words">{fait.valeur}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-10">
            <Link
              to="/"
              className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-body font-semibold text-accent-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-accent-ink-hover"
            >
              {t('legal.home')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
