import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { SommaireDesRubriques } from '@/components/layout/SommaireDesRubriques'
import { Logo } from '@/components/primitives/Logo'
import { PanneauDeReglages } from '@/components/controls/PanneauDeReglages'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { DELAI_D_EFFACEMENT_JOURS, RELEVE_LE } from '@/legal/conditions'

/**
 * LES CONDITIONS GÉNÉRALES D'UTILISATION — la troisième page juridique, et la
 * dernière que la case de l'inscription attendait.
 *
 * `efd8654` avait retiré « les conditions générales » de cette case parce
 * qu'elles n'existaient pas, en notant qu'elles « restent à écrire, et la case à
 * rouvrir ce jour-là ». Voici la première moitié. LA CASE N'EST PAS ROUVERTE
 * ICI : publier un texte et le faire accepter sont deux gestes, et le second
 * change ce que le registre du consentement enregistre.
 *
 * Elle ne dit que ce que le produit fait — voir `src/legal/conditions.ts`, qui
 * porte les faits relevés et nomme les choix. Même en-tête et même gabarit que
 * les deux autres pages juridiques : trois pages qui ne se ressembleraient pas
 * laisseraient croire qu'elles ne viennent pas du même éditeur.
 */
/**
 * LES TREIZE RUBRIQUES, DANS L'ORDRE DU DOCUMENT.
 *
 * Elle sert au SOMMAIRE ; les rubriques elles-mêmes restent écrites en clair
 * plus bas, parce que leur corps est du JSX — des liens en pleine phrase, un
 * délai interpolé, une liste. Rendre la page entière à partir d'une table
 * transformerait treize paragraphes en treize cas particuliers d'un gabarit.
 *
 * LA DÉRIVE EST GARDÉE PLUTÔT QU'EMPÊCHÉE : `conditionsGenerales.test.tsx`
 * compare cette liste aux rubriques RÉELLEMENT rendues, dans l'ordre. Une
 * rubrique ajoutée sans son entrée de sommaire — ou l'inverse — rougit.
 */
const RUBRIQUES = [
  ['objet', 'terms.purpose.title'],
  ['service', 'terms.service.title'],
  ['compte', 'terms.account.title'],
  ['prix', 'terms.price.title'],
  ['donnees', 'terms.data.title'],
  ['obligations', 'terms.duties.title'],
  ['disponibilite', 'terms.availability.title'],
  ['responsabilite', 'terms.liability.title'],
  ['propriete', 'terms.property.title'],
  ['fermeture', 'terms.closure.title'],
  ['suspension', 'terms.suspension.title'],
  ['modification', 'terms.changes.title'],
  ['droit', 'terms.law.title'],
] as const

export function ConditionsGenerales() {
  const t = useT()
  const d = useDates()
  useDocumentTitle(t('terms.title'))

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
          <h1 className="display-m text-balance">{t('terms.title')}</h1>
          <p className="mt-4 text-body-l text-pretty text-muted">{t('terms.intro')}</p>
          <p className="mt-2 text-label text-muted">
            {t('terms.updatedOn', { date: d.fullDate(RELEVE_LE) })}
          </p>

          <SommaireDesRubriques
            libelle={t('legal.contents')}
            prefixe="conditions"
            rubriques={RUBRIQUES.map(([ancre, cle]) => ({
              ancre,
              titre: t(cle as 'terms.purpose.title'),
            }))}
          />

          <Rubrique id="objet" titre={t('terms.purpose.title')}>
            <p>{t('terms.purpose.body')}</p>
            <p className="mt-3">
              {t('terms.purpose.publisher')}{' '}
              <LienInterne to="/mentions-legales" libelle={t('legal.footerLink')} />
            </p>
          </Rubrique>

          <Rubrique id="service" titre={t('terms.service.title')}>
            <p>{t('terms.service.body')}</p>
            {/* CE QUE L'OUTIL N'EST PAS, en sous-titre et non noyé dans un
                paragraphe : un bailleur qui croirait y acheter du conseil fiscal
                ferait reposer une décision sur un calcul de suivi. */}
            <h3 className="mt-5 title-s">{t('terms.service.notTitle')}</h3>
            <div className="mt-3">
              <Liste
                items={[
                  t('terms.service.notAdvice'),
                  t('terms.service.notFunds'),
                  t('terms.service.notAccounting'),
                ]}
              />
            </div>
          </Rubrique>

          <Rubrique id="compte" titre={t('terms.account.title')}>
            <p>{t('terms.account.body')}</p>
            <p className="mt-3">{t('terms.account.password')}</p>
            <p className="mt-3">{t('terms.account.invite')}</p>
          </Rubrique>

          <Rubrique id="prix" titre={t('terms.price.title')}>
            <p>{t('terms.price.body')}</p>
            <p className="mt-3">{t('terms.price.future')}</p>
          </Rubrique>

          <Rubrique id="donnees" titre={t('terms.data.title')}>
            <p>{t('terms.data.body')}</p>
            <p className="mt-3">{t('terms.data.controller')}</p>
            <p className="mt-3">
              {t('terms.data.privacy')}{' '}
              <LienInterne to="/confidentialite" libelle={t('privacy.footerLink')} />
            </p>
          </Rubrique>

          <Rubrique id="obligations" titre={t('terms.duties.title')}>
            <p>{t('terms.duties.body')}</p>
            <div className="mt-3">
              <Liste
                items={[
                  t('terms.duties.lawful'),
                  t('terms.duties.scope'),
                  t('terms.duties.disrupt'),
                  t('terms.duties.content'),
                ]}
              />
            </div>
          </Rubrique>

          <Rubrique id="disponibilite" titre={t('terms.availability.title')}>
            <p>{t('terms.availability.body')}</p>
            <p className="mt-3">{t('terms.availability.backup')}</p>
          </Rubrique>

          <Rubrique id="responsabilite" titre={t('terms.liability.title')}>
            <p>{t('terms.liability.body')}</p>
            <p className="mt-3">{t('terms.liability.force')}</p>
          </Rubrique>

          <Rubrique id="propriete" titre={t('terms.property.title')}>
            <p>{t('terms.property.body')}</p>
          </Rubrique>

          <Rubrique id="fermeture" titre={t('terms.closure.title')}>
            <p>{t('terms.closure.body')}</p>
            {/* LE DÉLAI VIENT DU SERVEUR, jamais d'un nombre écrit ici : une page
                juridique qui promettrait trente jours quand le code en tient
                quinze serait un engagement que rien ne soutient. */}
            <p className="mt-3">
              {t('terms.closure.delay', { days: String(DELAI_D_EFFACEMENT_JOURS) })}
            </p>
            <p className="mt-3">{t('terms.closure.scope')}</p>
            <p className="mt-3">{t('terms.closure.warned')}</p>
            <p className="mt-3">{t('terms.closure.export')}</p>
          </Rubrique>

          <Rubrique id="suspension" titre={t('terms.suspension.title')}>
            <p>{t('terms.suspension.body')}</p>
          </Rubrique>

          <Rubrique id="modification" titre={t('terms.changes.title')}>
            <p>{t('terms.changes.body')}</p>
          </Rubrique>

          <Rubrique id="droit" titre={t('terms.law.title')}>
            <p>{t('terms.law.body')}</p>
            <p className="mt-3">{t('terms.law.amicable')}</p>
            <p className="mt-3">{t('terms.law.court')}</p>
          </Rubrique>

          <div className="mt-10">
            <Link
              to="/"
              className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-body font-semibold text-accent-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-accent-ink-hover"
            >
              {t('terms.home')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

/** Une rubrique nommée par son titre : un lecteur d'écran la liste parmi les régions. */
function Rubrique({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`conditions-${id}`} className="mt-10">
      {/* `scroll-mt-6` : la cible d'une ancre se colle au bord haut de la
          fenêtre, et un titre posé à zéro pixel du bord se lit comme une page
          coupée. Six unités rendent l'air qu'on attend au-dessus d'un titre. */}
      <h2 id={`conditions-${id}`} className="title-m scroll-mt-6">
        {titre}
      </h2>
      <div className="mt-3 text-body text-pretty">{children}</div>
    </section>
  )
}

/**
 * UN LIEN EN PLEINE PHRASE, vers les deux autres pages juridiques.
 *
 * `-my-2` et `min-h-11` : la cible fait 44 px de haut sans écarter le
 * paragraphe, comme les liens déjà exemptés ailleurs. Il navigue SUR PLACE et
 * non dans un nouvel onglet — contrairement à celui de l'inscription, cette page
 * ne porte aucune saisie qu'un départ jetterait.
 */
function LienInterne({ to, libelle }: { to: string; libelle: string }) {
  return (
    <Link
      to={to}
      className="-my-2 inline-flex min-h-11 items-center text-accent-ink underline underline-offset-4"
    >
      {libelle}
    </Link>
  )
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
